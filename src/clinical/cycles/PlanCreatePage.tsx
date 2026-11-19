// «Organizar por ciclos»: crear (o cambiar) el plan de un motivo en una sola pantalla: el macrociclo (objetivo, inicio y
// duración), los mesociclos (las fases y sus semanas) y los microciclos (sesiones por semana, descarga y esfuerzo).
// Las plantillas solo traen nombres y semanas; la app no propone nada clínico.
import { ArrowDown, ArrowUp, Layers, Minus, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { todayDay } from "../../app/dates";
import { bumpData } from "../../app/dataVersion";
import { Page } from "../../app/Page";
import { checkPlan, emptyPhase, LIMITS, mondayOf, newPlan, PHASE_TEMPLATES, planSpanText, savePlan, type Effort, type PhaseDoc, type PlanDoc } from "../../data/cycles";
import { listTemplates, phaseFromTemplate, templateSummary, type CycleTemplate } from "../../data/cycleTemplates";
import { useAsync } from "../../app/useAsync";
import { getDb } from "../../data/db";
import { Alert } from "../../ui/Alert";
import { Button, IconButton } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { TextAreaField, TextField } from "../../ui/Field";
import { Guard } from "../pageKit";
import { Segmented, usePlan, usePlanParams } from "./parts";

/** Una fase en el formulario; `doc`: sus ejercicios, si vienen de una plantilla de la clínica. */
type Row = { id?: string; name: string; weeks: number; doc?: PhaseDoc };
const EFFORTS: Effort[] = ["rpe", "rir", "none"];
const EFFORT_TEXT: Record<Effort, string> = { rpe: "RPE", rir: "RIR", none: "No anotar" };

export function PlanCreatePage() {
  const { id = "" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const [params] = useSearchParams();
  const editing = params.get("editar") === "1";
  const data = usePlan(id, motivo);
  if (!data.data) return <Guard state={data} title="Organizar por ciclos" back={volver} />;
  return <PlanForm key={data.data.episode} patientId={id} data={data.data} editing={editing && !!data.data.loaded} volver={volver} />;
}

function PlanForm({
  patientId,
  data,
  editing,
  volver,
}: {
  patientId: string;
  data: NonNullable<ReturnType<typeof usePlan>["data"]>;
  editing: boolean;
  volver: string;
}) {
  const navigate = useNavigate();
  const old = editing ? data.loaded!.plan : null;
  const [goal, setGoal] = useState(old?.goal ?? data.anamnesisGoal);
  const [start, setStart] = useState(old?.start ?? mondayOf(todayDay()));
  const [rows, setRows] = useState<Row[]>(old ? old.phases.map((p) => ({ ...p })) : PHASE_TEMPLATES[0]!.phases.map((p) => ({ ...p })));
  const [template, setTemplate] = useState<string | null>(old ? null : PHASE_TEMPLATES[0]!.id);
  const [perWeek, setPerWeek] = useState(old?.perWeek ?? 2);
  const [deload, setDeload] = useState(old?.deload ?? true);
  const [effort, setEffort] = useState<Effort>(old?.effort ?? "rpe");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Las plantillas que ha guardado la clínica (sin las archivadas).
  const clinic = useAsync(async () => (await listTemplates(getDb())).filter((t) => !t.archived), [], { tables: ["settings"] });
  const applyClinicTemplate = (t: CycleTemplate) => {
    setTemplate(`clinica:${t.id}`);
    setRows(
      t.phases.map((p, i) => {
        const id = crypto.randomUUID();
        const doc = t.docs[i];
        return { id, name: p.name, weeks: p.weeks, ...(doc ? { doc: phaseFromTemplate(doc, id, p.weeks) } : {}) };
      }),
    );
    setPerWeek(t.perWeek);
    setDeload(t.deload);
    setEffort(t.effort);
  };
  const fromClinic = rows.some((r) => r.doc);

  const draft: PlanDoc = (() => {
    const p = newPlan({ goal, start, phases: rows, perWeek, deload, effort });
    // Las fases que ya estaban conservan su id (y con él sus ejercicios).
    return { ...p, phases: p.phases.map((ph, i) => ({ ...ph, id: rows[i]!.id ?? ph.id })) };
  })();
  const span = /^\d{4}-\d{2}-\d{2}$/.test(start) ? planSpanText(draft) : "";
  const setRow = (i: number, r: Partial<Row>) => {
    setTemplate(null);
    setRows(rows.map((x, j) => (j === i ? { ...x, ...r } : x)));
  };
  // El contador de mesociclos: al subir, una fase nueva al final; al bajar, fuera la última (si ya tiene ejercicios,
  // se pregunta antes).
  const [confirmLess, setConfirmLess] = useState(false);
  const hasExercises = (r: Row) => (r.doc ?? (r.id ? data.loaded?.phases[r.id] : undefined))?.sessions.some((x) => x.exercises.some((e) => e.name.trim())) ?? false;
  const addPhase = () => {
    setTemplate(null);
    setConfirmLess(false);
    setRows([...rows, { name: `Fase ${rows.length + 1}`, weeks: 4 }]);
  };
  const removeLast = () => {
    setTemplate(null);
    setConfirmLess(false);
    setRows(rows.slice(0, -1));
  };
  const move = (i: number, by: number) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + by, 0, r!);
    setTemplate(null);
    setRows(next);
  };

  async function save(next: "semana" | "plan") {
    const err = checkPlan(draft);
    if (err) return setError(err);
    setBusy(true);
    try {
      // Las fases de una plantilla de la clínica llevan sus ejercicios (con sus semanas ajustadas a las de ahora).
      const fromTpl = rows.flatMap((r, i) => {
        if (!r.doc) return [];
        const weeks = draft.phases[i]!.weeks;
        return [{ ...r.doc, weeks: Array.from({ length: weeks }, (_, w) => r.doc!.weeks[w] ?? {}), manual: r.doc.manual.filter((k) => Number(k.split(":")[0]) < weeks), assess: r.doc.assess?.filter((w) => w < weeks) }];
      });
      const fresh = draft.phases.filter((p) => !data.loaded?.phases[p.id] && !fromTpl.some((d) => d.id === p.id)).map((p) => emptyPhase(p.id, p.weeks));
      await savePlan(getDb(), patientId, data.episode, draft, [...fromTpl, ...(editing || fromTpl.length ? [] : fresh.slice(0, 1))]);
      bumpData("settings");
      const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;
      navigate(next === "semana" ? `/pacientes/${patientId}/ciclos/${draft.phases[0]!.id}/semana/0?${q}` : `/pacientes/${patientId}/ciclos?${q}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const section = "text-xs font-semibold tracking-wide text-text-muted uppercase";
  return (
    <Page title={editing ? "Cambiar el plan" : "Organizar por ciclos"} backTo={volver} backLabel="Volver" tabs={false}>
      <p className="-mt-2 text-sm text-text-muted">
        {data.patient?.name}
        {data.episodeName ? ` · ${data.episodeName}` : ""}
      </p>

      <Card className="flex flex-col gap-3">
        <h2 className={section}>Macrociclo · objetivo</h2>
        <TextAreaField label="Objetivo general" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} hint={!old && data.anamnesisGoal ? "De los objetivos a largo plazo de su anamnesis. Cambiarlo aquí no cambia la anamnesis." : undefined} />
        <TextField label="Empieza" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        {span && <p className="text-sm text-text-muted">{span}</p>}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className={section}>Mesociclos · fases</h2>
        <div role="group" aria-label="Plantillas de fases" className="flex flex-wrap gap-2">
          {PHASE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={template === t.id}
              onClick={() => {
                setTemplate(t.id);
                setRows(t.phases.map((p) => ({ ...p })));
              }}
              className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", template === t.id ? "border-accent bg-accent text-on-accent" : "border-border bg-bg text-text hover:bg-surface")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(clinic.data?.length ?? 0) > 0 && (
          <>
            <p className="text-sm font-semibold">Plantillas de la clínica</p>
            <div role="group" aria-label="Plantillas de la clínica" className="flex flex-wrap gap-2">
              {clinic.data!.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={template === `clinica:${t.id}`}
                  onClick={() => applyClinicTemplate(t)}
                  className={cx(
                    "flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-1 text-left",
                    template === `clinica:${t.id}` ? "border-accent bg-accent text-on-accent" : "border-border bg-bg text-text hover:bg-surface",
                  )}
                >
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className={cx("text-xs", template === `clinica:${t.id}` ? "" : "text-text-muted")}>{templateSummary(t)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {fromClinic && (
          <p className="text-sm text-text-muted">
            Con los ejercicios de la plantilla{editing ? ": al guardar, las fases y sus ejercicios se cambian por los de la plantilla (las sesiones ya apuntadas no se tocan)" : ""}. El objetivo y el 1RM se ponen para este paciente.
          </p>
        )}
        <div className="flex items-center gap-2">
          <span id="n-meso" className="min-w-0 flex-1 font-semibold">
            Mesociclos
          </span>
          <IconButton label="Un mesociclo menos" onClick={() => (hasExercises(rows[rows.length - 1]!) ? setConfirmLess(true) : removeLast())} disabled={rows.length <= 1}>
            <Minus aria-hidden="true" className="size-5" />
          </IconButton>
          <output aria-labelledby="n-meso" aria-live="polite" className="nums w-10 shrink-0 text-center text-xl font-semibold">
            {rows.length}
          </output>
          <IconButton label="Un mesociclo más" onClick={addPhase} disabled={rows.length >= LIMITS.phases}>
            <Plus aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <p className="-mt-2 text-xs text-text-muted">De 1 a {LIMITS.phases}. Al subir se añade una fase al final; al bajar se quita la última.</p>
        {confirmLess && (
          <div role="alert" className="flex flex-col gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm">
            <p>
              La fase {rows.length} («{rows[rows.length - 1]!.name}») ya tiene ejercicios. Si la quitas, salen del plan al guardar (las sesiones ya
              apuntadas no se tocan).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" size="sm" onClick={removeLast}>
                Quitar la fase {rows.length}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmLess(false)}>
                Dejarla
              </Button>
            </div>
          </div>
        )}
        <ol aria-label="Fases" className="flex flex-col divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="flex flex-col gap-2 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <input
                  aria-label={`Nombre de la fase ${i + 1}`}
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-2 font-semibold"
                />
                <IconButton label={`Una semana menos en la fase ${i + 1}`} onClick={() => setRow(i, { weeks: Math.max(1, r.weeks - 1) })} disabled={r.weeks <= 1}>
                  <Minus aria-hidden="true" className="size-5" />
                </IconButton>
                <span className="nums w-10 shrink-0 text-center leading-tight">
                  <span className="block font-semibold">{r.weeks}</span>
                  <span className="text-xs text-text-muted">sem.</span>
                </span>
                <IconButton label={`Una semana más en la fase ${i + 1}`} onClick={() => setRow(i, { weeks: Math.min(LIMITS.weeks, r.weeks + 1) })} disabled={r.weeks >= LIMITS.weeks}>
                  <Plus aria-hidden="true" className="size-5" />
                </IconButton>
              </div>
              {rows.length > 1 && (
                <div className="flex justify-end gap-1">
                  <IconButton label={`Subir la fase ${i + 1}`} onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp aria-hidden="true" className="size-5" />
                  </IconButton>
                  <IconButton label={`Bajar la fase ${i + 1}`} onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                    <ArrowDown aria-hidden="true" className="size-5" />
                  </IconButton>
                  <IconButton
                    label={`Quitar la fase ${i + 1}`}
                    onClick={() => {
                      setTemplate(null);
                      setConfirmLess(false);
                      setRows(rows.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash aria-hidden="true" className="size-5" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ol>
        {rows.length < LIMITS.phases && (
          <Button variant="secondary" size="sm" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={addPhase}>
            Añadir una fase
          </Button>
        )}
        {editing && <p className="text-sm text-text-muted">Quitar una fase quita sus ejercicios del plan; las sesiones ya apuntadas no se tocan.</p>}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className={section}>Microciclos · semanas</h2>
        <p className="font-semibold">Sesiones por semana</p>
        <Segmented label="Sesiones por semana" options={[1, 2, 3, 4, 5] as const} value={perWeek as 1 | 2 | 3 | 4 | 5} onChange={setPerWeek} />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-accent" checked={deload} onChange={(e) => setDeload(e.target.checked)} />
          La última semana de cada fase es de descarga
        </label>
        <p className="font-semibold">Esfuerzo</p>
        <Segmented label="Esfuerzo" options={EFFORTS} value={effort} onChange={setEffort} render={(e) => EFFORT_TEXT[e]} />
      </Card>

      {error && <Alert tone="danger" title={error} />}
      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 flex flex-col gap-1 border-t border-border bg-canvas/95 px-4 py-2 backdrop-blur">
        {editing ? (
          <Button size="lg" block loading={busy} onClick={() => void save("plan")}>
            Guardar los cambios
          </Button>
        ) : (
          <>
            <Button size="lg" block loading={busy} icon={<Layers aria-hidden="true" className="size-5" />} onClick={() => void save("semana")}>
              Siguiente: ejercicios de la semana 1
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => void save("plan")}>
              {fromClinic ? "Crear y ver el plan" : "Crear sin ejercicios"}
            </Button>
          </>
        )}
      </div>
    </Page>
  );
}
