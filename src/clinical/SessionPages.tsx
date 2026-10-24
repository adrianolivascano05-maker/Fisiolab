// Ficha › Sesiones: la lista con la evolución del dolor y lo previsto, y apuntar o cambiar una sesión (con la siguiente
// cita, el cobro y el calendario).
import { SHOW_EXERCISES } from "../app/features";
import { CalendarCheck, CalendarClock, ClipboardList, NotebookPen, Pencil, Trash, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { fmtDate, fmtDateTime, testTitle } from "../app/format";
import { LoadError, Page } from "../app/Page";
import { deleteSession, getAnamnesis, getSession, listFindings, listQuestionnaires, listSessions, saveSession, sessionCount, type Finding, type Session } from "../data/clinical";
import { getAppointment } from "../data/appointments";
import { getDb } from "../data/db";
import { getPatient, listTests, listWellness } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { addPayment, chargeText, euros, nextSessionCharge, type Method } from "../data/billing";
import { EmptyState } from "../ui/EmptyState";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { useAsync } from "../app/useAsync";
import { CalendarSheet, DEFAULT_VISIT_MINUTES, fmtVisit, visitEvent, calendarPromptOff, setCalendarPromptOff } from "./CalendarButton";
import { lastMethod, MethodPicker, rememberMethod } from "./billingForms";
import { mainValue } from "./measures";
import { Chips, PainChart, PainScale, ResultBadge, sideShort, TextArea } from "./parts";
import { buildTimeline, madridDay, painSeries, type EventKind } from "./timeline";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { PatientShell } from "./PatientShell";
import { addDays, dayText, Guard, localInput, primaryLink, todayDay, useLoad } from "./pageKit";

// ---------- Sesiones ----------

export function SessionsPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  // Con Google Calendar conectado la cita se apunta sola: no hace falta ofrecer el enlace.
  const autoCalendar = useAutoCalendar();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, sessions, findings, tests, count, questionnaires, wellness, anamnesis] = await Promise.all([
      getPatient(db, id),
      listSessions(db, id),
      listFindings(db, id),
      listTests(db, id),
      sessionCount(db, id),
      listQuestionnaires(db, id),
      listWellness(db, id),
      getAnamnesis(db, id),
    ]);
    return { patient, sessions, findings, tests, count, questionnaires, wellness, anamnesis };
  });
  if (!data.data) return <Guard state={data} title="Sesiones" back={`/pacientes/${id}`} />;
  const { patient, sessions, findings, tests, count, questionnaires, wellness, anamnesis } = data.data;
  // La evolución: la curva del dolor arriba y, al final, la historia de todo lo que se ha hecho.
  const pain = painSeries({ sessions, wellness, anamnesis });
  const timeline = buildTimeline(id, { sessions, findings, tests, questionnaires, wellness, anamnesis }).slice(0, 12);
  const review = sessions[0]?.reviewOn ?? null;
  const today = todayDay();
  // Al guardar una sesión con siguiente cita se ofrece pasarla al calendario (la próxima cita, con su botón, está en la cabecera).
  const justSaved = sessions.find((s) => s.id === params.get("calendario"));
  const justSavedEvent = justSaved && patient && !autoCalendar && !calendarPromptOff() ? visitEvent(justSaved, patient) : null;
  return (
    <PatientShell patient={patient} id={id}>
      {/* En ancho (el ordenador), las sesiones a la izquierda y la historia a la derecha; en el móvil, seguidas. */}
      <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @2xl:items-start @2xl:gap-x-6">
      <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Sesiones</h2>
        <Link to={`/pacientes/${id}/sesiones/nueva`} className={primaryLink}>
          <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
        </Link>
      </div>
      {count.planned !== null && <SessionMeter done={count.done} planned={count.planned} />}
      {pain.length > 0 && (
        <section aria-labelledby="h-dolor" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="h-dolor" className="text-base">
              Dolor
            </h3>
            <span className="nums text-sm text-text-muted">{pain.length === 1 ? "1 registro" : `${pain[0]!.pain} → ${pain.at(-1)!.pain} en ${pain.length} registros`}</span>
          </div>
          <Card>
            <PainChart points={pain} label={`Dolor de 0 a 10: ${pain.map((p) => `${fmtDate(p.at)} ${p.pain}`).join(", ")}`} />
          </Card>
        </section>
      )}
      {review && (
        <Alert tone={review <= today ? "warning" : "info"} title={review < today ? `Reevaluación pendiente desde el ${dayText(review)}` : review === today ? "Reevaluar hoy" : `Próxima reevaluación: ${dayText(review)}`} />
      )}
      {sessions.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin sesiones todavía">
          Registra cada visita: el dolor de ese día, qué refiere, qué haces y cuándo reevaluar.
        </EmptyState>
      ) : (
        <ol aria-label="Sesiones" className="flex flex-col gap-3">
          {sessions.map((s, i) => (
            <SessionCard key={s.id} s={s} n={sessions.length - i} id={id} findings={findings.filter((f) => madridDay(f.performedAt) === madridDay(s.performedAt))} tests={tests.filter((t) => madridDay(t.performedAt) === madridDay(s.performedAt))} />
          ))}
        </ol>
      )}
      </div>
      {timeline.length > 0 && (
        <section aria-labelledby="historia" className="flex flex-col gap-2">
          <h3 id="historia" className="text-base">
            Historia
          </h3>
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
      </div>
      {justSavedEvent && (
        <CalendarSheet
          open
          onClose={() => setParams({}, { replace: true })}
          event={justSavedEvent}
          title="¿Añadir la cita a tu calendario?"
          onNever={() => {
            setCalendarPromptOff();
            setParams({}, { replace: true });
          }}
        />
      )}
    </PatientShell>
  );
}

const kindStyle: Record<EventKind, { dot: string; label: string }> = {
  session: { dot: "bg-brand-ink", label: "Sesión" },
  finding: { dot: "bg-danger", label: "Exploración" },
  test: { dot: "bg-accent", label: "Medición" },
  questionnaire: { dot: "bg-chart-right", label: "Cuestionario" },
  wellness: { dot: "bg-highlight", label: "Bienestar" },
  anamnesis: { dot: "bg-text-muted", label: "Anamnesis" },
};

/** Cuántas sesiones lleva de las previstas (o del bono) en este motivo de consulta. */
function SessionMeter({ done, planned }: { done: number; planned: number }) {
  const left = planned - done;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {done} de {planned} sesiones previstas
        </span>
        <span className={cx("text-sm", left <= 0 ? "font-semibold text-warning" : "text-text-muted")}>
          {left > 1 ? `quedan ${left}` : left === 1 ? "queda 1" : left === 0 ? "hechas todas" : `${-left} más de las previstas`}
        </span>
      </div>
      <div role="progressbar" aria-label="Sesiones hechas" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={Math.min(done, planned)} className="h-2 overflow-hidden rounded-pill bg-surface">
        <div className={cx("h-full rounded-pill", left <= 0 ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, (done / planned) * 100)}%` }} />
      </div>
    </Card>
  );
}

function SessionCard({ s, n, id, findings, tests }: { s: Session; n: number; id: string; findings: Finding[]; tests: Awaited<ReturnType<typeof listTests>> }) {
  const rows: [string, string][] = [
    ["Refiere", s.subjective],
    ["Encuentras", s.objective],
    ["Tratamiento", s.treatment],
    ["Plan", s.plan],
  ];
  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-semibold">Sesión {n}</span>
            <span className="text-sm text-text-muted">{fmtDateTime(s.performedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {s.pain !== null && <span className="nums rounded-pill bg-danger-soft px-2.5 py-0.5 text-sm font-semibold text-danger">Dolor {s.pain}/10</span>}
            <Link to={`/pacientes/${id}/sesiones/${s.id}`} aria-label={`Editar la sesión ${n}`} className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
              <Pencil aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
        {rows.some(([, v]) => v) && (
          <dl className="flex flex-col gap-1.5 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold">{k}</dt>
                  <dd className="whitespace-pre-line">{v}</dd>
                </div>
              ))}
          </dl>
        )}
        {(findings.length > 0 || tests.length > 0) && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ese día</span>
            <ul className="flex flex-wrap gap-1.5">
              {findings.map((f) => (
                <li key={f.id}>
                  <Link to={`/pacientes/${id}/exploracion/${f.id}`} className="inline-flex min-h-11 items-center">
                    <ResultBadge result={f.result}>
                      {f.testName}
                      {f.side ? ` ${sideShort[f.side]}` : ""}
                    </ResultBadge>
                  </Link>
                </li>
              ))}
              {tests.slice(0, 6).map((t) => {
                const v = mainValue(t);
                return (
                  <li key={t.id}>
                    <Link to={`/tests/${t.id}`} className="inline-flex min-h-11 items-center rounded-pill bg-accent-soft px-2.5 text-sm font-semibold text-accent">
                      {testTitle(t)}
                      {v ? ` · ${v.text}${v.unit === "°" ? "°" : v.unit ? ` ${v.unit}` : ""}` : " · sin marcar"}
                    </Link>
                  </li>
                );
              })}
              {tests.length > 6 && (
                <li>
                  <Link to={`/pacientes/${id}/mediciones`} className="inline-flex min-h-11 items-center rounded-pill px-2.5 text-sm font-semibold text-accent underline-offset-2 hover:underline">
                    y {tests.length - 6} mediciones más
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
        {s.nextAt && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <CalendarCheck aria-hidden="true" className="size-4 text-accent" /> Siguiente cita: {fmtVisit(s.nextAt)} · {s.nextMinutes} min
          </span>
        )}
        {s.reviewOn && (
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
            <CalendarClock aria-hidden="true" className="size-4" /> Reevaluar el {dayText(s.reviewOn)}
          </span>
        )}
      </Card>
    </li>
  );
}

export function SessionFormPage() {
  const { id = "", sid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const autoCalendar = useAutoCalendar();
  const data = useLoad(`${id}|${sid ?? ""}`, async () => {
    const db = getDb();
    const [patient, session, sessions, appointment, count] = await Promise.all([
      getPatient(db, id),
      sid ? getSession(db, sid) : null,
      listSessions(db, id),
      sid ? getAppointment(db, sid) : null,
      sessionCount(db, id),
    ]);
    // La duración de la siguiente cita: la que se usó la última vez. La sesión anterior, para repetir su tratamiento.
    return {
      patient,
      session,
      appointment,
      count,
      previous: sid ? null : (sessions[0] ?? null),
      lastMinutes: sessions.find((s) => s.nextMinutes)?.nextMinutes ?? DEFAULT_VISIT_MINUTES,
    };
  });
  // Desde una cita de la agenda («Atender»), la sesión lleva la hora de la cita, no la de ahora.
  const [query] = useSearchParams();
  const [when, setWhen] = useState(() => {
    const at = query.get("hora");
    return localInput(at && !Number.isNaN(Date.parse(at)) ? at : new Date().toISOString());
  });
  const [pain, setPain] = useState<number | null>(null);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [treatment, setTreatment] = useState("");
  const [plan, setPlan] = useState("");
  const [reviewOn, setReviewOn] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [nextMinutes, setNextMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  /** Una sesión nueva: si la paga un bono o es suelta (y cobrarla al guardar). */
  const charge = useAsync(async () => {
    if (sid) return null;
    const at = new Date(when);
    return Number.isNaN(at.getTime()) ? null : nextSessionCharge(getDb(), id, at.toISOString(), todayDay());
  }, [id, sid, when]);
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState<Method>(lastMethod);

  useEffect(() => {
    const s = data.data?.session;
    if (!s) return;
    setWhen(localInput(s.performedAt));
    setPain(s.pain);
    setSubjective(s.subjective);
    setObjective(s.objective);
    setTreatment(s.treatment);
    setPlan(s.plan);
    setReviewOn(s.reviewOn ?? "");
    // La cita que se dio en esta sesión, como está ahora en la agenda (se puede haber movido después).
    const a = data.data?.appointment;
    const next = a ? (a.status === "cancelled" ? null : a.startsAt) : s.nextAt;
    setNextAt(next ? localInput(next) : "");
    setNextMinutes(a?.minutes ?? s.nextMinutes);
  }, [data.data?.session, data.data?.appointment]);

  // Una sesión nueva sigue con la reevaluación pendiente de la anterior (si no, se perdía al guardar sin fecha).
  const carried = !sid ? (data.data?.previous?.reviewOn ?? null) : null;
  useEffect(() => {
    if (carried) setReviewOn((r) => r || carried);
  }, [carried]);

  // Desde Agenda › Hoy («Atender»): se vuelve a Hoy, con la cita ya atendida.
  const fromToday = query.get("volver") === "hoy";
  const back = fromToday ? "/agenda?vista=hoy" : `/pacientes/${id}/sesiones`;
  const backLabel = fromToday ? "Hoy" : undefined;
  if (!data.data) return <Guard state={data} title="Sesión" back={back} />;
  const { patient, session, lastMinutes, previous, count } = data.data;
  if (sid && !session) return <Page title="Sesión" backTo={back}><LoadError error={new Error("Esta sesión no existe.")} /></Page>;
  const minutes = nextMinutes ?? lastMinutes;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = nextAt ? new Date(nextAt).toISOString() : null;
      const saved = await saveSession(
        getDb(),
        id,
        { performedAt: new Date(when).toISOString(), pain, subjective, objective, treatment, plan, reviewOn: reviewOn || null, nextAt: next, nextMinutes: next ? minutes : null },
        sid,
      );
      const c = charge.data;
      if (!sid && payNow && c?.kind === "loose" && c.cents > 0) {
        rememberMethod(payMethod);
        await addPayment(getDb(), id, { amountCents: c.cents, method: payMethod, paidOn: when.slice(0, 10), concept: "Sesión de fisioterapia" });
      }
      const extra = !sid && c ? (c.kind === "pack" ? (c.leftAfter ? ` · bono: quedan ${c.leftAfter} de ${c.sessions}` : " · bono gastado") : c.kind === "loose" && payNow ? ` · cobrada ${euros(c.cents)}` : "") : "";
      toast(sid ? "Sesión guardada" : `Sesión registrada${extra}`, "success");
      // Cita nueva o cambiada: se ofrece pasarla al calendario.
      const changed = next !== null && (next !== session?.nextAt || minutes !== session?.nextMinutes);
      navigate(changed ? (fromToday ? `${back}&calendario=${saved}&paciente=${id}` : `${back}?calendario=${saved}`) : back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!sid) return;
    await deleteSession(getDb(), sid);
    toast("Sesión borrada");
    navigate(back, { replace: true });
  };
  const base = when.slice(0, 10) || todayDay();
  /** La hora de esta sesión al cuarto de hora más cercano, `n` días después. */
  const sameTimeIn = (n: number) => {
    const d = new Date(when);
    d.setDate(d.getDate() + n);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
    return Number.isNaN(d.getTime()) ? "" : localInput(d.toISOString());
  };

  return (
    <Page title={sid ? "Editar sesión" : "Nueva sesión"} backTo={back} backLabel={backLabel} tabs={false} width="record">
      <p className="text-text-muted">
        {patient?.name}
        {!sid && count.planned !== null && ` · sesión ${count.done + 1} de ${count.planned} previstas`}
      </p>
      {!sid && count.planned !== null && count.done >= count.planned && (
        <Alert tone="warning" title={`Ya lleva las ${count.planned} sesiones previstas`}>
          Si sigue, cambia el número en su anamnesis (Objetivos → Sesiones previstas).
        </Alert>
      )}
      {charge.data && charge.data.kind !== "none" && (
        <div className={cx("flex flex-col gap-2 rounded-md p-3", charge.data.kind === "pack" && charge.data.leftAfter === 0 ? "bg-warning-soft" : "bg-surface")}>
          <p className="text-sm font-semibold">
            <Wallet aria-hidden="true" className="mr-1 inline size-4 align-[-2px]" />
            {chargeText(charge.data)}
            {charge.data.kind === "pack" && charge.data.leftAfter === 0 && (
              <>
                {" "}
                ·{" "}
                <Link to={`/pacientes/${id}/cobros`} className="text-accent underline">
                  ofrécele renovarlo
                </Link>
              </>
            )}
          </p>
          {charge.data.kind === "loose" && charge.data.cents > 0 && (
            <>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-accent" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
                Cobrada ahora
              </label>
              {payNow && <MethodPicker value={payMethod} onChange={setPayMethod} name="pago-sesion" />}
            </>
          )}
        </div>
      )}
      {/* En ancho (el ordenador), dos columnas: la sesión a la izquierda; la siguiente cita, reevaluar y guardar a la derecha. */}
      <form onSubmit={submit} className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-x-6" noValidate>
      <div className="flex flex-col gap-4">
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <PainScale label="Dolor hoy (EVA 0-10)" value={pain} onChange={setPain} />
        <TextArea label="Qué refiere" hint="Cómo ha ido desde la última sesión, qué nota." value={subjective} onChange={setSubjective} />
        <TextArea label="Qué encuentras" hint="Exploración de hoy, cambios." value={objective} onChange={setObjective} />
        {previous && (previous.treatment || previous.plan) && (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              setTreatment(previous.treatment);
              setPlan(previous.plan);
            }}
          >
            Repetir el tratamiento de la última sesión ({fmtDate(previous.performedAt)})
          </Button>
        )}
        <TextArea label="Tratamiento" value={treatment} onChange={setTreatment} rows={4} />
        <TextArea label="Plan y ejercicios para casa" value={plan} onChange={setPlan} />
        {SHOW_EXERCISES && (
          <Link to={`/pacientes/${id}/ejercicios`} className="-mt-2 self-start text-sm font-semibold text-accent underline">
            Su hoja de ejercicios para casa (para imprimir o enviar)
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Dar la siguiente cita</legend>
          <div className="flex flex-wrap gap-2">
            {[7, 14].map((d) => (
              <Button key={d} variant={nextAt && nextAt === sameTimeIn(d) ? "primary" : "secondary"} size="sm" onClick={() => setNextAt(sameTimeIn(d))}>
                {d === 7 ? "Cita en 1 semana" : "Cita en 2 semanas"}
              </Button>
            ))}
            {nextAt && (
              <Button variant="ghost" size="sm" onClick={() => setNextAt("")}>
                Sin cita
              </Button>
            )}
          </div>
          <TextField label="Día y hora" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
          {nextAt && (
            <Chips label="Duración" options={["30", "45", "60", "90"]} render={(o) => `${o} min`} value={[String(minutes)]} onChange={(v) => v[0] && setNextMinutes(Number(v[0]))} />
          )}
          <p className="text-sm text-text-muted">Los botones la ponen a la hora de esta sesión, al cuarto de hora más cercano. {autoCalendar ? "Al guardar se apunta sola en tu Google Calendar." : "Al guardar podrás añadirla a tu calendario (Google, iPhone, Outlook…)."}</p>
        </fieldset>
        {carried && reviewOn === carried && (
          <p className="-mb-2 text-sm text-text-muted">
            Sigue la reevaluación pendiente del {dayText(carried)}. Si la haces hoy, ábrela y pulsa «Ya reevaluado hoy», o pon la siguiente.
          </p>
        )}
        {/* Reevaluar: con una fecha ya puesta, plegado en una línea (se abre para cambiarla); sin fecha, abierto. */}
        <details className="group flex flex-col gap-2 rounded-md border border-border px-3" open={!reviewOn || undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
            <span>{reviewOn ? `Reevaluar el ${dayText(reviewOn)}` : "Reevaluar"}</span>
            {reviewOn && <span className="text-sm text-accent group-open:hidden">Cambiar</span>}
          </summary>
          <div className="flex flex-col gap-2 pb-3">
            <div role="group" aria-label="Reevaluar" className="flex flex-wrap gap-2">
              {[7, 14, 28].map((d) => (
                <Button key={d} variant={reviewOn === addDays(base, d) ? "primary" : "secondary"} size="sm" onClick={() => setReviewOn(addDays(base, d))}>
                  {d === 7 ? "Reevaluar en 1 semana" : d === 14 ? "En 2 semanas" : "En 4 semanas"}
                </Button>
              ))}
              {reviewOn && (
                <Button variant="ghost" size="sm" onClick={() => setReviewOn("")}>
                  {carried && reviewOn === carried ? "Ya reevaluado hoy" : "Sin fecha"}
                </Button>
              )}
            </div>
            <TextField label="Fecha de reevaluación" type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} />
          </div>
        </details>
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" size="lg" block loading={saving}>
          {sid ? "Guardar cambios" : "Guardar sesión"}
        </Button>
        {sid && (
          <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
            Borrar sesión
          </Button>
        )}
      </div>
      </form>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar esta sesión?">
        <p>Se borrará la sesión del {fmtDateTime(session?.performedAt ?? new Date().toISOString())}. Las mediciones y los tests de ese día no se borran.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
