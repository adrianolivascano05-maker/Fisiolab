import { Activity, CalendarClock, ClipboardList, FileCheck, FilePen, FileText, ListChecks, NotebookPen, ShieldAlert, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { clinicalSummary, regionLabel } from "../clinical/anamnesis";
import { AnalysisNav, TrendTiles } from "../clinical/measureParts";
import { QuestionnaireTiles, SymmetryPanel } from "../clinical/outcomeParts";
import { PainChart, ResultBadge, sideShort } from "../clinical/parts";
import { PatientShell } from "../clinical/PatientShell";
import { LSI_REFERENCE, symmetryRows } from "../clinical/symmetry";
import { buildTimeline, painSeries, type EventKind } from "../clinical/timeline";
import { getAnamnesis, latestFindings, listFindings, listQuestionnaires, listSessions } from "../data/clinical";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";
import { listConsents } from "../data/consents";
import { getDb } from "../data/db";
import { CONSENTS } from "../data/privacy";
import { getPatient, listTests, listWellness } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { Group, RowLink } from "../ui/Grouped";

/** Saltos: los que usan el peso y la distancia de empuje para la fuerza y la potencia. */
const JUMPS = new Set<string>(["cmj", "sj", "cmj_arms", "dj", "single_leg", "rj_10_5"]);

/** Un botón de «Añadir»: icono y nombre, como los de la ficha de un contacto en el móvil. */
function Add({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-1 text-xs font-semibold shadow-card hover:border-accent">
      <Icon aria-hidden="true" className="size-6 text-accent" />
      {label}
    </Link>
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
    const [patient, tests, wellness, anamnesis, sessions, findings, questionnaires, signed] = await Promise.all([
      getPatient(db, id),
      listTests(db, id),
      listWellness(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      listFindings(db, id),
      listQuestionnaires(db, id),
      listConsents(db, id),
    ]);
    return { patient, tests, wellness, anamnesis, sessions, findings, questionnaires, signed };
  }, [id]);

  if (data.error) return <Page title="Paciente" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Paciente" backTo="/"><Loading /></Page>;
  const { patient, tests, wellness, anamnesis, sessions, findings, questionnaires, signed } = data.data;
  if (!patient) return <Page title="Paciente" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  // Consentimientos: los firmados vigentes y los que su anamnesis pide por escrito y faltan.
  const consentCtx = consentContext(patient, anamnesis?.answers ?? {});
  const inForce = signed.filter((c) => !c.revokedAt);
  const missing = TEMPLATES.filter((t) => t.written === "required" && t.suggest(consentCtx) && !inForce.some((c) => c.template === t.id));

  const summary = anamnesis ? clinicalSummary(anamnesis.answers) : null;
  const pain = painSeries({ sessions, wellness, anamnesis });
  const lastSession = sessions[0] ?? null;
  const review = lastSession?.reviewOn ?? null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const current = latestFindings(findings);
  const positives = current.filter((f) => f.result === "positive");
  const others = current.filter((f) => f.result !== "positive");
  const timeline = buildTimeline(id, { sessions, findings, tests, questionnaires, wellness, anamnesis }).slice(0, 8);
  const symmetry = symmetryRows(tests);
  const lowSymmetry = symmetry.filter((r) => r.lsi < LSI_REFERENCE);
  const privacy = patient.privacy;
  const consents = CONSENTS.filter((c) => privacy.consents?.[c.id] !== undefined).map((c) => `${c.label}: ${privacy.consents![c.id] ? "sí" : "no"}`);

  return (
    <PatientShell patient={patient} id={id}>
      <section aria-labelledby="h-anadir" className="flex flex-col gap-1.5">
        <h2 id="h-anadir" className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase" style={{ fontFamily: "var(--font-sans)" }}>
          Añadir
        </h2>
        <nav aria-label="Añadir" className="grid grid-cols-4 gap-2">
          <Add to={`/pacientes/${id}/sesiones/nueva`} icon={NotebookPen} label="Sesión" />
          <Add to={`/pacientes/${id}/test`} icon={Activity} label="Medición" />
          <Add to={`/pacientes/${id}/exploracion/nuevo`} icon={Stethoscope} label="Exploración" />
          <Add to={`/pacientes/${id}/cuestionarios/nuevo`} icon={ListChecks} label="Cuestionario" />
        </nav>
      </section>

      {(!patient.bodyMassKg || !patient.pushOffDistanceCm) && tests.some((t) => JUMPS.has(t.type)) && (
        <Alert tone="info" title="Faltan datos para fuerza y potencia">
          Añade el peso y la distancia de empuje en <Link className="underline" to={`/pacientes/${id}/editar`}>Editar</Link>. La altura del salto se calcula igualmente.
        </Alert>
      )}
      {review && review <= today && (
        <Link to={`/pacientes/${id}/sesiones`} className="block">
          <Card className="flex items-center gap-3 border-warning bg-warning-soft hover:border-accent">
            <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-warning" />
            <span>
              {review < today ? "Reevaluación pendiente desde el" : "Reevaluar hoy,"} <span className="font-semibold">{fmtDate(`${review}T12:00:00`)}</span>
            </span>
          </Card>
        </Link>
      )}

      <Group>
        <RowLink
          to={`/pacientes/${id}/anamnesis`}
          icon={ClipboardList}
          title="Anamnesis"
          subtitle={anamnesis ? `Actualizada el ${fmtDate(anamnesis.updatedAt)}` : "Sin rellenar"}
        />
        <RowLink
          to={`/pacientes/${id}/proteccion-datos`}
          icon={privacy.informedAt ? ShieldCheck : ShieldAlert}
          tone={privacy.informedAt ? "accent" : "warning"}
          title="Protección de datos"
          subtitle={privacy.informedAt ? [`Informado el ${fmtDate(`${privacy.informedAt}T12:00:00`)}`, ...consents].join(" · ") : "Pendiente: hoja para imprimir y firmar"}
          warn={!privacy.informedAt}
        />
        <RowLink
          to={`/pacientes/${id}/consentimientos`}
          icon={FilePen}
          tone={missing.length ? "warning" : "accent"}
          title="Consentimientos"
          subtitle={
            missing.length
              ? `Falta por escrito: ${missing.map((t) => t.title.toLowerCase()).join(", ")}`
              : inForce.length
                ? `${inForce.length === 1 ? "1 firmado" : `${inForce.length} firmados`}`
                : "Se preparan con su anamnesis"
          }
          warn={missing.length > 0}
        />
        <RowLink to={`/pacientes/${id}/informe`} icon={FileText} title="Informe" subtitle="Completo o de alta; imprimir o guardar en PDF" />
        <RowLink to={`/pacientes/${id}/justificante`} icon={FileCheck} title="Justificante de asistencia" subtitle="Para su trabajo o su centro de estudios" />
      </Group>

      {/* Lo clínico: por qué viene, banderas y dolor. */}
      {summary && (summary.reason || summary.regions.length > 0 || summary.redFlags.length > 0) && (
      <section aria-labelledby="clinico" className="flex flex-col gap-2">
        <h2 id="clinico" className="text-lg">
          Motivo de consulta
        </h2>
        {summary.reason || summary.regions.length ? (
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
        ) : null}
        {summary.redFlags.length > 0 && (
          <Alert tone="danger" title={`Banderas rojas: ${summary.redFlags.length}`}>
            {summary.redFlags.join(" · ")}. Valora derivar.
          </Alert>
        )}
      </section>
      )}

      {(pain.length > 0 || (review && review > today)) && (
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
        {review && review > today && (
          <Link to={`/pacientes/${id}/sesiones`} className="block">
            <Card className="flex items-center gap-3 hover:border-accent">
              <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span>
                Próxima reevaluación: <span className="font-semibold">{fmtDate(`${review}T12:00:00`)}</span>
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

      {(tests.length > 0 || wellness.length > 0) && (
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
        {tests.length > 0 && <TrendTiles tests={tests} limit={6} />}
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
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="cuestionarios" className="text-lg">
              Cuestionarios
            </h2>
            <Link to={`/pacientes/${id}/cuestionarios`} className="text-sm font-semibold text-accent">
              Ver todos
            </Link>
          </div>
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
        </section>
      )}
    </PatientShell>
  );
}
