// Dar, cambiar o cerrar una cita (src/data/appointments.ts): desde la cabecera de la ficha (la próxima cita o «Dar
// cita») y desde la agenda de hoy en Pacientes. Al cambiar algo se recargan las pantallas (y, con la cuenta de
// Google, el calendario se pone al día solo). En una clínica, también con quién es (el horario, src/schedule).
// El formulario está en AppointmentForm.tsx y los paneles (recordar, cobrar, «No vino», hueco libre) en
// appointmentPanels.tsx; aquí, el estado de la hoja y la vista de la cita.
import { CalendarX2, ChevronDown, FileCheck, NotebookPen, Pencil, RotateCcw, Trash, UserRound, UserX, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { madridDay } from "../app/format";
import { getClinic } from "../data/privacy";
import { loadMessages, messageSubject } from "../messages/templates";
import { appointmentVars, reminderMessage, waPhone } from "../schedule/reminders";
import { deleteAppointment, STATUS_LABELS, updateAppointment, type Appointment, type AppointmentStatus } from "../data/appointments";
import { useAsync } from "../app/useAsync";
import { getPricing, patientAccount } from "../data/billing";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { editText, lastEditOf } from "../data/editors";
import { listWaitlist } from "../data/waitlist";
import { staffName, useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { fmtVisit, visitEvent } from "./calendar";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { todayDay } from "./pageKit";
import { AppointmentForm, useAppointmentForm } from "./AppointmentForm";
import { FreedSlotPanel, MissedPanel, PayPanel, ReminderActions, type FreedSlot } from "./appointmentPanels";

export function AppointmentSheet({
  open,
  onClose,
  patientId: fixedPatient,
  patientName,
  appointment,
  start,
  person,
  onShiftInstead,
  backToToday,
  onCreated,
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
  /** Abierta desde Agenda › Hoy: al atender, la sesión vuelve a Hoy. */
  backToToday?: boolean;
  /** Al dar una cita nueva (después de guardarla): p. ej., preguntar si sale de la lista de espera. */
  onCreated?: (patientId: string) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(!appointment);
  const staff = useStaff();
  const autoCalendar = useAutoCalendar();
  const edit = useAsync(async () => (open && appointment && staff.length ? lastEditOf(getDb(), "appointments", appointment.id) : null), [open, appointment?.id, staff.length]);
  const lastEdit = edit.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Su cuenta (bono y pendiente, para cobrar aquí mismo) y cómo recordarle la cita (teléfono, correo, permiso, mensaje). */
  const extra = useAsync(async () => {
    if (!open || !appointment) return null;
    const db = getDb();
    const [a, pricing, patient, clinic, messages] = await Promise.all([
      patientAccount(db, appointment.patientId, todayDay()),
      getPricing(db),
      getPatient(db, appointment.patientId),
      getClinic(db),
      loadMessages(db),
    ]);
    const vars = {
      name: patient?.name ?? "",
      startsAt: appointment.startsAt,
      clinic: clinic.name,
      professional: staff.length && appointment.assignedTo ? staffName(staff, appointment.assignedTo) : null,
    };
    return {
      a,
      pricing,
      phone: patient?.phone ?? "",
      wa: waPhone(patient?.phone ?? ""),
      email: patient?.email ?? "",
      contact: patient?.privacy.consents?.contact ?? null,
      event: patient ? visitEvent({ id: appointment.id, nextAt: appointment.startsAt, nextMinutes: appointment.minutes }, patient) : null,
      reminder: reminderMessage(messages, vars),
      subject: messageSubject("recordatorio", messages, appointmentVars(vars)),
    };
  }, [open, appointment?.id, appointment?.startsAt]);
  /** Anular o borrar: primero se pregunta. */
  const [confirming, setConfirming] = useState<"cancel" | "delete" | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  /** Antes del día de la cita («future»), el día o después sin marcar («now»), o ya marcada. */
  const phase = !appointment || appointment.status !== "scheduled" ? "marked" : madridDay(appointment.startsAt) > madridDay(new Date().toISOString()) ? "future" : "now";
  /** Al anular o borrar una cita futura con gente en la lista de espera: el hueco, para ofrecérselo. */
  const [freed, setFreed] = useState<FreedSlot | null>(null);
  /** Después de «No vino»: la cita marcada, para deshacerlo o darle otra. */
  const [missed, setMissed] = useState<Appointment | null>(null);
  useEffect(() => {
    if (open) {
      setFreed(null);
      setMissed(null);
      setConfirming(null);
    }
  }, [open]);

  // Cada vez que se abre: ver la cita, o el formulario vacío para dar una nueva.
  useEffect(() => {
    if (!open) return;
    setEditing(!appointment);
    setError(null);
  }, [open, appointment, start, person]);

  async function run(work: () => Promise<unknown>, done: string, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await work();
      toast(done, "success");
      bumpData("appointments", "waitlist");
      onClose();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const form = useAppointmentForm({ open, appointment, start, person, fixedPatient, staff, run, setError, onCreated });
  const patientId = form.patientId;
  const setStatus = (status: AppointmentStatus, done: string) => run(() => updateAppointment(getDb(), appointment!.id, { status }), done);
  /** «No vino»: se anota y, en vez de cerrar, se ofrece darle otra cita o deshacerlo. */
  async function markMissed() {
    const a = appointment!;
    setBusy(true);
    setError(null);
    try {
      await updateAppointment(getDb(), a.id, { status: "no_show" });
      bumpData("appointments");
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
  /** Mover la cita sin escribir: una hora, un día o una semana antes o después. */
  const nudge = (minutes: number, label: string) => {
    const d = new Date(appointment!.startsAt);
    if (Math.abs(minutes) >= 24 * 60) d.setDate(d.getDate() + minutes / (24 * 60));
    else d.setMinutes(d.getMinutes() + minutes);
    return run(() => updateAppointment(getDb(), appointment!.id, { startsAt: d.toISOString() }), `Cita movida ${label}: ${fmtVisit(d.toISOString())}`);
  };
  const name = patientName ?? form.picked?.name ?? "";

  return (
    <Sheet open={open} onClose={onClose} title={missed ? `No vino: ${name}` : freed ? "Hueco libre" : appointment && !editing ? `Cita de ${name}` : appointment ? "Cambiar la cita" : patientName ? `Dar cita a ${patientName}` : "Nueva cita"}>
      {missed ? (
        <MissedPanel missed={missed} staff={staff} busy={busy} run={run} onClose={onClose} />
      ) : freed ? (
        <FreedSlotPanel freed={freed} onClose={onClose} />
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
          {/* Desde la cita, a la ficha: antes la agenda era un callejón sin salida. */}
          <Link to={`/pacientes/${patientId}`} onClick={onClose} className="-mx-1 flex min-h-11 items-center justify-between gap-2 rounded-md px-1 font-semibold text-accent hover:bg-surface">
            <span className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-5" /> Ver la ficha de {name}
            </span>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>

          {/* Antes del día de la cita: recordarla. El día de la cita (o después, sin marcar): atenderla. */}
          {phase === "future" && extra.data && <ReminderActions appointment={appointment} info={extra.data} autoCalendar={autoCalendar} busy={busy} run={run} />}
          {phase === "now" && (
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <Link
                to={`/pacientes/${patientId}/sesiones/nueva?hora=${encodeURIComponent(appointment.startsAt)}${backToToday ? "&volver=hoy" : ""}`}
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

          {extra.data && <PayPanel account={extra.data.a} pricing={extra.data.pricing} patientId={appointment.patientId} onPaid={extra.reload} />}

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
        <AppointmentForm form={form} appointment={appointment} fixedPatient={fixedPatient} staff={staff} busy={busy} setError={setError} onShiftInstead={onShiftInstead} onBack={() => setEditing(false)} />
      )}
      {error && <Alert tone="danger" title={error} />}
    </Sheet>
  );
}
