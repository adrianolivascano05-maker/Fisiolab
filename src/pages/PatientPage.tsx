import { todayDay } from "../app/dates";
import { Activity, ArrowRight, CalendarClock, ChevronDown, ClipboardList, Dumbbell, FileCheck, FilePen, FileText, Files, Hourglass, ListChecks, NotebookPen, Send, ShieldAlert, ShieldCheck, Stethoscope } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { SHOW_EXERCISES } from "../app/features";
import { fmtDate, testTitle } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { clinicalSummary, highlights, regionLabel } from "../clinical/anamnesis";
import { TPL } from "../clinical/answerMeta";
import { useTemplateFor } from "../clinical/useAnamnesis";
import { MEASURES, measureLabel, proposedQuestionnaires } from "../clinical/proposals";
import { useCloud } from "../cloud/cloudContext";
import { mainValue } from "../clinical/measures";
import { questionnaireGroups } from "../clinical/outcomeParts";
import { PatientShell } from "../clinical/PatientShell";
import { PlanCard } from "../clinical/cycles/SessionCycles";
import { kindOf, scoreText, type QDetails } from "../clinical/questionnaires";
import { redFlagReview } from "../clinical/redFlags";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";
import { accountLine, euros, patientAccount } from "../data/billing";
import { getAnamnesis, listQuestionnaires, listSessions } from "../data/clinical";
import { listConsents } from "../data/consents";
import { countDocuments } from "../data/documents";
import { getDb } from "../data/db";
import { listPlans } from "../data/exercises";
import { eventNotes, listPatientEvents } from "../data/patientEvents";
import { KIND_ICON } from "../clinical/eventIcons";
import { CONSENTS } from "../data/privacy";
import { getPatient, listTests } from "../data/repo";
import { preferText, waitlistOf } from "../data/waitlist";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { Group, RowLink } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";

const dayText = (d: string) => fmtDate(`${d}T12:00:00`);

/** Una cifra del tablero: se toca y lleva a donde está el detalle. Dice el dato, no si es bueno o malo. */
function Tile({ to, label, value, sub }: { to: string; label: string; value: string; sub: string }) {
  return (
    <li>
      <Link to={to} className="flex h-full min-h-20 flex-col card-edge rounded-lg border bg-bg shadow-card px-3 py-2 hover:bg-surface">
        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</span>
        <span className="nums text-lg font-semibold text-accent">{value}</span>
        <span className="line-clamp-2 text-xs text-text-muted">{sub}</span>
      </Link>
    </li>
  );
}

const FOLD_KEY = "omniclin.resumen.abierto";
/** Lo abierto del Resumen se recuerda mientras la app está abierta: quien usa los documentos, los deja a la vista. */
function foldOpen(id: string): boolean | null {
  try {
    const v = sessionStorage.getItem(`${FOLD_KEY}.${id}`);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

/** Un grupo del Resumen plegado en una fila (Documentos, Legal): dice lo que hay y se abre al tocarlo. En el ordenador, abierto. */
function Fold({ id, title, subtitle, warn, children }: { id: string; title: string; subtitle: string; warn?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(() => foldOpen(id) ?? (typeof matchMedia === "function" && matchMedia("(min-width: 1024px)").matches));
  const toggle = () => {
    try {
      sessionStorage.setItem(`${FOLD_KEY}.${id}`, open ? "0" : "1");
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    setOpen(!open);
  };
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex min-h-12 items-center gap-2 card-edge rounded-lg border bg-bg shadow-card px-3 py-1.5 text-left hover:bg-surface">
        <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-accent transition-transform", !open && "-rotate-90")} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          {!open && <span className={cx("truncate text-sm", warn ? "text-warning" : "text-text-muted")}>{subtitle}</span>}
        </span>
      </button>
      {open && <ul className="divide-y divide-border overflow-hidden card-edge rounded-lg border bg-bg shadow-card">{children}</ul>}
    </section>
  );
}

/** S02 Ficha del paciente › Resumen: las dos acciones de cada día (sesión y valorar), cómo está (una tarjeta que informa,
 * no un menú), lo que falta y, en tres grupos, sus documentos, lo legal y su cuenta. Cada cosa sale una sola vez: la
 * anamnesis, la valoración y las sesiones tienen su pestaña. */
export function PatientPage() {
  const { id = "" } = useParams();
  // El paciente solo, para pintar su cabecera mientras llega todo lo demás (diez consultas).
  const head = useAsync(() => getPatient(getDb(), id), [id]);
  const data = useAsync(async () => {
    const db = getDb();
    const today = todayDay();
    const [patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, waiting, files, events] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      listQuestionnaires(db, id),
      listTests(db, id),
      listConsents(db, id),
      patientAccount(db, id, today),
      listPlans(db, id),
      waitlistOf(db, id),
      countDocuments(db, id),
      listPatientEvents(db, id),
    ]);
    return { patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, today, files, waiting, notes: eventNotes(events, today) };
  }, [id]);
  const [assessing, setAssessing] = useState(false);
  const cloud = useCloud();
  /** La plantilla de su anamnesis: para lo que la clínica quiere ver destacado. */
  const tpl = useTemplateFor(data.data?.anamnesis?.answers[TPL]);

  if (data.error) return <Page title="Paciente" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data)
    return head.data ? (
      <PatientShell patient={head.data} id={id}>
        <Loading />
      </PatientShell>
    ) : (
      <Page title="Paciente" backTo="/"><Loading /></Page>
    );
  const { patient, anamnesis, sessions, questionnaires, tests, signed, account, plans, today, files, waiting, notes } = data.data;
  if (!patient) return <Page title="Paciente" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  // Consentimientos: los firmados vigentes y los que su anamnesis pide por escrito y faltan.
  const consentCtx = consentContext(patient, anamnesis?.answers ?? {});
  const inForce = signed.filter((c) => !c.revokedAt);
  const missing = TEMPLATES.filter((t) => t.written === "required" && t.suggest(consentCtx) && !inForce.some((c) => c.template === t.id));
  const privacy = patient.privacy;
  const optional = CONSENTS.filter((c) => privacy.consents?.[c.id] !== undefined).map((c) => `${c.label}: ${privacy.consents![c.id] ? "sí" : "no"}`);

  const summary = anamnesis ? clinicalSummary(anamnesis.answers) : null;
  const alarms = anamnesis ? redFlagReview(anamnesis.answers) : null;
  const marked = anamnesis && tpl ? highlights(anamnesis.answers, tpl.all) : [];
  const proposedQ = proposedQuestionnaires(tpl?.propose?.questionnaires ?? []);
  const proposedM = (tpl?.propose?.measures ?? []).filter((m) => MEASURES.some((x) => x.id === m));
  const last = sessions[0] ?? null;
  const review = last?.reviewOn ?? null;
  const lastGroup = questionnaireGroups(questionnaires)[0];
  const lastQ = lastGroup?.items[0];
  const lastTest = tests[0];
  const lastValue = lastTest ? mainValue(lastTest) : null;
  const headline = summary?.diagnosis || summary?.reason || "";
  const where = [...(summary?.regions ?? []).map(regionLabel), summary?.side && summary.side !== "No aplica" ? summary.side.toLowerCase() : ""].filter(Boolean).join(" · ");
  const hasSituation = !!(headline || where || alarms?.hits.length || marked.length || last || lastTest || notes.length);
  // Lo pendiente, por orden de importancia: lo primero sale arriba como «Lo siguiente»; lo demás, en «Pendiente».
  const todo: { key: string; to: string; icon: typeof CalendarClock; title: string; subtitle: string }[] = [];
  if (review !== null && review < today) todo.push({ key: "reevaluar", to: `/pacientes/${id}/valoracion`, icon: CalendarClock, title: "Reevaluación pendiente", subtitle: `Desde el ${dayText(review)}` });
  if (missing.length > 0)
    todo.push({
      key: "consentimiento",
      to: `/pacientes/${id}/consentimientos`,
      icon: FilePen,
      title: missing.length === 1 ? `Consentimiento sin firmar: ${missing[0]!.title.toLowerCase()}` : `${missing.length} consentimientos sin firmar`,
      subtitle: missing.length === 1 ? "Por escrito, según su anamnesis" : missing.map((t) => t.title.toLowerCase()).join(", "),
    });
  if (!privacy.informedAt) todo.push({ key: "rgpd", to: `/pacientes/${id}/proteccion-datos`, icon: ShieldAlert, title: "Hoja de protección de datos sin entregar", subtitle: "Para imprimir y que la firme" });
  const [next, ...rest] = todo;
  // Las cuatro cifras: el último dolor apuntado, las sesiones (y las previstas), el último cuestionario y su cuenta.
  const lastPain = sessions.find((x) => x.pain !== null);
  const plannedRaw = anamnesis?.answers.sesiones_previstas;
  const plannedN = typeof plannedRaw === "number" ? plannedRaw : typeof plannedRaw === "string" ? Number(plannedRaw.replace(",", ".")) : NaN;
  const planned = Number.isInteger(plannedN) && plannedN > 0 ? plannedN : null;
  const openPack = account.packs.find((p) => p.left > 0 && !p.expired);

  return (
    <PatientShell patient={patient} id={id}>
      {/* En ancho (el ordenador), dos columnas: lo de hoy (acciones, situación, pendiente) y, al lado, sus documentos,
          lo legal y su cuenta. En el móvil, todo seguido en este mismo orden. */}
      <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-x-6">
        <div className="flex flex-col gap-4">
          {/* Las dos acciones de cada visita. */}
          <div className="grid grid-cols-[3fr_2fr] gap-2">
        <Link to={`/pacientes/${id}/sesiones/nueva`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
          <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAssessing(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 font-semibold hover:bg-surface"
        >
          <Stethoscope aria-hidden="true" className="size-5 text-accent" /> Valorar
        </button>
      </div>

      {/* Lo siguiente: el paso pendiente más importante, con su enlace. */}
      {next && (
        <section aria-label="Lo siguiente">
          <Link to={next.to} className="flex min-h-14 items-center gap-3 rounded-lg bg-warning-soft px-3 py-2 hover:brightness-95">
            <next.icon aria-hidden="true" className="size-5 shrink-0 text-warning" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span aria-hidden="true" className="text-xs font-semibold tracking-wide text-text uppercase">Lo siguiente</span>
              <span className="font-semibold text-text">{next.title}</span>
              <span className="text-sm text-text">{next.subtitle}</span>
            </span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-text" />
          </Link>
        </section>
      )}

      {/* Cuatro cifras que se tocan: el dato, sin decir si es bueno o malo. */}
      <ul aria-label="En cifras" className="grid grid-cols-2 gap-2">
        <Tile to={`/pacientes/${id}/sesiones`} label="Dolor" value={lastPain ? `${lastPain.pain}/10` : "—"} sub={lastPain ? `El ${fmtDate(lastPain.performedAt)}` : "Sin apuntar"} />
        <Tile
          to={`/pacientes/${id}/sesiones`}
          label="Sesiones"
          value={planned ? `${sessions.length} de ${planned}` : String(sessions.length)}
          sub={last ? `La última, el ${fmtDate(last.performedAt)}` : "Ninguna todavía"}
        />
        <Tile
          to={`/pacientes/${id}/valoracion`}
          label="Cuestionario"
          value={lastGroup && lastQ ? scoreText(kindOf(lastQ.kind, lastQ.details as QDetails), lastQ.score) : "—"}
          sub={lastGroup && lastQ ? `Último cuestionario: ${lastGroup.name} · ${fmtDate(lastQ.performedAt)}` : "Ninguno pasado"}
        />
        <Tile
          to={`/pacientes/${id}/cobros`}
          label="Bonos y cobros"
          value={account.balanceCents > 0 ? euros(account.balanceCents) : account.balanceCents < 0 ? euros(-account.balanceCents) : openPack ? `${openPack.left} de ${openPack.sessions}` : "—"}
          sub={accountLine(account) ?? "Vender un bono o cobrar"}
        />
      </ul>

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
            <p className="flex items-start gap-2 text-sm">
              <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">
                  {`Banderas rojas: ${alarms.hits.length}`}
                </span>{" "}
                ·{" "}
                <Link to={`/pacientes/${id}/anamnesis`} className="font-semibold underline underline-offset-2">
                  ver
                </Link>
              </span>
            </p>
          )}
          {/* Lo que la clínica marcó para destacar en sus preguntas: el texto de la opción, sin recuentos. */}
          {marked.length > 0 && (
            <p className="flex items-start gap-2 text-sm">
              <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">Destacado:</span> {marked.map((h) => `${h.label}: ${h.values.join(", ")}`).join(" · ")} ·{" "}
                <Link to={`/pacientes/${id}/anamnesis`} className="font-semibold underline underline-offset-2">
                  ver
                </Link>
              </span>
            </p>
          )}
          {last && (
            <p className="text-sm">
              <span className="font-semibold">Última sesión</span> · {fmtDate(last.performedAt)}
              {last.treatment && <span className="block line-clamp-1 text-text-muted">{last.treatment}</span>}
            </p>
          )}
          {lastTest && (
            <p className="text-sm">
              <span className="font-semibold">Última medición</span> · {testTitle(lastTest)}
              {lastValue ? ` ${lastValue.text}${lastValue.unit === "°" ? "°" : lastValue.unit ? ` ${lastValue.unit}` : ""}` : ""} · {fmtDate(lastTest.performedAt)}
            </p>
          )}
          {review && review >= today && (
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-accent" /> {review === today ? "Reevaluar hoy" : `Reevaluar el ${dayText(review)}`}
            </p>
          )}
          {/* De su calendario: la última operación (hace cuánto) y lo próximo que importa (un viaje, un partido, una prueba). */}
          {notes.map((n) => {
            const Icon = KIND_ICON[n.event.kind];
            return (
              <p key={`${n.event.id}-${n.day}`} className="flex items-start gap-2 text-sm">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tingle" />
                <Link to={`/pacientes/${id}/calendario?mes=${n.day.slice(0, 7)}&dia=${n.day}`} className="underline underline-offset-2">
                  {n.text}
                </Link>
              </p>
            );
          })}
        </Card>
      </section>

      {rest.length > 0 && (
        <Group title="Pendiente">
          {rest.map((t) => (
            <RowLink key={t.key} to={t.to} icon={t.icon} tone="warning" title={t.title} subtitle={t.subtitle} warn />
          ))}
        </Group>
      )}

        </div>
        <div className="flex flex-col gap-4">
      <PlanCard patientId={id} />
      <Fold id="documentos" title="Documentos" subtitle="Informe, alta, derivación, justificante y sus archivos">
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
      </Fold>
      <Fold
        id="legal"
        title="Legal"
        warn={missing.length > 0 || !privacy.informedAt}
        subtitle={[
          missing.length ? `${missing.length === 1 ? "1 consentimiento" : `${missing.length} consentimientos`} sin firmar` : inForce.length ? `${inForce.length === 1 ? "1 consentimiento firmado" : `${inForce.length} consentimientos firmados`}` : "Consentimientos",
          privacy.informedAt ? "protección de datos entregada" : "protección de datos sin entregar",
        ].join(" · ")}
      >
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
                  privacy.sheets?.at(-1)?.date === privacy.informedAt ? `Firmada ${privacy.sheets.at(-1)!.method === "link" ? "en su móvil" : "en la pantalla"} el ${dayText(privacy.informedAt)}` : `Entregada el ${dayText(privacy.informedAt)}`,
                  ...optional,
                ].join(" · ")
              : "Sin entregar"
          }
        />
      </Fold>
      <Group label="Lista de espera">
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
        {/* Lo que propone la plantilla de su motivo de consulta: primero, a un toque. */}
        {proposedQ.length + proposedM.length > 0 && (
          <section aria-label={`Lo que propone la plantilla «${tpl!.name}»`} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase">Propuestos para «{tpl!.name}»</h3>
            <ul className="divide-y divide-border overflow-hidden card-edge rounded-lg border bg-bg shadow-card">
              {proposedQ.map((k) => (
                <RowLink key={k.id} to={`/pacientes/${id}/cuestionarios/nuevo?tipo=${encodeURIComponent(k.id)}`} icon={ListChecks} title={k.name} subtitle="Cuestionario" />
              ))}
              {proposedM.map((m) => (
                <RowLink key={m} to={`/pacientes/${id}/test/${m}`} icon={Activity} title={measureLabel(m)} subtitle="Medición" />
              ))}
            </ul>
          </section>
        )}
        <ul className="divide-y divide-border overflow-hidden card-edge rounded-lg border bg-bg shadow-card">
          <RowLink to={`/pacientes/${id}/exploracion/nuevo`} icon={Stethoscope} title="Registrar un test" subtitle="Lachman, Neer, Slump… los de su zona, primero" />
          <RowLink to={`/pacientes/${id}/cuestionarios/nuevo`} icon={ListChecks} title="Pasar un cuestionario" subtitle="Aquí o enviado a su móvil" />
          <RowLink to={`/pacientes/${id}/test`} icon={Activity} title="Nueva medición" subtitle="Saltos, fuerza, sprint, carrera, movilidad o nórdico" />
        </ul>
      </Sheet>
    </PatientShell>
  );
}
