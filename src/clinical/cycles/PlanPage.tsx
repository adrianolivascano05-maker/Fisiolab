// El plan por ciclos de un motivo: el macrociclo con su barra de fases, la fase en curso con la tabla ejercicios ×
// semanas (cada casilla se cambia a mano) y las demás fases en una línea. Cambiar de fase es siempre a mano.
import { CalendarPlus, ChevronDown, Pencil, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { bumpData } from "../../app/dataVersion";
import { Page } from "../../app/Page";
import {
  deletePlan,
  emptyPhase,
  extendPhase,
  finishPhase,
  phaseFromPrevious,
  phaseStart,
  savePhase,
  savePlan,
  setCell,
  shortDay,
  weekDays,
  type Dose,
  type PhaseDoc,
} from "../../data/cycles";
import { getDb } from "../../data/db";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { Guard } from "../pageKit";
import { PhaseTable } from "./PhaseTable";
import { DoseInputs, PhaseBar, planToday, usePlan, usePlanParams } from "./parts";

type Confirm = { kind: "pasar" | "alargar" | "quitar" };

export function PlanPage() {
  const { id = "" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const data = usePlan(id, motivo);
  if (!data.data) return <Guard state={data} title="Plan por ciclos" back={volver} />;
  if (!data.data.loaded) return <Navigate replace to={`/pacientes/${id}/ciclos/nuevo?motivo=${encodeURIComponent(data.data.episode)}&volver=${encodeURIComponent(volver)}`} />;
  return <PlanView patientId={id} data={data.data} volver={volver} reload={data.reload} />;
}

function PlanView({ patientId, data, volver, reload }: { patientId: string; data: NonNullable<ReturnType<typeof usePlan>["data"]>; volver: string; reload: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { plan, phases } = data.loaded!;
  const { week, at, total } = planToday(plan);
  // La fase abierta: la de hoy (o la primera antes de empezar, la última después de acabar).
  const current = at?.index ?? (week < 0 ? 0 : plan.phases.length - 1);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ phase: PhaseDoc; week: number; sessionId: string; exId: string; dose: Dose } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;
  const base = `/pacientes/${patientId}/ciclos`;
  const ref = plan.phases[current]!;
  const doc = phases[ref.id];

  async function run(work: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await work();
      bumpData("settings");
      toast(done, "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
      setConfirm(null);
      setEditing(null);
    }
  }

  /** «Poner ejercicios» en una fase sin ellos: empieza con la última semana normal de la anterior, si la tiene. */
  async function startPhase(i: number) {
    const r = plan.phases[i]!;
    const prev = i > 0 ? phases[plan.phases[i - 1]!.id] : undefined;
    const next = prev?.sessions.some((s) => s.exercises.length) ? phaseFromPrevious(prev, plan.deload, r.id, r.weeks) : emptyPhase(r.id, r.weeks);
    await savePhase(getDb(), patientId, data.episode, next);
    bumpData("settings");
    navigate(`${base}/${r.id}/semana/0?${q}`);
  }

  const todayText =
    week < 0 ? `Empieza el ${shortDay(plan.start)}` : week >= total ? `Terminado el ${shortDay(weekDays(plan, total - 1)[1])}` : `Semana ${week + 1} de ${total} · ${shortDay(weekDays(plan, week)[0] < plan.start ? plan.start : weekDays(plan, week)[0])}`;

  return (
    <Page title="Plan por ciclos" backTo={volver} backLabel="Volver" tabs={false}>
      <p className="-mt-2 text-sm text-text-muted">
        {data.patient?.name}
        {data.episodeName ? ` · ${data.episodeName}` : ""}
      </p>
      <Card className="flex flex-col gap-2">
        <h2 className="text-xl">{plan.goal || "Sin objetivo escrito"}</h2>
        <PhaseBar plan={plan} week={week} />
        <p className="text-sm text-text-muted">
          {todayText}
          {at ? ` · hoy` : ""}
        </p>
      </Card>

      <ol aria-label="Fases" className="flex flex-col gap-2">
        {plan.phases.map((p, i) => {
          const d = phases[p.id];
          const has = !!d?.sessions.some((s) => s.exercises.length);
          const isOpen = open === null ? i === current : open === p.id;
          const today = at?.index === i ? at.week : i < current || week >= total ? p.weeks : null;
          const first = phaseStart(plan, i);
          return (
            <li key={p.id}>
              <Card className={cx("flex flex-col gap-2", isOpen && "border-accent")}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : p.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-accent transition-transform", !isOpen && "-rotate-90")} />
                    <span className="min-w-0">
                      <span className="font-semibold">
                        {i + 1} · {p.name}
                      </span>
                      <span className="text-sm text-text-muted">
                        {" "}
                        · {p.weeks === 1 ? "1 semana" : `${p.weeks} semanas`} · {shortDay(weekDays(plan, first)[0])}
                        {has ? "" : " · sin ejercicios aún"}
                      </span>
                    </span>
                  </button>
                </div>
                {!has && (
                  <Button size="sm" variant="ghost" className="self-start" onClick={() => void startPhase(i)}>
                    Poner ejercicios
                  </Button>
                )}
                {isOpen && (
                  <>
                    {d?.goal && <p className="text-sm">{d.goal}</p>}
                    {has && d ? (
                      <>
                        <p className="text-sm text-text-muted">
                          {d.sessions.filter((s) => s.exercises.length).length > 1 ? `${d.sessions.filter((s) => s.exercises.length).length} sesiones tipo` : "Sesión A"} · {plan.perWeek} por semana
                        </p>
                        <PhaseTable
                          doc={d}
                          weeks={p.weeks}
                          deload={plan.deload && p.weeks > 1}
                          effort={plan.effort}
                          label={`${i + 1} · ${p.name}`}
                          today={today}
                          onCell={(w, sessionId, exId, dose) => setEditing({ phase: d, week: w, sessionId, exId, dose })}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Link to={`${base}/${p.id}/semana/${at?.index === i ? at.week : 0}?${q}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface">
                            <Pencil aria-hidden="true" className="size-4" /> Ejercicios de la semana {at?.index === i ? at.week + 1 : 1}
                          </Link>
                          {p.weeks > 1 && (
                            <Link to={`${base}/${p.id}/progresion?${q}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface">
                              <TrendingUp aria-hidden="true" className="size-4" /> Cómo progresa
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-muted">Al poner ejercicios en una fase nueva, empieza con la última semana normal de la anterior.</p>
                    )}
                    {at?.index === i && (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                        {i < plan.phases.length - 1 && at.week < at.weeks - 1 && (
                          <Button size="sm" variant="secondary" onClick={() => setConfirm({ kind: "pasar" })}>
                            Pasar a la siguiente fase
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" icon={<CalendarPlus aria-hidden="true" className="size-4" />} onClick={() => setConfirm({ kind: "alargar" })}>
                          Alargar 1 semana
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Link to={`${base}/nuevo?${q}&editar=1`} className="inline-flex min-h-11 items-center rounded-md border border-border-input bg-bg px-4 font-semibold hover:bg-surface">
          Cambiar el plan
        </Link>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm({ kind: "quitar" })}>
          Quitar el plan
        </Button>
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `Semana ${editing.week + 1}: ${editing.phase.sessions.flatMap((s) => s.exercises).find((e) => e.id === editing.exId)?.name ?? ""}` : ""}>
        {editing && (
          <>
            <DoseInputs
              ex={editing.phase.sessions.flatMap((s) => s.exercises).find((e) => e.id === editing.exId)!}
              dose={editing.dose}
              effort={plan.effort}
              onChange={(dose) => setEditing({ ...editing, dose })}
            />
            <p className="text-sm text-text-muted">Lo que cambies aquí no lo pisa «Rellenar» sin preguntar.</p>
            <Button block loading={busy} onClick={() => void run(() => savePhase(getDb(), patientId, data.episode, setCell(editing.phase, editing.week, editing.sessionId, editing.exId, editing.dose)), "Casilla cambiada")}>
              Guardar
            </Button>
          </>
        )}
      </Sheet>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "quitar" ? "¿Quitar el plan?" : confirm?.kind === "pasar" ? "¿Pasar a la siguiente fase?" : "¿Alargar 1 semana?"}>
        {confirm?.kind === "quitar" ? (
          <>
            <p>Se quitan las fases y sus ejercicios. Las sesiones y lo que se escribió en ellas no se borran.</p>
            <Button block variant="danger" loading={busy} onClick={() => void run(() => deletePlan(getDb(), patientId, data.episode), "Plan quitado").then(() => navigate(volver, { replace: true }))}>
              Sí, quitar el plan
            </Button>
          </>
        ) : confirm && at ? (
          <>
            <p>
              {confirm.kind === "pasar"
                ? `«${ref.name}» acaba esta semana y la siguiente fase empieza el ${shortDay(weekDays(plan, week + 1)[0])}. Las fases siguientes se adelantan ${at.weeks - at.week - 1 === 1 ? "1 semana" : `${at.weeks - at.week - 1} semanas`}.`
                : `«${ref.name}» tendrá una semana más. Las fases siguientes se mueven 1 semana.`}
            </p>
            <Button
              block
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const out = confirm.kind === "pasar" ? finishPhase(plan, doc ?? null, current, at.week) : extendPhase(plan, doc ?? null, current);
                  await savePlan(getDb(), patientId, data.episode, out.plan, out.doc ? [out.doc] : []);
                }, confirm.kind === "pasar" ? "Pasado a la siguiente fase" : "Fase alargada")
              }
            >
              {confirm.kind === "pasar" ? "Sí, pasar a la siguiente fase" : "Sí, alargar 1 semana"}
            </Button>
          </>
        ) : null}
        <Button block variant="secondary" onClick={() => setConfirm(null)}>
          No
        </Button>
      </Sheet>
    </Page>
  );
}
