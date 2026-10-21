// Dar, cambiar o cerrar una cita (src/data/appointments.ts): desde la cabecera de la ficha (la próxima cita o «Dar
// cita») y desde la agenda de hoy en Pacientes. Al cambiar algo se recargan las pantallas (y, con la cuenta de
// Google, el calendario se pone al día solo). En una clínica, también con quién es (el horario, src/schedule).
import { CalendarClock, CalendarX2, NotebookPen, Pencil, RotateCcw, Trash, UserPlus, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { clashes, createWeekly, deleteAppointment, STATUS_LABELS, updateAppointment, type AgendaItem, type Appointment, type AppointmentStatus } from "../data/appointments";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { createPatient, listPatients, matchesPatient, QUICK_PATIENT } from "../data/repo";
import { editText, lastEditOf } from "../data/editors";
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
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(1);
  /** Citas que ya hay a esa hora: se avisa antes de dar la cita. */
  const [clash, setClash] = useState<AgendaItem[] | null>(null);

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
          {lastEdit && <p className="text-xs text-text-muted">Última modificación: {editText(lastEdit)}</p>}
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
function PatientPicker({ picked, onPick }: { picked: { id: string; name: string } | null; onPick: (p: { id: string; name: string } | null) => void }) {
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
  return (
    <div className="flex flex-col gap-2">
      <TextField label="Paciente" placeholder="Busca por nombre o teléfono" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && !found.some((p) => p.name.trim().toLowerCase() === q.trim().toLowerCase()) && (
        <Button
          variant="secondary"
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
          Paciente nuevo: «{q.trim()}»
        </Button>
      )}
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
      {!q.trim() && <p className="text-sm text-text-muted">¿Es nuevo? Escribe su nombre y créalo aquí mismo; el resto de su ficha, cuando venga.</p>}
    </div>
  );
}
