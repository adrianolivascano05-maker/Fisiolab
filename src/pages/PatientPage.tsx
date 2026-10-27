import { Activity, CalendarClock, ClipboardList, Dumbbell, FileCheck, FilePen, FileText, Files, Hourglass, ListChecks, NotebookPen, Scale, Send, ShieldAlert, ShieldCheck, Stethoscope, TriangleAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { SHOW_EXERCISES } from "../app/features";
import { fmtDate, testTitle } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { clinicalSummary, regionLabel } from "../clinical/anamnesis";
import { useCloud } from "../cloud/CloudGate";
import { mainValue } from "../clinical/measures";
import { questionnaireGroups } from "../clinical/outcomeParts";
import { PatientShell } from "../clinical/PatientShell";
import { kindOf, scoreText, type QDetails } from "../clinical/questionnaires";
import { redFlagReview } from "../clinical/redFlags";
import { LSI_REFERENCE, symmetryRows } from "../clinical/symmetry";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";
import { accountLine, patientAccount } from "../data/billing";
import { getAnamnesis, listQuestionnaires, listSessions } from "../data/clinical";
import { listConsents } from "../data/consents";
import { countDocuments } from "../data/documents";
import { getDb } from "../data/db";
import { listPlans } from "../data/exercises";
import { CONSENTS } from "../data/privacy";
import { getPatient, listTests } from "../data/repo";
import { listWaitlist, preferText } from "../data/waitlist";
import { Card } from "../ui/Card";
import { Group, RowLink } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";

const dayText = (d: string) => fmtDate(`${d}T12:00:00`);

/** S02 Ficha del paciente › Resumen: las dos acciones de cada día (sesión y valorar), cómo está (una tarjeta que informa,
 * no un menú), lo que falta y, en tres grupos, sus documentos, lo legal y su cuenta. Cada cosa sale una sola vez: la
 * anamnesis, la valoración y las sesiones tienen su pestaña. */
export function PatientPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => {
    const db = getDb();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const [patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, waitlist, files] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      listQuestionnaires(db, id),
      listTests(db, id),
      listConsents(db, id),
      patientAccount(db, id, today),
      listPlans(db, id),
      listWaitlist(db),
      countDocuments(db, id),
    ]);
    return { patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, today, files, waiting: waitlist.find((w) => w.patientId === id) ?? null };
  }, [id]);
  const [assessing, setAssessing] = useState(false);
  const cloud = useCloud();

  if (data.error) return <Page title="Paciente" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Paciente" backTo="/"><Loading /></Page>;
  const { patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, today, files, waiting } = data.data;
  if (!patient) return <Page title="Paciente" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  // Consentimientos: los firmados vigentes y los que su anamnesis pide por escrito y faltan.
  const consentCtx = consentContext(patient, anamnesis?.answers ?? {});
  const inForce = signed.filter((c) => !c.revokedAt);
  const missing = TEMPLATES.filter((t) => t.written === "required" && t.suggest(consentCtx) && !inForce.some((c) => c.template === t.id));
  const privacy = patient.privacy;
  const optional = CONSENTS.filter((c) => privacy.consents?.[c.id] !== undefined).map((c) => `${c.label}: ${privacy.consents![c.id] ? "sí" : "no"}`);

  const summary = anamnesis ? clinicalSummary(anamnesis.answers) : null;
  const alarms = anamnesis ? redFlagReview(anamnesis.answers, patient.birthDate) : null;
  const last = sessions[0] ?? null;
  const review = last?.reviewOn ?? null;
  const lastGroup = questionnaireGroups(questionnaires)[0];
  const lastQ = lastGroup?.items[0];
  const lastTest = tests[0];
  const lastValue = lastTest ? mainValue(lastTest) : null;
  const lowSymmetry = symmetryRows(tests).filter((r) => r.lsi < LSI_REFERENCE);
  const headline = summary?.diagnosis || summary?.reason || "";
  const where = [...(summary?.regions ?? []).map(regionLabel), summary?.side && summary.side !== "No aplica" ? summary.side.toLowerCase() : ""].filter(Boolean).join(" · ");
  const hasSituation = !!(headline || where || alarms?.hits.length || last || lastQ || lastTest);
  const pending = missing.length > 0 || !privacy.informedAt || (review !== null && review < today);

  return (
    <PatientShell patient={patient} id={id}>
      {/* En ancho (el ordenador), dos columnas: lo de hoy (acciones, situación, pendiente) y, al lado, sus documentos,
          lo legal y su cuenta. En el móvil, todo seguido en este mismo orden. */}
      <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-x-6">
        <div className="flex flex-col gap-4">
          {/* Las dos acciones de cada visita. */}
          <div className="grid grid-cols-[3fr_2fr] gap-2">
        <Link to={`/pacientes/${id}/sesiones/nueva`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
          <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAssessing(true)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 font-semibold hover:bg-surface"
        >
          <Stethoscope aria-hidden="true" className="size-5 text-accent" /> Valorar
        </button>
      </div>

      <section aria-labelledby="h-situacion" className="flex flex-col gap-2">
        <h2 id="h-situacion" className="text-lg">
          Situación
        </h2>
        <Card className="flex flex-col gap-2">
          {!hasSituation && (
            <p className="text-text-muted">
              Sin datos todavía.{" "}
              <Link to={`/pacientes/${id}/anamnesis`} className="font-semibold text-accent underline underline-offset-2">
                Empieza por la anamnesis
              </Link>
              .
            </p>
          )}
          {(headline || where) && (
            <p className="flex flex-col">
              {headline && <span className="line-clamp-2 font-semibold">{headline}</span>}
              {where && <span className="text-sm text-text-muted">{where}</span>}
            </p>
          )}
          {alarms && alarms.hits.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">
                  {alarms.patterns.length ? `Alarmas: ${alarms.patterns.map((p) => `${p.pattern.name} (${p.pattern.urgency})`).join(" · ")}` : `Banderas rojas: ${alarms.hits.length}`}
                </span>{" "}
                ·{" "}
                <Link to={`/pacientes/${id}/anamnesis`} className="font-semibold underline underline-offset-2">
                  ver
                </Link>
              </span>
            </p>
          )}
          {last && (
            <p className="text-sm">
              <span className="font-semibold">Última sesión</span> · {fmtDate(last.performedAt)}
              {last.pain !== null && ` · dolor ${last.pain}/10`}
              {last.treatment && <span className="block line-clamp-1 text-text-muted">{last.treatment}</span>}
            </p>
          )}
          {lastGroup && lastQ && (
            <p className="text-sm">
              <span className="font-semibold">Último cuestionario</span> · {lastGroup.name} {scoreText(kindOf(lastQ.kind, lastQ.details as QDetails), lastQ.score)} · {fmtDate(lastQ.performedAt)}
            </p>
          )}
          {lastTest && (
            <p className="text-sm">
              <span className="font-semibold">Última medición</span> · {testTitle(lastTest)}
              {lastValue ? ` ${lastValue.text}${lastValue.unit === "°" ? "°" : lastValue.unit ? ` ${lastValue.unit}` : ""}` : ""} · {fmtDate(lastTest.performedAt)}
            </p>
          )}
          {lowSymmetry.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-danger">
              <Scale aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">Simetría bajo el {LSI_REFERENCE} %:</span> {lowSymmetry.map((r) => `${r.title} ${Math.round(r.lsi)} %`).join(" · ")} ·{" "}
                <Link to={`/pacientes/${id}/valoracion#mediciones`} className="font-semibold underline underline-offset-2">
                  ver
                </Link>
              </span>
            </p>
          )}
          {review && review >= today && (
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-accent" /> {review === today ? "Reevaluar hoy" : `Reevaluar el ${dayText(review)}`}
            </p>
          )}
        </Card>
      </section>

      {pending && (
        <Group title="Pendiente">
          {review && review < today && (
            <RowLink to={`/pacientes/${id}/valoracion`} icon={CalendarClock} tone="warning" title="Reevaluación pendiente" subtitle={`Desde el ${dayText(review)}`} warn />
          )}
          {missing.length > 0 && (
            <RowLink
              to={`/pacientes/${id}/consentimientos`}
              icon={FilePen}
              tone="warning"
              title={missing.length === 1 ? `Consentimiento sin firmar: ${missing[0]!.title.toLowerCase()}` : `${missing.length} consentimientos sin firmar`}
              subtitle={missing.length === 1 ? "Por escrito, según su anamnesis" : missing.map((t) => t.title.toLowerCase()).join(", ")}
              warn
            />
          )}
          {!privacy.informedAt && (
            <RowLink to={`/pacientes/${id}/proteccion-datos`} icon={ShieldAlert} tone="warning" title="Hoja de protección de datos sin entregar" subtitle="Para imprimir y que la firme" warn />
          )}
        </Group>
      )}

        </div>
        <div className="flex flex-col gap-4">
      <Group title="Documentos">
        <RowLink to={`/pacientes/${id}/informe`} icon={FileText} title="Informe" subtitle="Para el paciente o su médico" />
        <RowLink to={`/pacientes/${id}/alta`} icon={FileCheck} title="Informe de alta" subtitle="Al cerrar el motivo de consulta" />
        <RowLink to={`/pacientes/${id}/derivacion`} icon={Send} title="Carta de derivación" subtitle="Pide otra valoración a su médico" />
        <RowLink to={`/pacientes/${id}/justificante`} icon={ClipboardList} title="Justificante de asistencia" subtitle="Para su trabajo o sus estudios" />
        {(files > 0 || !!cloud?.clinic) && (
          <RowLink
            to={`/pacientes/${id}/archivos`}
            icon={Files}
            title="Archivos del paciente"
            subtitle={files ? `${files === 1 ? "1 archivo" : `${files} archivos`} · informes y pruebas` : "Sus informes y pruebas, en PDF o foto"}
          />
        )}
        {SHOW_EXERCISES && (
          <RowLink
            to={`/pacientes/${id}/ejercicios`}
            icon={Dumbbell}
            title="Ejercicios para casa"
            subtitle={plans.length ? `Hoja del ${fmtDate(plans[0]!.updatedAt)}` : "Para imprimir o enviar por WhatsApp"}
          />
        )}
      </Group>
      <Group title="Legal">
        <RowLink
          to={`/pacientes/${id}/consentimientos`}
          icon={FilePen}
          title="Consentimientos informados"
          subtitle={inForce.length ? (inForce.length === 1 ? "1 firmado" : `${inForce.length} firmados`) : "Se preparan con su anamnesis"}
        />
        <RowLink
          to={`/pacientes/${id}/proteccion-datos`}
          icon={privacy.informedAt ? ShieldCheck : ShieldAlert}
          title="Protección de datos (RGPD)"
          subtitle={
            privacy.informedAt
              ? [
                  privacy.sheets?.at(-1)?.date === privacy.informedAt ? `Firmada en la pantalla el ${dayText(privacy.informedAt)}` : `Entregada el ${dayText(privacy.informedAt)}`,
                  ...optional,
                ].join(" · ")
              : "Sin entregar"
          }
        />
      </Group>
      <Group title="Cuenta">
        <RowLink to={`/pacientes/${id}/cobros`} icon={Wallet} title="Bonos y cobros" subtitle={accountLine(account) ?? "Vender un bono o cobrar"} />
        <RowLink
          to={waiting ? "/agenda/espera" : `/agenda/espera?paciente=${id}`}
          icon={Hourglass}
          title="Lista de espera"
          subtitle={waiting ? `En la lista: ${preferText(waiting).toLowerCase()}` : "Avisarle si se libera un hueco antes"}
        />
      </Group>
        </div>
      </div>
      <Sheet open={assessing} onClose={() => setAssessing(false)} title="Valorar">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
          <RowLink to={`/pacientes/${id}/exploracion/nuevo`} icon={Stethoscope} title="Registrar un test" subtitle="Lachman, Neer, Slump… los de su zona, primero" />
          <RowLink to={`/pacientes/${id}/cuestionarios/nuevo`} icon={ListChecks} title="Pasar un cuestionario" subtitle="Aquí o enviado a su móvil" />
          <RowLink to={`/pacientes/${id}/test`} icon={Activity} title="Nueva medición" subtitle="Saltos, fuerza, sprint, carrera, movilidad o nórdico" />
        </ul>
      </Sheet>
    </PatientShell>
  );
}
