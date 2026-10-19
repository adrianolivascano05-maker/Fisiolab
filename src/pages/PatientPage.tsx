import { Activity, CalendarCheck, CalendarClock, Circle, CircleCheck, ClipboardList, FileText, ListChecks, NotebookPen, Pencil, Stethoscope, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { fmt, fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { clinicalSummary, regionLabel } from "../clinical/anamnesis";
import { CalendarButton, fmtVisit, visitEvent } from "../clinical/CalendarButton";
import { AnalysisNav, TrendTiles } from "../clinical/measureParts";
import { QuestionnaireTiles, SymmetryPanel } from "../clinical/outcomeParts";
import { PainChart, PatientNav, ResultBadge, sideShort } from "../clinical/parts";
import { LSI_REFERENCE, symmetryRows } from "../clinical/symmetry";
import { buildTimeline, painSeries, type EventKind } from "../clinical/timeline";
import { getAnamnesis, latestFindings, listFindings, listQuestionnaires, listSessions, nextVisit } from "../data/clinical";
import { getDb } from "../data/db";
import { getPatient, listTests, listWellness } from "../data/repo";
import { PrivacyCard } from "../privacy/PrivacyCard";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";

function age(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

/** Saltos: los que usan la masa y la distancia de empuje para la fuerza y la potencia. */
const JUMPS = new Set<string>(["cmj", "sj", "cmj_arms", "dj", "single_leg", "rj_10_5"]);

const chip = "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-input bg-bg px-3 text-sm font-semibold hover:bg-surface";

/** Una de las cuatro cosas que se hacen con un paciente: nombre grande y para qué sirve. */
function Action({ to, icon: Icon, title, text }: { to: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link to={to} className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-3 shadow-card hover:border-accent">
      <span className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-accent" /> {title}
      </span>
      <span className="text-sm leading-snug text-text-muted">{text}</span>
    </Link>
  );
}

type VisitStep = { to: string; title: string; text: string; done: boolean };

/** Guía de la primera visita: los pasos en orden, con lo hecho marcado. Desaparece al guardar la primera sesión. */
function FirstVisit({ id, steps }: { id: string; steps: VisitStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="primera-visita">
      <Card className="flex flex-col gap-2 border-accent">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="primera-visita" className="text-lg">
            Primera visita
          </h2>
          <span className="nums text-sm text-text-muted">
            {done} de {steps.length}
          </span>
        </div>
        <p className="text-sm text-text-muted">En este orden. Lo que ya esté hecho queda marcado.</p>
        <ol className="flex flex-col">
          {steps.map((s, i) => (
            <li key={s.to}>
              <Link to={`/pacientes/${id}/${s.to}`} className="flex min-h-14 items-start gap-3 rounded-md px-1 py-2 hover:bg-surface">
                {s.done ? (
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-muted" />
                )}
                <span className="flex flex-1 flex-col">
                  <span className={cx("font-semibold", s.done && "text-text-muted")}>
                    {i + 1}. {s.title}
                  </span>
                  {!s.done && <span className="text-sm text-text-muted">{s.text}</span>}
                </span>
                {s.done && <span className="pt-0.5 text-sm font-semibold text-success">Hecho</span>}
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

const kindStyle: Record<EventKind, { dot: string; label: string }> = {
  session: { dot: "bg-brand", label: "Sesión" },
  finding: { dot: "bg-danger", label: "Exploración" },
  test: { dot: "bg-accent", label: "Medición" },
  questionnaire: { dot: "bg-chart-right", label: "Cuestionario" },
  wellness: { dot: "bg-highlight", label: "Bienestar" },
  anamnesis: { dot: "bg-text-muted", label: "Anamnesis" },
};

/** S02 Ficha del paciente: resumen clínico y de mediciones de un vistazo. */
export function PatientPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, tests, wellness, anamnesis, sessions, findings, questionnaires] = await Promise.all([
      getPatient(db, id),
      listTests(db, id),
      listWellness(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      listFindings(db, id),
      listQuestionnaires(db, id),
    ]);
    return { patient, tests, wellness, anamnesis, sessions, findings, questionnaires };
  }, [id]);

  if (data.error) return <Page title="Paciente" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Paciente" backTo="/"><Loading /></Page>;
  const { patient, tests, wellness, anamnesis, sessions, findings, questionnaires } = data.data;
  if (!patient) return <Page title="Paciente" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  const years = age(patient.birthDate);
  const facts = [
    years !== null && `${years} años`,
    patient.bodyMassKg && `${fmt(patient.bodyMassKg)} kg`,
    patient.heightCm && `${fmt(patient.heightCm, 0)} cm`,
    patient.pushOffDistanceCm && `empuje ${fmt(patient.pushOffDistanceCm)} cm`,
  ].filter(Boolean);
  const summary = anamnesis ? clinicalSummary(anamnesis.answers) : null;
  const pain = painSeries({ sessions, wellness, anamnesis });
  const lastSession = sessions[0] ?? null;
  const visit = nextVisit(sessions);
  const review = lastSession?.reviewOn ?? null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const current = latestFindings(findings);
  const positives = current.filter((f) => f.result === "positive");
  const others = current.filter((f) => f.result !== "positive");
  const timeline = buildTimeline(id, { sessions, findings, tests, questionnaires, wellness, anamnesis }).slice(0, 8);
  const symmetry = symmetryRows(tests);
  const lowSymmetry = symmetry.filter((r) => r.lsi < LSI_REFERENCE);
  // Hasta cerrar la primera sesión, una guía de la primera visita en lugar de apartados vacíos.
  const firstVisit = sessions.length === 0;

  return (
    <Page title={patient.name} backTo="/">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-text-muted">{facts.length ? facts.join(" · ") : "Sin datos físicos"}</p>
        <div className="flex gap-2">
          <Link to={`/pacientes/${id}/informe`} className={chip}>
            <FileText aria-hidden="true" className="size-4 text-accent" /> Informe
          </Link>
          <Link to={`/pacientes/${id}/editar`} className={chip}>
            <Pencil aria-hidden="true" className="size-4 text-accent" /> Editar datos
          </Link>
        </div>
      </div>
      <PatientNav id={id} />
      {(!patient.bodyMassKg || !patient.pushOffDistanceCm) && tests.some((t) => JUMPS.has(t.type)) && (
        <Alert tone="info" title="Faltan datos para fuerza y potencia">
          Añade la masa y la distancia de empuje en <Link className="underline" to={`/pacientes/${id}/editar`}>editar datos</Link>. La altura del salto se calcula igualmente.
        </Alert>
      )}
      {firstVisit && (
        <FirstVisit
          id={id}
          steps={[
            { to: "proteccion-datos", title: "Protección de datos", text: "Que lea y firme la hoja; apunta sus consentimientos.", done: !!patient.privacy.informedAt },
            { to: "anamnesis", title: "Anamnesis", text: "Motivo de consulta, antecedentes, hábitos y objetivos.", done: !!anamnesis },
            { to: "exploracion/nuevo", title: "Exploración física", text: "Los tests que le hagas, positivos o negativos.", done: findings.length > 0 },
            { to: "test", title: "Medir (opcional)", text: "Salto, fuerza, movilidad… para comparar más adelante.", done: tests.length > 0 },
            { to: "sesiones/nueva", title: "Cerrar la visita", text: "Apunta el tratamiento, el plan y la siguiente cita.", done: false },
          ]}
        />
      )}
      <nav aria-label="Qué quieres hacer" className="grid grid-cols-2 gap-2">
        <Action to={`/pacientes/${id}/sesiones/nueva`} icon={NotebookPen} title="Nueva sesión" text="La visita de hoy: dolor, tratamiento y siguiente cita." />
        <Action to={`/pacientes/${id}/test`} icon={Activity} title="Nueva medición" text="Salto, fuerza, sprint, carrera o movilidad." />
        <Action to={`/pacientes/${id}/exploracion/nuevo`} icon={Stethoscope} title="Test de exploración" text="Lachman, Neer… positivo o negativo." />
        <Action to={`/pacientes/${id}/cuestionarios/nuevo`} icon={ListChecks} title="Nuevo cuestionario" text="PSFS, KOOS, LEFS, NDI…" />
      </nav>
      {!firstVisit && <PrivacyCard patientId={id} privacy={patient.privacy} />}
      {visit && (
        <Card className="flex items-center gap-3">
          <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
          <Link to={`/pacientes/${id}/sesiones`} className="flex-1 hover:underline">
            Próxima cita: <span className="font-semibold whitespace-nowrap">{fmtVisit(visit.nextAt!)}</span>
          </Link>
          <CalendarButton event={visitEvent(visit, patient)!} compact />
        </Card>
      )}

      {/* Lo clínico: por qué viene, banderas y dolor. */}
      {(!firstVisit || anamnesis) && (
      <section aria-labelledby="clinico" className="flex flex-col gap-2">
        <h2 id="clinico" className="text-lg">
          Motivo de consulta
        </h2>
        {summary && (summary.reason || summary.regions.length) ? (
          <Link to={`/pacientes/${id}/anamnesis`} className="block">
            <Card className="flex flex-col gap-1.5 hover:border-accent">
              {summary.reason && <p className="font-semibold">{summary.reason}</p>}
              {(summary.regions.length > 0 || summary.side) && (
                <p className="flex flex-wrap gap-1.5">
                  {summary.regions.map((r) => (
                    <span key={r} className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent">
                      {regionLabel(r)}
                    </span>
                  ))}
                  {summary.side && summary.side !== "No aplica" && <span className="rounded-pill bg-surface px-2.5 py-0.5 text-sm">{summary.side}</span>}
                </p>
              )}
              {summary.location && <p className="text-sm text-text-muted">Localización: {summary.location}</p>}
              {summary.diagnosis && <p className="text-sm">Diagnóstico fisioterápico: {summary.diagnosis}</p>}
              {summary.goal && <p className="text-sm text-text-muted">Objetivo: {summary.goal}</p>}
            </Card>
          </Link>
        ) : (
          <Link to={`/pacientes/${id}/anamnesis`} className="block">
            <Card className="flex items-center gap-3 border-dashed hover:border-accent">
              <ClipboardList aria-hidden="true" className="size-6 shrink-0 text-accent" />
              <span className="flex flex-col">
                <span className="font-semibold">Rellenar la anamnesis</span>
                <span className="text-sm text-text-muted">Motivo de consulta, antecedentes, hábitos, exploración física, diagnóstico y objetivos.</span>
              </span>
            </Card>
          </Link>
        )}
        {summary && summary.redFlags.length > 0 && (
          <Alert tone="danger" title={`Banderas rojas: ${summary.redFlags.length}`}>
            {summary.redFlags.join(" · ")}. Valora derivar.
          </Alert>
        )}
      </section>
      )}

      {(pain.length > 0 || review) && (
      <section aria-labelledby="dolor" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="dolor" className="text-lg">
            Dolor
          </h2>
          {pain.length > 0 && (
            <span className="nums text-sm text-text-muted">
              {pain.length === 1 ? "1 registro" : `${pain[0]!.pain} → ${pain.at(-1)!.pain} en ${pain.length} registros`}
            </span>
          )}
        </div>
        {pain.length > 0 && (
          <Card>
            <PainChart points={pain} label={`Dolor de 0 a 10: ${pain.map((p) => `${fmtDate(p.at)} ${p.pain}`).join(", ")}`} />
          </Card>
        )}
        {review && (
          <Link to={`/pacientes/${id}/sesiones`} className="block">
            <Card className={cx("flex items-center gap-3 hover:border-accent", review <= today && "border-warning bg-warning-soft")}>
              <CalendarClock aria-hidden="true" className={cx("size-5 shrink-0", review <= today ? "text-warning" : "text-accent")} />
              <span>
                {review < today ? "Reevaluación pendiente desde el" : review === today ? "Reevaluar hoy," : "Próxima reevaluación:"}{" "}
                <span className="font-semibold">{fmtDate(`${review}T12:00:00`)}</span>
              </span>
            </Card>
          </Link>
        )}
      </section>
      )}

      {current.length > 0 && (
      <section aria-labelledby="exploracion" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="exploracion" className="text-lg">
            Exploración
          </h2>
          <Link to={`/pacientes/${id}/exploracion`} className="text-sm font-semibold text-accent">
            Ver todo
          </Link>
        </div>
        <ul aria-label="Tests de exploración" className="flex flex-wrap gap-2">
            {[...positives, ...others].map((f) => (
              <li key={f.id}>
                <Link to={`/pacientes/${id}/exploracion/${f.id}`} className="block">
                  <ResultBadge result={f.result}>
                    {f.testName}
                    {f.side ? ` ${sideShort[f.side]}` : ""}
                    <span className="sr-only">: {f.result === "positive" ? "positivo" : f.result === "negative" ? "negativo" : "dudoso"}</span>
                  </ResultBadge>
                </Link>
              </li>
            ))}
          </ul>
      </section>
      )}

      {(tests.length > 0 || wellness.length > 0 || !firstVisit) && (
      <section aria-labelledby="mediciones" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="mediciones" className="text-lg">
            Mediciones
          </h2>
          {tests.length > 0 && (
            <Link to={`/pacientes/${id}/mediciones`} className="text-sm font-semibold text-accent">
              Ver todas ({tests.length})
            </Link>
          )}
        </div>
        <AnalysisNav id={id} tests={tests} wellness={wellness[0] ?? null} />
        {tests.length === 0 ? (
          <EmptyState icon={Activity} title="Sin mediciones todavía">
            Pulsa «Nueva medición» para registrar su primer salto o su movilidad.
          </EmptyState>
        ) : (
          <TrendTiles tests={tests} limit={6} />
        )}
        {lowSymmetry.length > 0 && (
          <>
            <h3 className="text-base">Simetría bajo el {LSI_REFERENCE} %</h3>
            <SymmetryPanel rows={lowSymmetry} />
          </>
        )}
      </section>
      )}

      {questionnaires.length > 0 && (
        <section aria-labelledby="cuestionarios" className="flex flex-col gap-2">
          <h2 id="cuestionarios" className="text-lg">
            Cuestionarios
          </h2>
          <QuestionnaireTiles patientId={id} items={questionnaires} />
        </section>
      )}

      {timeline.length > 0 && (
        <section aria-labelledby="historia" className="flex flex-col gap-2">
          <h2 id="historia" className="text-lg">
            Historia
          </h2>
          <ol aria-label="Historia del paciente" className="flex flex-col">
            {timeline.map((e, i) => (
              <li key={`${e.kind}-${e.at}-${i}`} className="relative flex gap-3 pb-3 pl-1">
                <span aria-hidden="true" className="flex w-3 flex-col items-center">
                  <span className={cx("mt-1.5 size-3 shrink-0 rounded-full", kindStyle[e.kind].dot)} />
                  {i < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </span>
                <Link to={e.to} className="flex min-w-0 flex-1 flex-col rounded-md hover:bg-surface">
                  <span className="text-xs text-text-muted">
                    {fmtDate(e.at)} · {kindStyle[e.kind].label}
                  </span>
                  <span className="truncate font-semibold">{e.title}</span>
                  {e.detail && <span className="truncate text-sm text-text-muted">{e.detail}</span>}
                </Link>
              </li>
            ))}
          </ol>
          {lastSession === null && current.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <TriangleAlert aria-hidden="true" className="size-4" /> Aún no hay sesiones registradas.
            </p>
          )}
        </section>
      )}
    </Page>
  );
}
