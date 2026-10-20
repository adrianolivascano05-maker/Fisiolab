// Dar, cambiar o cerrar una cita (src/data/appointments.ts): desde la cabecera de la ficha (la próxima cita o «Dar
// cita») y desde la agenda de hoy en Pacientes. Al cambiar algo se recargan las pantallas (y, con la cuenta de
// Google, el calendario se pone al día solo). En una clínica, también con quién es (el horario, src/schedule).
import { CalendarX2, NotebookPen, Pencil, RotateCcw, Trash, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { createAppointment, deleteAppointment, STATUS_LABELS, updateAppointment, type Appointment, type AppointmentStatus } from "../data/appointments";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { listPatients, matchesPatient, QUICK_PATIENT } from "../data/repo";
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
  patientId: fixedPatient,
  patientName,
  appointment,
  start,
  person,
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
}) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const patientId = fixedPatient ?? picked?.id ?? "";
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
    setWhen(appointment ? localInput(appointment.startsAt) : start ? localInput(start) : "");
    setMinutes(appointment?.minutes ?? DEFAULT_VISIT_MINUTES);
    setAssignedTo(appointment ? (appointment.assignedTo ?? "") : person !== undefined ? (person ?? "") : (memberEmail() ?? ""));
    setPicked(null);
    setError(null);
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

  const save = () => {
    if (!patientId) return setError("Elige el paciente.");
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
  /** Mover la cita sin escribir: una hora, un día o una semana antes o después. */
  const nudge = (minutes: number, label: string) => {
    const d = new Date(appointment!.startsAt);
    if (Math.abs(minutes) >= 24 * 60) d.setDate(d.getDate() + minutes / (24 * 60));
    else d.setMinutes(d.getMinutes() + minutes);
    return run(() => updateAppointment(getDb(), appointment!.id, { startsAt: d.toISOString() }), `Cita movida ${label}: ${fmtVisit(d.toISOString())}`);
  };
  const name = patientName ?? picked?.name ?? "";

  return (
    <Sheet open={open} onClose={onClose} title={appointment && !editing ? `Cita de ${name}` : appointment ? "Cambiar la cita" : patientName ? `Dar cita a ${patientName}` : "Nueva cita"}>
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
          {!fixedPatient && !appointment && <PatientPicker picked={picked} onPick={setPicked} />}
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

/** Elegir el paciente de una cita nueva (desde la agenda): buscar por nombre o teléfono y tocarlo. */
function PatientPicker({ picked, onPick }: { picked: { id: string; name: string } | null; onPick: (p: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState("");
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
  return (
    <div className="flex flex-col gap-2">
      <TextField label="Paciente" placeholder="Busca por nombre o teléfono" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul aria-label="Pacientes" className="flex flex-col divide-y divide-border rounded-md border border-border">
        {found.map((p) => (
          <li key={p.id}>
            <button type="button" className="tap w-full px-3 text-left hover:bg-surface" onClick={() => onPick({ id: p.id, name: p.name })}>
              {p.name}
            </button>
          </li>
        ))}
        {all.data && !found.length && <li className="px-3 py-2 text-sm text-text-muted">Ningún paciente con ese nombre.</li>}
      </ul>
      <Link to="/pacientes/nuevo" className="text-sm font-semibold text-accent underline underline-offset-2">
        Paciente nuevo
      </Link>
    </div>
  );
}
