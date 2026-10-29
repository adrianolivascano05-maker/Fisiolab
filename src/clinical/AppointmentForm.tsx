// El formulario de la hoja de la cita (AppointmentSheet.tsx): dar una cita nueva (una o una serie semanal) o cambiar
// el día, la hora, la duración y con quién es. `useAppointmentForm` guarda lo que se escribe y comprueba los choques;
// `AppointmentForm` lo pinta.
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { clashes, createWeekly, updateAppointment, type AgendaItem, type Appointment } from "../data/appointments";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { staffName, useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { DEFAULT_VISIT_MINUTES, fmtVisit } from "./calendar";
import { localInput } from "./pageKit";
import { Chips } from "./parts";
import { PatientPicker, type PickedPatient } from "./PatientPicker";

const DURATIONS = ["30", "45", "60", "90"];
/** Una serie de sesiones: cuántas citas, una por semana. */
const REPEATS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

export type Staff = ReturnType<typeof useStaff>;
/** Hacer algo con la cita y, si sale bien, avisar, recargar las pantallas y cerrar la hoja (AppointmentSheet.tsx). */
export type RunAction = (work: () => Promise<unknown>, done: string, after?: () => void) => Promise<void>;

export function useAppointmentForm({
  open,
  appointment,
  start,
  person,
  fixedPatient,
  staff,
  run,
  setError,
  onCreated,
}: {
  open: boolean;
  appointment: Appointment | null;
  start?: string;
  person?: string | null;
  fixedPatient?: string;
  staff: Staff;
  run: RunAction;
  setError: (e: string | null) => void;
  onCreated?: (patientId: string) => void;
}) {
  const [picked, setPicked] = useState<PickedPatient | null>(null);
  const patientId = fixedPatient ?? picked?.id ?? "";
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_VISIT_MINUTES);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [repeat, setRepeat] = useState(1);
  /** Citas que ya hay a esa hora: se avisa antes de dar la cita. */
  const [clash, setClash] = useState<AgendaItem[] | null>(null);

  // Cada vez que se abre: con los datos de la cita, o vacía para dar una nueva.
  useEffect(() => {
    if (!open) return;
    setWhen(appointment ? localInput(appointment.startsAt) : start ? localInput(start) : "");
    setMinutes(appointment?.minutes ?? DEFAULT_VISIT_MINUTES);
    setAssignedTo(appointment ? (appointment.assignedTo ?? "") : person !== undefined ? (person ?? "") : (memberEmail() ?? ""));
    setPicked(null);
    setRepeat(1);
    setClash(null);
  }, [open, appointment, start, person]);

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
      appointment ? undefined : () => onCreated?.(patientId),
    );
  };

  return { picked, setPicked, patientId, when, setWhen, minutes, setMinutes, assignedTo, setAssignedTo, repeat, setRepeat, clash, setClash, save };
}

export type AppointmentFormState = ReturnType<typeof useAppointmentForm>;

export function AppointmentForm({
  form,
  appointment,
  fixedPatient,
  staff,
  busy,
  setError,
  onShiftInstead,
  onBack,
}: {
  form: AppointmentFormState;
  appointment: Appointment | null;
  fixedPatient?: string;
  staff: Staff;
  busy: boolean;
  setError: (e: string | null) => void;
  /** Desde un hueco de la agenda de una clínica: poner ahí un turno en vez de una cita. */
  onShiftInstead?: () => void;
  /** Al cambiar una cita: volver a verla sin guardar. */
  onBack: () => void;
}) {
  const { picked, setPicked, when, setWhen, minutes, setMinutes, assignedTo, setAssignedTo, repeat, setRepeat, clash, setClash, save } = form;
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {!fixedPatient && !appointment && (
        <PatientPicker
          picked={picked}
          onPick={(p) => {
            setPicked(p);
            setError(null);
          }}
        />
      )}
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
        <Button variant="secondary" block onClick={onBack}>
          Volver
        </Button>
      )}
    </form>
  );
}
