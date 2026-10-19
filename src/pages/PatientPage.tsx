import { Activity, CalendarCheck, CalendarClock, ClipboardList, FileText, ListChecks, NotebookPen, Pencil, Plus, Stethoscope, TriangleAlert } from "lucide-react";
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

const secondary = "tap inline-flex items-center justify-center gap-2 rounded-md border border-border-input bg-bg px-3 font-semibold hover:bg-surface";
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

  return (
    <Page
      title={patient.name}
      backTo="/"
      action={
        <>
          <Link to={`/pacientes/${id}/informe`} aria-label="Informe del paciente" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
            <FileText aria-hidden="true" className="size-5" />
          </Link>
          <Link to={`/pacientes/${id}/editar`} aria-label="Editar paciente" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        </>
      }
    >
      <p className="text-text-muted">{facts.length ? facts.join(" · ") : "Sin datos físicos"}</p>
      <PatientNav id={id} />
      {(!patient.bodyMassKg || !patient.pushOffDistanceCm) && (
        <Alert tone="info" title="Faltan datos para fuerza y potencia">
          Añade la masa y la distancia de empuje en <Link className="underline" to={`/pacientes/${id}/editar`}>editar</Link>. La altura del salto se calcula igualmente.
        </Alert>
      )}
      <Link
        to={`/pacientes/${id}/test`}
        className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover"
      >
        <Plus aria-hidden="true" className="size-5" /> Nueva medición
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/pacientes/${id}/sesiones/nueva`} className={secondary}>
          <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-accent" /> Nueva sesión
        </Link>
        <Link to={`/pacientes/${id}/exploracion/nuevo`} className={secondary}>
          <Stethoscope aria-hidden="true" className="size-5 shrink-0 text-accent" /> Registrar test
        </Link>
      </div>
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
        {pain.length ? (
          <Card>
            <PainChart points={pain} label={`Dolor de 0 a 10: ${pain.map((p) => `${fmtDate(p.at)} ${p.pain}`).join(", ")}`} />
          </Card>
        ) : (
          <p className="text-sm text-text-muted">Se dibuja con el dolor de la anamnesis y de cada sesión.</p>
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

      <section aria-labelledby="exploracion" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="exploracion" className="text-lg">
            Exploración
          </h2>
          {current.length > 0 && (
            <Link to={`/pacientes/${id}/exploracion`} className="text-sm font-semibold text-accent">
              Ver todo
            </Link>
          )}
        </div>
        {current.length ? (
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
        ) : (
          <p className="text-sm text-text-muted">Registra los tests que hagas (positivo, negativo o dudoso) y aparecerán aquí.</p>
        )}
      </section>

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
          <EmptyState icon={Activity} title="Sin tests todavía">
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

      <section aria-labelledby="cuestionarios" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="cuestionarios" className="text-lg">
            Cuestionarios
          </h2>
          <Link to={`/pacientes/${id}/cuestionarios/nuevo`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
            <ListChecks aria-hidden="true" className="size-4" /> Registrar cuestionario
          </Link>
        </div>
        {questionnaires.length ? (
          <QuestionnaireTiles patientId={id} items={questionnaires} />
        ) : (
          <p className="text-sm text-text-muted">PSFS, cambio global percibido o la puntuación de KOOS, LEFS, NDI… para ver si mejora con el tratamiento.</p>
        )}
      </section>

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
