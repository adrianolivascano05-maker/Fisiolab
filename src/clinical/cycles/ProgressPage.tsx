// «Cómo progresa» una fase: una regla para todos o una por ejercicio, la descarga de la última semana y la vista previa
// de todas las semanas. La app solo hace la cuenta elegida; lo cambiado a mano no se pisa sin preguntar.
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { bumpData } from "../../app/dataVersion";
import { Page } from "../../app/Page";
import { emptyPhase, fillPhase, LIMITS, RULE_LABELS, rulesFor, savePhase, type PhaseDoc, type Rule } from "../../data/cycles";
import { getDb } from "../../data/db";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { NumberField } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { Guard } from "../pageKit";
import { PhaseTable } from "./PhaseTable";
import { phaseChip } from "./phaseColors";
import { usePlan, usePlanParams } from "./parts";

const FOR_ALL: Rule[] = ["same", "rep1", "pct5"];

export function ProgressPage() {
  const { id = "", fase = "" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const data = usePlan(id, motivo);
  if (!data.data) return <Guard state={data} title="Cómo progresa" back={volver} />;
  const loaded = data.data.loaded;
  const index = loaded ? loaded.plan.phases.findIndex((p) => p.id === fase) : -1;
  if (!loaded || index < 0) return <Guard state={{ ...data, error: new Error("Este plan o esta fase ya no existen.") }} title="Cómo progresa" back={volver} />;
  return <Progress key={fase} patientId={id} data={data.data} index={index} volver={volver} />;
}

function Progress({ patientId, data, index, volver }: { patientId: string; data: NonNullable<ReturnType<typeof usePlan>["data"]>; index: number; volver: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { plan, phases } = data.loaded!;
  const ref = plan.phases[index]!;
  const [doc, setDoc] = useState<PhaseDoc>(() => phases[ref.id] ?? emptyPhase(ref.id, ref.weeks));
  const [kept, setKept] = useState(0);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const deload = plan.deload && ref.weeks > 1;
  const preview = fillPhase(doc, { weeks: ref.weeks, deload }).doc;
  const all = doc.sessions.flatMap((s) => s.exercises);
  const forAll = all.length && all.every((e) => e.rule === all[0]!.rule) ? all[0]!.rule : null;
  const setRule = (exId: string | null, rule: Rule) => setDoc((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => (exId === null || e.id === exId ? { ...e, rule } : e)) })) }));
  const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;

  async function fill(overwrite: boolean) {
    setBusy(true);
    try {
      const out = fillPhase(doc, { weeks: ref.weeks, deload, overwrite });
      await savePhase(getDb(), patientId, data.episode, out.doc);
      bumpData("settings");
      setDoc(out.doc);
      setKept(out.kept);
      toast(`Semanas rellenadas${out.kept ? `; ${out.kept === 1 ? "1 casilla cambiada a mano no se ha tocado" : `${out.kept} casillas cambiadas a mano no se han tocado`}` : ""}`, "success");
      if (!out.kept) navigate(`/pacientes/${patientId}/ciclos?${q}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <Page title="Cómo progresa" backTo={`/pacientes/${patientId}/ciclos?${q}`} backLabel="Plan" tabs={false}>
      <p className="-mt-2 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
        <span className={cx("rounded-pill px-2 py-0.5 font-semibold", phaseChip(index))}>
          {index + 1} · {ref.name}
        </span>
        Mesociclo · {ref.weeks === 1 ? "1 semana" : `${ref.weeks} semanas`}
      </p>
      {!all.length ? (
        <Alert tone="info" title="Esta fase aún no tiene ejercicios">
          Ponlos en la semana 1 y vuelve aquí.
        </Alert>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Cada semana, respecto a la anterior</h2>
            <div role="group" aria-label="Para todos" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-muted">Para todos</span>
              {FOR_ALL.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={forAll === r}
                  onClick={() => setRule(null, r)}
                  className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", forAll === r ? "border-accent bg-accent text-on-accent" : "border-border bg-bg hover:bg-surface")}
                >
                  {RULE_LABELS[r]}
                </button>
              ))}
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {doc.sessions.flatMap((s) =>
                s.exercises.map((e) => (
                  <li key={`${s.id}:${e.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 font-semibold">
                      {e.name}
                      {doc.sessions.length > 1 && <span className="font-normal text-text-muted"> · sesión {s.label}</span>}
                    </span>
                    <select
                      aria-label={`Cómo progresa ${e.name}`}
                      value={e.rule}
                      onChange={(ev) => setRule(e.id, ev.target.value as Rule)}
                      className="h-11 shrink-0 rounded-pill border border-border-input bg-bg px-3 text-sm font-semibold"
                    >
                      {rulesFor(plan.effort).map((r) => (
                        <option key={r} value={r}>
                          {RULE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </li>
                )),
              )}
            </ul>
            {deload && (
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                <p className="font-semibold">Semana {ref.weeks}: descarga</p>
                <p className="text-sm text-text-muted">Una serie menos y menos carga; repeticiones y esfuerzo, iguales.</p>
                <NumberField
                  label="Carga que se quita"
                  unit="%"
                  value={String(doc.deloadPct)}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n)) setDoc({ ...doc, deloadPct: Math.max(0, Math.min(LIMITS.deloadPct, Math.round(n))) });
                  }}
                />
              </div>
            )}
          </Card>
          <PhaseTable doc={preview} weeks={ref.weeks} deload={deload} effort={plan.effort} label="Vista previa" phase={index} />
          <p className="text-sm text-text-muted">La app solo hace la cuenta que eliges. Cualquier casilla se cambia a mano.</p>
          {kept > 0 && (
            <Alert tone="info" title={kept === 1 ? "Una casilla cambiada a mano no se ha tocado" : `${kept} casillas cambiadas a mano no se han tocado`}>
              <Button size="sm" variant="secondary" className="mt-1" onClick={() => setAsking(true)}>
                Rellenarlas también
              </Button>
            </Alert>
          )}
        </>
      )}
      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 border-t border-border bg-canvas/95 px-4 py-2 backdrop-blur">
        <Button size="lg" block loading={busy} disabled={!all.length} onClick={() => void fill(false)}>
          Rellenar las {ref.weeks} semanas
        </Button>
      </div>
      <Sheet open={asking} onClose={() => setAsking(false)} title="¿Pisar lo cambiado a mano?">
        <p>Las casillas que cambiaste a mano pasan a tener la cuenta de la regla. Lo de las sesiones ya apuntadas no se toca.</p>
        <Button block loading={busy} onClick={() => void fill(true)}>
          Sí, rellenarlas también
        </Button>
        <Button block variant="secondary" onClick={() => setAsking(false)}>
          No, dejarlas
        </Button>
      </Sheet>
    </Page>
  );
}
