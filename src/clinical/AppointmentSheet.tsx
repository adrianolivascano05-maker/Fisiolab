// Dar, cambiar o cerrar una cita (src/data/appointments.ts): desde la cabecera de la ficha (la próxima cita o «Dar
// cita») y desde la agenda de hoy en Pacientes. Al cambiar algo se recargan las pantallas (y, con la cuenta de
// Google, el calendario se pone al día solo). En una clínica, también con quién es (el horario, src/schedule).
import { CalendarClock, CalendarX2, ChevronDown, FileCheck, Hourglass, Mail, MessageCircle, NotebookPen, Pencil, Phone, RotateCcw, Trash, UserPlus, UserX, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { madridDay } from "../app/format";
import { getClinic } from "../data/privacy";
import { DEFAULT_TEMPLATE, mailtoUrl, REMINDER_TEMPLATE_KEY, reminderText, waPhone, whatsappUrl } from "../schedule/reminders";
import { clashes, createAppointment, createWeekly, deleteAppointment, markConfirmed, markReminded, STATUS_LABELS, updateAppointment, type AgendaItem, type Appointment, type AppointmentStatus } from "../data/appointments";
import { useAsync } from "../app/useAsync";
import { accountLine, addPayment, euros, getPricing, patientAccount } from "../data/billing";
import { getDb } from "../data/db";
import { createPatient, getPatient, getSetting, listPatients, matchesPatient, QUICK_PATIENT } from "../data/repo";
import { editText, lastEditOf } from "../data/editors";
import { memberEmail } from "../data/member";
import { listWaitlist } from "../data/waitlist";
import { staffName, useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { DEFAULT_VISIT_MINUTES, fmtVisit } from "./calendar";
import { PaymentForm } from "./billingForms";
import { localInput, todayDay } from "./pageKit";
import { Chips } from "./parts";

const DURATIONS = ["30", "45", "60", "90"];
/** Una serie de sesiones: cuántas citas, una por semana. */
const REPEATS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

export function AppointmentSheet({
  open,
  onClose,
  patientId: fixedPatient,
  patientName,
  appointment,
  start,
  person,
  onShiftInstead,
}: {
  open: boolean;
  onClose: () => void;
  /** El paciente; sin él (desde un hueco de la agenda), se elige en la hoja. */
  patientId?: string;
  patientName?: string;
  /** La cita que se gestiona; null para dar una nueva. */
  appointment: Appointment | null;
  /** Para una cita nueva desde la agenda: a qué hora y con quién (null, sin asignar). */
  start?: string;
  person?: string | null;
  /** Desde un hueco de la agenda de una clínica: poner ahí un turno en vez de una cita. */
  onShiftInstead?: () => void;
}) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const patientId = fixedPatient ?? picked?.id ?? "";
  const toast = useToast();
  const [editing, setEditing] = useState(!appointment);
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_VISIT_MINUTES);
  const staff = useStaff();
  const edit = useAsync(async () => (open && appointment && staff.length ? lastEditOf(getDb(), "appointments", appointment.id) : null), [open, appointment?.id, staff.length]);
  const lastEdit = edit.data;
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  /** Su cuenta (bono y pendiente, para cobrar aquí mismo) y cómo recordarle la cita (teléfono, correo, permiso, mensaje). */
  const extra = useAsync(async () => {
    if (!open || !appointment) return null;
    const db = getDb();
    const [a, pricing, patient, clinic, template] = await Promise.all([
      patientAccount(db, appointment.patientId, todayDay()),
      getPricing(db),
      getPatient(db, appointment.patientId),
      getClinic(db),
      getSetting<string>(db, REMINDER_TEMPLATE_KEY),
    ]);
    return {
      a,
      pricing,
      phone: patient?.phone ?? "",
      wa: waPhone(patient?.phone ?? ""),
      email: patient?.email ?? "",
      contact: patient?.privacy.consents?.contact ?? null,
      reminder: reminderText(template ?? DEFAULT_TEMPLATE, {
        name: patient?.name ?? "",
        startsAt: appointment.startsAt,
        clinic: clinic.name,
        professional: staff.length && appointment.assignedTo ? staffName(staff, appointment.assignedTo) : null,
      }),
    };
  }, [open, appointment?.id, appointment?.startsAt]);
  const [paying, setPaying] = useState(false);
  /** Anular o borrar: primero se pregunta. */
  const [confirming, setConfirming] = useState<"cancel" | "delete" | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  /** Antes del día de la cita («future»), el día o después sin marcar («now»), o ya marcada. */
  const phase = !appointment || appointment.status !== "scheduled" ? "marked" : madridDay(appointment.startsAt) > madridDay(new Date().toISOString()) ? "future" : "now";
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(1);
  /** Citas que ya hay a esa hora: se avisa antes de dar la cita. */
  const [clash, setClash] = useState<AgendaItem[] | null>(null);
  /** Al anular o borrar una cita futura con gente en la lista de espera: el hueco, para ofrecérselo. */
  const [freed, setFreed] = useState<{ startsAt: string; minutes: number; assignedTo: string | null; waiting: number; patientId: string } | null>(null);
  /** Después de «No vino»: la cita marcada, para deshacerlo o darle otra. */
  const [missed, setMissed] = useState<Appointment | null>(null);
  useEffect(() => {
    if (open) {
      setFreed(null);
      setMissed(null);
      setPaying(false);
      setConfirming(null);
    }
  }, [open]);
  /** El panel del hueco libre sustituye a los botones: el foco, a su acción principal. */
  const offerRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (freed) offerRef.current?.focus();
  }, [freed]);

  // Cada vez que se abre: con los datos de la cita, o vacía para dar una nueva.
  useEffect(() => {
    if (!open) return;
    setEditing(!appointment);
    setWhen(appointment ? localInput(appointment.startsAt) : start ? localInput(start) : "");
    setMinutes(appointment?.minutes ?? DEFAULT_VISIT_MINUTES);
    setAssignedTo(appointment ? (appointment.assignedTo ?? "") : person !== undefined ? (person ?? "") : (memberEmail() ?? ""));
    setPicked(null);
    setError(null);
    setRepeat(1);
    setClash(null);
  }, [open, appointment, start, person]);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      toast(done, "success");
      bumpData();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const save = async (anyway = false) => {
    if (!patientId) return setError("Elige el paciente.");
    if (!when) return setError("Pon el día y la hora de la cita.");
    const startsAt = new Date(when).toISOString();
    // Sin equipo (sin clínica) no se toca con quién es.
    const who = staff.length ? { assignedTo: assignedTo || null } : {};
    const count = appointment ? 1 : repeat;
    if (!anyway) {
      // ¿Ya hay algo a esa hora (de esa persona, en una clínica)? Se avisa; se puede dar igualmente.
      const found: AgendaItem[] = [];
      for (let i = 0; i < count; i++) {
        const d = new Date(when);
        d.setDate(d.getDate() + 7 * i);
        found.push(...(await clashes(getDb(), d.toISOString(), minutes, staff.length ? who.assignedTo : undefined, appointment?.id)));
      }
      if (found.length) return setClash(found);
    }
    setClash(null);
    const last = new Date(when);
    last.setDate(last.getDate() + 7 * (count - 1));
    return run(
      () =>
        appointment
          ? updateAppointment(getDb(), appointment.id, { startsAt, minutes, ...who })
          : createWeekly(getDb(), patientId, { startsAt, minutes, ...who }, count),
      appointment ? "Cita cambiada" : count > 1 ? `${count} citas dadas, una por semana hasta el ${fmtVisit(last.toISOString()).replace(/,.*$/, "")}` : "Cita dada",
    );
  };
  const setStatus = (status: AppointmentStatus, done: string) => run(() => updateAppointment(getDb(), appointment!.id, { status }), done);
  /** «No vino»: se anota y, en vez de cerrar, se ofrece darle otra cita o deshacerlo. */
  async function markMissed() {
    const a = appointment!;
    setBusy(true);
    setError(null);
    try {
      await updateAppointment(getDb(), a.id, { status: "no_show" });
      bumpData();
      setMissed(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  /** Anular o borrar: si el hueco es futuro y alguien lo espera, se ofrece en vez de cerrar. */
  async function release(work: () => Promise<unknown>, done: string) {
    const a = appointment!;
    setBusy(true);
    setError(null);
    try {
      await work();
      toast(done, "success");
      bumpData();
      const forWhom = staff.length && a.assignedTo ? a.assignedTo : undefined;
      const waiting = Date.parse(a.startsAt) > Date.now() ? (await listWaitlist(getDb(), forWhom)).filter((w) => w.patientId !== a.patientId).length : 0;
      if (waiting) setFreed({ startsAt: a.startsAt, minutes: a.minutes, assignedTo: a.assignedTo ?? null, waiting, patientId: a.patientId });
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  /** La misma hora del reloj una semana después (también si cambia la hora entre medias). */
  const weekLater = (iso: string) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  };
  /** Mover la cita sin escribir: una hora, un día o una semana antes o después. */
  const nudge = (minutes: number, label: string) => {
    const d = new Date(appointment!.startsAt);
    if (Math.abs(minutes) >= 24 * 60) d.setDate(d.getDate() + minutes / (24 * 60));
    else d.setMinutes(d.getMinutes() + minutes);
    return run(() => updateAppointment(getDb(), appointment!.id, { startsAt: d.toISOString() }), `Cita movida ${label}: ${fmtVisit(d.toISOString())}`);
  };
  const name = patientName ?? picked?.name ?? "";

  return (
    <Sheet open={open} onClose={onClose} title={missed ? `No vino: ${name}` : freed ? "Hueco libre" : appointment && !editing ? `Cita de ${name}` : appointment ? "Cambiar la cita" : patientName ? `Dar cita a ${patientName}` : "Nueva cita"}>
      {missed ? (
        <div className="flex flex-col gap-3">
          <p>
            Anotado que no vino a la cita del <span className="font-semibold">{fmtVisit(missed.startsAt)}</span>. ¿Le das otra?
          </p>
          <Button
            loading={busy}
            icon={<CalendarClock aria-hidden="true" className="size-5" />}
            onClick={() =>
              void run(
                () =>
                  createAppointment(getDb(), missed.patientId, {
                    startsAt: weekLater(missed.startsAt),
                    minutes: missed.minutes,
                    assignedTo: missed.assignedTo ?? null,
                  }),
                `Nueva cita: ${fmtVisit(weekLater(missed.startsAt))}`,
              )
            }
          >
            Otra cita la semana que viene, a la misma hora
          </Button>
          <Button variant="secondary" loading={busy} icon={<RotateCcw aria-hidden="true" className="size-5" />} onClick={() => void run(() => updateAppointment(getDb(), missed.id, { status: "scheduled" }), "Deshecho: la cita vuelve a estar pendiente")}>
            Deshacer «No vino»
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Listo
          </Button>
        </div>
      ) : freed ? (
        <div className="flex flex-col gap-3">
          <Alert tone="info" title={freed.waiting === 1 ? "Hay 1 paciente en la lista de espera" : `Hay ${freed.waiting} pacientes en la lista de espera`}>
            Se ha quedado libre el hueco del {fmtVisit(freed.startsAt)}. ¿Se lo ofreces?
          </Alert>
          <Link
            ref={offerRef}
            to={`/agenda/espera?${new URLSearchParams({ hueco: freed.startsAt, min: String(freed.minutes), sin: freed.patientId, ...(freed.assignedTo ? { con: freed.assignedTo } : {}) })}`}
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover"
          >
            <Hourglass aria-hidden="true" className="size-5" /> Ofrecer el hueco
          </Link>
          <Button variant="secondary" onClick={onClose}>
            Ahora no
          </Button>
        </div>
      ) : appointment && !editing ? (
        <>
          <p>
            <span className="font-semibold">{fmtVisit(appointment.startsAt)}</span> · {appointment.minutes} min ·{" "}
            <span className={appointment.status === "scheduled" ? "" : "font-semibold"}>{STATUS_LABELS[appointment.status]}</span>
            {staff.length > 0 && <> · Con {staffName(staff, appointment.assignedTo)}</>}
          </p>
          {appointment.status === "scheduled" && (appointment.confirmedAt || appointment.remindedAt) && (
            <p className="text-sm">
              {appointment.confirmedAt ? (
                <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">Confirmada</span>
              ) : (
                <span className="rounded-full bg-accent-soft px-2 py-0.5">Recordada el {fmtVisit(appointment.remindedAt!)}</span>
              )}
            </p>
          )}
          {lastEdit && <p className="text-xs text-text-muted">Última modificación: {editText(lastEdit)}</p>}

          {/* Antes del día de la cita: recordarla. El día de la cita (o después, sin marcar): atenderla. */}
          {phase === "future" && extra.data && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {extra.data.contact !== false && extra.data.wa && (
                  <a
                    href={whatsappUrl(extra.data.wa, extra.data.reminder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover"
                    onClick={() => void markReminded(getDb(), appointment.id).then(() => bumpData())}
                  >
                    <MessageCircle aria-hidden="true" className="size-5" /> Recordar por WhatsApp
                  </a>
                )}
                {extra.data.contact !== false && extra.data.email && (
                  <a
                    href={mailtoUrl(extra.data.email, "Recordatorio de tu cita", extra.data.reminder)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-4 font-semibold hover:bg-surface"
                    onClick={() => void markReminded(getDb(), appointment.id).then(() => bumpData())}
                  >
                    <Mail aria-hidden="true" className="size-5" /> Correo
                  </a>
                )}
                {extra.data.phone && (
                  <a href={`tel:${extra.data.phone.replace(/\s+/g, "")}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-4 font-semibold hover:bg-surface">
                    <Phone aria-hidden="true" className="size-5" /> Llamar
                  </a>
                )}
              </div>
              {extra.data.contact === false && <p className="text-sm text-text-muted">No acepta WhatsApp ni correo.</p>}
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                loading={busy}
                onClick={() => void run(() => markConfirmed(getDb(), appointment.id, !appointment.confirmedAt), appointment.confirmedAt ? "Confirmación quitada" : "Anotado: confirmada")}
              >
                {appointment.confirmedAt ? "Quitar la confirmación" : "Ha confirmado que viene"}
              </Button>
            </div>
          )}
          {phase === "now" && (
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <Link
                to={`/pacientes/${patientId}/sesiones/nueva?hora=${encodeURIComponent(appointment.startsAt)}`}
                onClick={onClose}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-3 text-center font-semibold text-on-accent hover:bg-accent-hover"
              >
                <NotebookPen aria-hidden="true" className="size-5 shrink-0" /> Atender: apuntar la sesión
              </Link>
              <Button variant="secondary" size="lg" loading={busy} icon={<UserX aria-hidden="true" className="size-5" />} onClick={() => void markMissed()}>
                No vino
              </Button>
            </div>
          )}

          {extra.data && (
            <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">Cuenta: </span>
                  {accountLine(extra.data.a) ?? "al día"}
                </p>
                {!paying && (
                  <Button size="sm" variant="secondary" icon={<Wallet aria-hidden="true" className="size-4" />} onClick={() => setPaying(true)}>
                    Cobrar
                  </Button>
                )}
              </div>
              {paying && (
                <PaymentForm
                  today={todayDay()}
                  suggested={extra.data.a.balanceCents > 0 ? extra.data.a.balanceCents : extra.data.pricing.sessionCents}
                  concept="Sesión de fisioterapia"
                  submitLabel="Cobrar"
                  onSave={async (input) => {
                    await addPayment(getDb(), appointment.patientId, input);
                    setPaying(false);
                    toast(`Cobrado: ${euros(input.amountCents)}`, "success");
                    bumpData();
                    extra.reload();
                  }}
                />
              )}
            </div>
          )}

          {/* Solo de una cita que ya ha empezado: el justificante dice que ha asistido. */}
          {(appointment.status === "done" || (appointment.status === "scheduled" && Date.parse(appointment.startsAt) <= Date.now())) && (
            <Link
              to={`/pacientes/${patientId}/justificante?cita=${appointment.id}`}
              onClick={onClose}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-bg px-5 font-semibold hover:bg-surface"
            >
              <FileCheck aria-hidden="true" className="size-5" /> Justificante de asistencia
            </Link>
          )}
          {appointment.status === "scheduled" ? (
            <details className="group rounded-md border border-border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 font-semibold [&::-webkit-details-marker]:hidden">
                Mover o cambiar la cita
                <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-2 px-3 pb-3">
                <div role="group" aria-label="Mover la cita" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [-60, "1 h antes"],
                      [60, "1 h después"],
                      [-24 * 60, "1 día antes"],
                      [24 * 60, "1 día después"],
                      [-7 * 24 * 60, "1 semana antes"],
                      [7 * 24 * 60, "1 semana después"],
                    ] as const
                  ).map(([m, text]) => (
                    <Button key={text} size="sm" variant="secondary" loading={busy} onClick={() => void nudge(m, text)}>
                      {text}
                    </Button>
                  ))}
                </div>
                <Button variant="secondary" icon={<Pencil aria-hidden="true" className="size-5" />} onClick={() => setEditing(true)}>
                  Cambiar el día o la hora
                </Button>
              </div>
            </details>
          ) : (
            <Button variant="secondary" loading={busy} icon={<RotateCcw aria-hidden="true" className="size-5" />} onClick={() => void setStatus("scheduled", "Cita pendiente otra vez")}>
              Volver a pendiente
            </Button>
          )}

          {/* Anular o borrar, con confirmación: anular la deja en la agenda (tachada); borrar la quita. */}
          {confirming ? (
            <div role="group" aria-label={confirming === "cancel" ? "Confirmar la anulación" : "Confirmar el borrado"} className="flex flex-col gap-2 rounded-md border border-danger p-3">
              <p className="text-sm font-semibold">
                {confirming === "cancel" ? "¿Anular la cita? Se queda en la agenda como anulada." : "¿Borrar la cita? Desaparece de la agenda."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  ref={confirmRef}
                  variant="danger"
                  loading={busy}
                  onClick={() =>
                    void release(
                      () => (confirming === "cancel" ? updateAppointment(getDb(), appointment.id, { status: "cancelled" }) : deleteAppointment(getDb(), appointment.id)),
                      confirming === "cancel" ? "Cita anulada" : "Cita borrada",
                    )
                  }
                >
                  {confirming === "cancel" ? "Sí, anular" : "Sí, borrar"}
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  No
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {appointment.status === "scheduled" && (
                <Button variant="secondary" icon={<CalendarX2 aria-hidden="true" className="size-5" />} onClick={() => setConfirming("cancel")}>
                  Anular
                </Button>
              )}
              <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-5" />} onClick={() => setConfirming("delete")}>
                Borrar la cita
              </Button>
            </div>
          )}
        </>
      ) : (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {!fixedPatient && !appointment && <PatientPicker
              picked={picked}
              onPick={(p) => {
                setPicked(p);
                setError(null);
              }}
            />}
          <TextField
            label="Día y hora"
            type="datetime-local"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              setClash(null);
            }}
          />
          <Chips label="Duración" options={DURATIONS} render={(o) => `${o} min`} value={[String(minutes)]} onChange={(v) => v[0] && setMinutes(Number(v[0]))} />
          {!appointment && (
            <SelectField label="Repetir" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
              {REPEATS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "No se repite" : `Cada semana, ${n} citas`}
                </option>
              ))}
            </SelectField>
          )}
          {staff.length > 0 && (
            <SelectField
              label="Con quién"
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                setClash(null);
              }}
            >
              <option value="">Sin asignar</option>
              {staff.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name}
                </option>
              ))}
              {assignedTo && !staff.some((p) => p.email === assignedTo) && <option value={assignedTo}>{assignedTo}</option>}
            </SelectField>
          )}
          {clash && (
            <Alert tone="warning" title={clash.length === 1 ? "A esa hora ya hay una cita" : `A esas horas ya hay ${clash.length} citas`}>
              {clash
                .slice(0, 3)
                .map((c) => `${c.name}, ${fmtVisit(c.startsAt)}${staff.length && c.assignedTo ? ` (con ${staffName(staff, c.assignedTo)})` : ""}`)
                .join(" · ")}
              {clash.length > 3 ? "…" : ""}. Cambia la hora{staff.length ? " o con quién es" : ""}, o dala igualmente.
            </Alert>
          )}
          <Button type="submit" block loading={busy}>
            {appointment ? "Guardar el cambio" : repeat > 1 ? `Dar las ${repeat} citas` : "Dar la cita"}
          </Button>
          {clash && (
            <Button variant="secondary" block loading={busy} onClick={() => void save(true)}>
              {appointment ? "Guardar igualmente" : "Darla igualmente"}
            </Button>
          )}
          {onShiftInstead && !appointment && (
            <Button variant="ghost" block icon={<CalendarClock aria-hidden="true" className="size-5" />} onClick={onShiftInstead}>
              Poner un turno aquí en vez de una cita
            </Button>
          )}
          {appointment && (
            <Button variant="secondary" block onClick={() => setEditing(false)}>
              Volver
            </Button>
          )}
        </form>
      )}
      {error && <Alert tone="danger" title={error} />}
    </Sheet>
  );
}

/** Elegir el paciente de una cita nueva (desde la agenda): buscar por nombre o teléfono y tocarlo. */
export function PatientPicker({ picked, onPick }: { picked: { id: string; name: string } | null; onPick: (p: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const all = useAsync(() => listPatients(getDb()), []);
  const found = (all.data ?? []).filter((p) => p.name !== QUICK_PATIENT && matchesPatient(p, q)).slice(0, 6);
  if (picked)
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
        <span>
          Paciente: <span className="font-semibold">{picked.name}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => onPick(null)}>
          Cambiar
        </Button>
      </div>
    );
  const exact = found.some((p) => p.name.trim().toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="flex flex-col gap-2">
      <TextField label="Paciente" placeholder="Busca por nombre o teléfono" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      {/* Primero los que ya existen (con su teléfono, por si hay dos con el mismo nombre); crear uno nuevo, al final. */}
      <ul aria-label="Pacientes" className="flex flex-col divide-y divide-border rounded-md border border-border">
        {found.map((p) => (
          <li key={p.id}>
            <button type="button" className="tap flex w-full items-baseline justify-between gap-3 px-3 text-left hover:bg-surface" onClick={() => onPick({ id: p.id, name: p.name })}>
              <span className="font-semibold">{p.name}</span>
              {p.phone && <span className="text-sm text-text-muted">{p.phone}</span>}
            </button>
          </li>
        ))}
        {all.data && !found.length && <li className="px-3 py-2 text-sm text-text-muted">Ningún paciente con ese nombre.</li>}
      </ul>
      {q.trim() && !exact && (
        <Button
          variant="ghost"
          className="self-start"
          loading={adding}
          icon={<UserPlus aria-hidden="true" className="size-5" />}
          onClick={async () => {
            setAdding(true);
            try {
              const name = q.trim().replace(/\s+/g, " ");
              const id = await createPatient(getDb(), { name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
              onPick({ id, name });
            } finally {
              setAdding(false);
            }
          }}
        >
          {found.length ? `No es ninguno: crear «${q.trim()}»` : `Paciente nuevo: «${q.trim()}»`}
        </Button>
      )}
      {!q.trim() && <p className="text-sm text-text-muted">¿Es nuevo? Escribe su nombre y créalo aquí mismo; el resto de su ficha, cuando venga.</p>}
    </div>
  );
}
