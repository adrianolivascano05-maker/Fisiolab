// Los ejercicios de una semana de una fase (un microciclo): el objetivo de la fase, sus sesiones tipo (A, B…) y, en
// cada una, los ejercicios con sus parámetros. Los ejercicios se escriben a mano; cada uno recuerda los parámetros con
// que se usó la última vez. El % 1RM se pasa a kilos con un 1RM aproximado que el fisio calcula aquí.
import { ArrowDown, ArrowUp, BookOpen, Calculator, Copy, Ellipsis, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { bumpData } from "../../app/dataVersion";
import { decimalText } from "../../app/format";
import { Page } from "../../app/Page";
import { useAsync } from "../../app/useAsync";
import {
  ALL_PARAMS,
  copyFromWeek,
  emptyPhase,
  kgOfPct,
  knownExerciseNames,
  LIMITS,
  newExercise,
  oneRmEpley,
  phaseStart,
  rememberedExercise,
  rememberSql,
  savePhase,
  setCell,
  shortDay,
  weekDays,
  type Dose,
  type PhaseDoc,
  type PlanExercise,
  type WeekCells,
} from "../../data/cycles";
import { getDb } from "../../data/db";
import { Alert } from "../../ui/Alert";
import { Button, IconButton } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { TextAreaField, TextField } from "../../ui/Field";
import { useToast } from "../../ui/Toast";
import { Guard } from "../pageKit";
import { DoseInputs, NumCell, paramLabel, Segmented, usePlan, usePlanParams } from "./parts";

export function WeekPage() {
  const { id = "", fase = "", w = "0" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const data = usePlan(id, motivo);
  const names = useAsync(() => knownExerciseNames(getDb()), [], { tables: ["settings"] });
  if (!data.data) return <Guard state={data} title="Semana" back={volver} />;
  const loaded = data.data.loaded;
  const index = loaded ? loaded.plan.phases.findIndex((p) => p.id === fase) : -1;
  if (!loaded || index < 0) return <Guard state={{ ...data, error: new Error("Este plan o esta fase ya no existen.") }} title="Semana" back={volver} />;
  const week = Math.max(0, Math.min(Number(w) || 0, loaded.plan.phases[index]!.weeks - 1));
  return <WeekEditor key={`${fase}:${week}`} patientId={id} data={data.data} index={index} week={week} names={names.data ?? []} volver={volver} />;
}

function WeekEditor({
  patientId,
  data,
  index,
  week,
  names,
  volver,
}: {
  patientId: string;
  data: NonNullable<ReturnType<typeof usePlan>["data"]>;
  index: number;
  week: number;
  names: string[];
  volver: string;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { plan, phases } = data.loaded!;
  const ref = plan.phases[index]!;
  const [doc, setDoc] = useState<PhaseDoc>(() => {
    const d = phases[ref.id] ?? emptyPhase(ref.id, ref.weeks);
    const weeks = [...d.weeks];
    while (weeks.length < ref.weeks) weeks.push({});
    const sessions = d.sessions.length ? d.sessions : [{ id: crypto.randomUUID(), label: "A", exercises: [] }];
    return { ...d, weeks, sessions };
  });
  const [tab, setTab] = useState(doc.sessions[0]!.id);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [calc, setCalc] = useState<string | null>(null);
  /** El ejercicio con los parámetros a la vista para añadir o quitar. */
  const [paramsOf, setParamsOf] = useState<string | null>(null);
  /** El ejercicio con «Cómo se hace» abierto para escribirlo. */
  const [howOf, setHowOf] = useState<string | null>(null);
  const session = doc.sessions.find((s) => s.id === tab) ?? doc.sessions[0]!;
  const cells: Record<string, Dose> = doc.weeks[week]?.[session.id] ?? {};
  const globalWeek = phaseStart(plan, index) + week;
  const [from, to] = weekDays(plan, globalWeek);
  const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;

  /** De dónde se copia «Lo de la última sesión»: la semana anterior de esta fase o, en la primera, la última normal de la anterior. */
  const source: { cells: WeekCells; sessionId: string } | null = (() => {
    if (week > 0) return doc.weeks[week - 1]?.[session.id] ? { cells: doc.weeks[week - 1]!, sessionId: session.id } : null;
    const prevRef = plan.phases[index - 1];
    const prev = prevRef && phases[prevRef.id];
    if (!prev) return null;
    const last = plan.deload && prev.weeks.length > 1 ? prev.weeks.length - 2 : prev.weeks.length - 1;
    const twin = prev.sessions.find((s) => s.label === session.label) ?? prev.sessions[0];
    return twin && prev.weeks[last]?.[twin.id] ? { cells: prev.weeks[last]!, sessionId: twin.id } : null;
  })();

  const setExercises = (fn: (ex: PlanExercise[]) => PlanExercise[]) => setDoc((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === session.id ? { ...s, exercises: fn(s.exercises) } : s)) }));
  const setDose = (exId: string, dose: Dose) => setDoc((d) => setCell(d, week, session.id, exId, dose));

  async function add() {
    const name = adding.trim();
    if (!name || session.exercises.length >= LIMITS.exercises) return;
    const remembered = await rememberedExercise(getDb(), name);
    const ex = newExercise(name, remembered);
    setExercises((list) => [...list, ex]);
    setAdding("");
  }

  async function save(then?: "progresion" | "plan") {
    setBusy(true);
    try {
      // «Cómo se hace» vacío no se guarda.
      const tidy = (e: PlanExercise): PlanExercise => {
        const { how, ...rest } = e;
        return how?.trim() ? { ...rest, how: how.trim() } : rest;
      };
      const clean = { ...doc, goal: doc.goal.trim(), sessions: doc.sessions.map((x) => ({ ...x, exercises: x.exercises.map(tidy) })) };
      await savePhase(getDb(), patientId, data.episode, clean);
      await getDb().transaction(rememberSql(clean.sessions.flatMap((s) => s.exercises)));
      bumpData("settings");
      if (then !== "progresion") toast("Semana guardada", "success");
      if (then === "progresion") navigate(`/pacientes/${patientId}/ciclos/${ref.id}/progresion?${q}`);
      else navigate(`/pacientes/${patientId}/ciclos?${q}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
      setBusy(false);
    }
  }

  const effortWord = plan.effort === "rir" ? "RIR" : "RPE";
  return (
    <Page title={`Semana ${globalWeek + 1} · ${ref.name}`} backTo={`/pacientes/${patientId}/ciclos?${q}`} backLabel="Plan" tabs={false}>
      <p className="-mt-2 text-sm text-text-muted">
        Microciclo · {shortDay(from)} – {shortDay(to)} · {plan.perWeek === 1 ? "1 sesión" : `${plan.perWeek} sesiones`}
        {week > 0 ? " · lo que cambies aquí no lo pisa «Rellenar»" : ""}
      </p>
      <TextField label="Objetivo de la fase" hint="Opcional, en una línea" value={doc.goal} maxLength={120} onChange={(e) => setDoc({ ...doc, goal: e.target.value })} />

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented label="Sesiones tipo de la semana" options={doc.sessions.map((s) => s.id)} value={session.id} onChange={setTab} render={(sid) => `Sesión ${doc.sessions.find((s) => s.id === sid)!.label}`} />
        </div>
        {doc.sessions.length < LIMITS.sessions && (
          <IconButton
            label="Añadir otra sesión tipo"
            onClick={() => {
              const s = { id: crypto.randomUUID(), label: String.fromCharCode(65 + doc.sessions.length), exercises: [] };
              setDoc({ ...doc, sessions: [...doc.sessions, s] });
              setTab(s.id);
            }}
          >
            <Plus aria-hidden="true" className="size-5" />
          </IconButton>
        )}
      </div>
      {source && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted">Cargar</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Si es de otra fase, sus ejercicios vienen con ella.
              if (week === 0 && !session.exercises.length) {
                const prevRef = plan.phases[index - 1]!;
                const twin = phases[prevRef.id]!.sessions.find((s) => s.id === source.sessionId)!;
                setDoc((d) => ({ ...copyFromWeek(d, source.cells, week, session.id, source.sessionId), sessions: d.sessions.map((s) => (s.id === session.id ? { ...s, exercises: structuredClone(twin.exercises) } : s)) }));
              } else setDoc((d) => copyFromWeek(d, source.cells, week, session.id, source.sessionId));
            }}
          >
            Lo de la última sesión
          </Button>
        </div>
      )}

      <ol aria-label={`Ejercicios de la sesión ${session.label}`} className="flex flex-col gap-2">
        {session.exercises.map((ex, i) => {
          const dose = cells[ex.id] ?? {};
          const kg = ex.params.includes("pct") ? kgOfPct(ex.oneRm, dose.pct) : null;
          return (
            <li key={ex.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <input
                    aria-label={`Nombre del ejercicio ${i + 1}`}
                    value={ex.name}
                    onChange={(e) => setExercises((list) => list.map((x) => (x.id === ex.id ? { ...x, name: e.target.value } : x)))}
                    className="h-11 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-semibold hover:border-border-input focus:border-border-input"
                  />
                  <IconButton label={`Más de ${ex.name}`} aria-expanded={menu === ex.id} onClick={() => setMenu(menu === ex.id ? null : ex.id)}>
                    <Ellipsis aria-hidden="true" className="size-5" />
                  </IconButton>
                </div>
                {menu === ex.id && (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" icon={<ArrowUp aria-hidden="true" className="size-4" />} disabled={i === 0} onClick={() => setExercises((l) => swap(l, i, i - 1))}>
                      Subir
                    </Button>
                    <Button size="sm" variant="ghost" icon={<ArrowDown aria-hidden="true" className="size-4" />} disabled={i === session.exercises.length - 1} onClick={() => setExercises((l) => swap(l, i, i + 1))}>
                      Bajar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy aria-hidden="true" className="size-4" />}
                      disabled={session.exercises.length >= LIMITS.exercises}
                      onClick={() => {
                        const copy = { ...structuredClone(ex), id: crypto.randomUUID() };
                        setExercises((l) => [...l.slice(0, i + 1), copy, ...l.slice(i + 1)]);
                        setDose(copy.id, { ...dose });
                        setMenu(null);
                      }}
                    >
                      Duplicar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setExercises((l) => l.filter((x) => x.id !== ex.id))}>
                      Quitar
                    </Button>
                  </div>
                )}
                <DoseInputs ex={ex} dose={dose} effort={plan.effort} onChange={(d) => setDose(ex.id, d)} />
                {ex.params.includes("pct") && (
                  <p className="text-sm text-text-muted">
                    {kg !== null ? `≈ ${decimalText(kg)} kg (1RM aproximado: ${decimalText(ex.oneRm)} kg)` : "Sin 1RM: solo el porcentaje."}{" "}
                    <button type="button" onClick={() => setCalc(calc === ex.id ? null : ex.id)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
                      <Calculator aria-hidden="true" className="size-4" /> {ex.oneRm ? "Volver a calcular" : "Calcular el 1RM"}
                    </button>
                  </p>
                )}
                {calc === ex.id && <OneRmCalculator onUse={(rm) => setExercises((l) => l.map((x) => (x.id === ex.id ? { ...x, oneRm: rm } : x)))} onClose={() => setCalc(null)} />}
                {ex.how && howOf !== ex.id && <p className="text-sm whitespace-pre-line text-text-muted">Cómo se hace: {ex.how}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-expanded={paramsOf === ex.id}
                    onClick={() => setParamsOf(paramsOf === ex.id ? null : ex.id)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md border border-dashed border-border-input px-3 text-sm font-semibold text-accent hover:bg-surface"
                  >
                    <Plus aria-hidden="true" className="size-4" /> Parámetros<span className="sr-only"> de {ex.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-expanded={howOf === ex.id}
                    onClick={() => setHowOf(howOf === ex.id ? null : ex.id)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md border border-dashed border-border-input px-3 text-sm font-semibold text-accent hover:bg-surface"
                  >
                    <BookOpen aria-hidden="true" className="size-4" /> Cómo se hace<span className="sr-only"> {ex.name}</span>
                  </button>
                </div>
                {howOf === ex.id && (
                  <TextAreaField
                    label={`Cómo se hace ${ex.name}`}
                    hint="Para el paciente: sale en el enlace de la semana. Se recuerda para la próxima vez que uses este ejercicio."
                    rows={3}
                    maxLength={LIMITS.how}
                    value={ex.how ?? ""}
                    onChange={(e) => {
                      const how = e.target.value;
                      setExercises((l) => l.map((x) => (x.id === ex.id ? { ...x, how } : x)));
                    }}
                  />
                )}
                {paramsOf === ex.id && (
                <div role="group" aria-label={`Parámetros de ${ex.name}`} className="flex flex-wrap gap-1.5">
                  {ALL_PARAMS.filter((p) => p !== "effort" || plan.effort !== "none").map((p) => {
                    const on = ex.params.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setExercises((l) => l.map((x) => (x.id === ex.id ? { ...x, params: on ? x.params.filter((y) => y !== p) : [...x.params, p] } : x)))}
                        className={cx("min-h-11 min-w-11 rounded-pill border px-3 text-sm", on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border text-text-muted hover:bg-surface")}
                      >
                        {p === "effort" ? effortWord : paramLabel(p, plan.effort, ex).replace(/ \(.*\)$/, "")}
                      </button>
                    );
                  })}
                  {ex.params.includes("time") && (
                    <button
                      type="button"
                      onClick={() => setExercises((l) => l.map((x) => (x.id === ex.id ? { ...x, timeUnit: x.timeUnit === "s" ? "min" : "s" } : x)))}
                      className="min-h-11 rounded-pill border border-border px-3 text-sm text-accent hover:bg-surface"
                    >
                      Tiempo en {ex.timeUnit === "s" ? "segundos" : "minutos"}
                    </button>
                  )}
                </div>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      {session.exercises.length < LIMITS.exercises ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField label="Añadir un ejercicio" placeholder="Escribe un ejercicio" list="ciclos-ejercicios" value={adding} onChange={(e) => setAdding(e.target.value)} />
            <datalist id="ciclos-ejercicios">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <Button type="submit" variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} disabled={!adding.trim()}>
            Añadir
          </Button>
        </form>
      ) : (
        <Alert tone="info" title={`Como mucho ${LIMITS.exercises} ejercicios por sesión tipo`} />
      )}
      <p className="text-sm text-text-muted">Un ejercicio ya usado trae los parámetros de la última vez. Casilla vacía: ese parámetro no se usa.</p>

      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 flex flex-col gap-1 border-t border-border bg-canvas/95 px-4 py-2 backdrop-blur">
        {week === 0 && ref.weeks > 1 ? (
          <>
            <Button size="lg" block loading={busy} onClick={() => void save("progresion")}>
              Siguiente: cómo progresa
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => void save("plan")}>
              Guardar y ver el plan
            </Button>
          </>
        ) : (
          <Button size="lg" block loading={busy} onClick={() => void save("plan")}>
            Guardar la semana
          </Button>
        )}
      </div>
    </Page>
  );
}

const swap = <T,>(l: T[], a: number, b: number) => {
  const next = [...l];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
};

/** 1RM aproximado con los kilos y las repeticiones de una serie hasta el fallo o casi (fórmula de Epley). */
function OneRmCalculator({ onUse, onClose }: { onUse: (rm: number) => void; onClose: () => void }) {
  const [kg, setKg] = useState<number | undefined>();
  const [reps, setReps] = useState<number | undefined>();
  const rm = kg !== undefined && reps !== undefined ? oneRmEpley(kg, reps) : null;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
      <p className="text-sm font-semibold">1RM aproximado</p>
      <div className="grid grid-cols-2 gap-2">
        <NumCell label="Kilos levantados" value={kg} onChange={setKg} />
        <NumCell label="Repeticiones (1 a 12)" value={reps} onChange={setReps} />
      </div>
      <p className="text-sm" aria-live="polite">
        {rm !== null ? `1RM aproximado: ${decimalText(rm)} kg (fórmula de Epley).` : reps !== undefined && reps > 12 ? "Con más de 12 repeticiones no se calcula." : "Pon los kilos y las repeticiones."}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={rm === null}
          onClick={() => {
            onUse(rm!);
            onClose();
          }}
        >
          Usar este 1RM
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
