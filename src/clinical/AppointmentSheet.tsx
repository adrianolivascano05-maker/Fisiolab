// Dar, cambiar o cerrar una cita (src/data/appointments.ts): desde la cabecera de la ficha (la próxima cita o «Dar
// cita») y desde la agenda de hoy en Pacientes. Al cambiar algo se recargan las pantallas (y, con la cuenta de
// Google, el calendario se pone al día solo). En una clínica, también con quién es (el horario, src/schedule).
import { CalendarX2, NotebookPen, Pencil, RotateCcw, Trash, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { createAppointment, deleteAppointment, STATUS_LABELS, updateAppointment, type Appointment, type AppointmentStatus } from "../data/appointments";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { staffName, useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { DEFAULT_VISIT_MINUTES, fmtVisit } from "./calendar";
import { localInput } from "./pageKit";
import { Chips } from "./parts";

const DURATIONS = ["30", "45", "60", "90"];

export function AppointmentSheet({
  open,
  onClose,
  patientId,
  patientName,
  appointment,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  /** La cita que se gestiona; null para dar una nueva. */
  appointment: Appointment | null;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(!appointment);
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_VISIT_MINUTES);
  const staff = useStaff();
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre: con los datos de la cita, o vacía para dar una nueva.
  useEffect(() => {
    if (!open) return;
    setEditing(!appointment);
    setWhen(appointment ? localInput(appointment.startsAt) : "");
    setMinutes(appointment?.minutes ?? DEFAULT_VISIT_MINUTES);
    setAssignedTo(appointment ? (appointment.assignedTo ?? "") : (memberEmail() ?? ""));
    setError(null);
  }, [open, appointment]);

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

  const save = () => {
    if (!when) return setError("Pon el día y la hora de la cita.");
    const startsAt = new Date(when).toISOString();
    // Sin equipo (sin clínica) no se toca con quién es.
    const who = staff.length ? { assignedTo: assignedTo || null } : {};
    return run(
      () =>
        appointment
          ? updateAppointment(getDb(), appointment.id, { startsAt, minutes, ...who })
          : createAppointment(getDb(), patientId, { startsAt, minutes, ...who }),
      appointment ? "Cita cambiada" : "Cita dada",
    );
  };
  const setStatus = (status: AppointmentStatus, done: string) => run(() => updateAppointment(getDb(), appointment!.id, { status }), done);

  return (
    <Sheet open={open} onClose={onClose} title={appointment && !editing ? `Cita de ${patientName}` : appointment ? "Cambiar la cita" : `Dar cita a ${patientName}`}>
      {appointment && !editing ? (
        <>
          <p>
            <span className="font-semibold">{fmtVisit(appointment.startsAt)}</span> · {appointment.minutes} min ·{" "}
            <span className={appointment.status === "scheduled" ? "" : "font-semibold"}>{STATUS_LABELS[appointment.status]}</span>
            {staff.length > 0 && <> · Con {staffName(staff, appointment.assignedTo)}</>}
          </p>
          {appointment.status !== "done" && (
            <Link
              to={`/pacientes/${patientId}/sesiones/nueva`}
              onClick={onClose}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover"
            >
              <NotebookPen aria-hidden="true" className="size-5" /> Atender: apuntar la sesión
            </Link>
          )}
          {appointment.status === "scheduled" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" loading={busy} icon={<UserX aria-hidden="true" className="size-5" />} onClick={() => void setStatus("no_show", "Anotado: no vino")}>
                No vino
              </Button>
              <Button variant="secondary" loading={busy} icon={<CalendarX2 aria-hidden="true" className="size-5" />} onClick={() => void setStatus("cancelled", "Cita anulada")}>
                Anular
              </Button>
            </div>
          ) : (
            <Button variant="secondary" loading={busy} icon={<RotateCcw aria-hidden="true" className="size-5" />} onClick={() => void setStatus("scheduled", "Cita pendiente otra vez")}>
              Volver a pendiente
            </Button>
          )}
          <Button variant="secondary" icon={<Pencil aria-hidden="true" className="size-5" />} onClick={() => setEditing(true)}>
            Cambiar el día o la hora
          </Button>
          <Button variant="ghost" className="text-danger" loading={busy} icon={<Trash aria-hidden="true" className="size-5" />} onClick={() => void run(() => deleteAppointment(getDb(), appointment.id), "Cita borrada")}>
            Borrar la cita
          </Button>
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
          <TextField label="Día y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Chips label="Duración" options={DURATIONS} render={(o) => `${o} min`} value={[String(minutes)]} onChange={(v) => v[0] && setMinutes(Number(v[0]))} />
          {staff.length > 0 && (
            <SelectField label="Con quién" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Sin asignar</option>
              {staff.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name}
                </option>
              ))}
              {assignedTo && !staff.some((p) => p.email === assignedTo) && <option value={assignedTo}>{assignedTo}</option>}
            </SelectField>
          )}
          <Button type="submit" block loading={busy}>
            {appointment ? "Guardar el cambio" : "Dar la cita"}
          </Button>
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
