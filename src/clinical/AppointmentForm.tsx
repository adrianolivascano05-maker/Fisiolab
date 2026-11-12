// El formulario de la hoja de la cita (AppointmentSheet.tsx): dar una cita nueva (una o una serie semanal) o cambiar
// el día, la hora, la duración y con quién es. `useAppointmentForm` guarda lo que se escribe y comprueba los choques;
// `AppointmentForm` lo pinta.
import { CalendarClock, Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { clashes, createSeries, updateAppointment, type AgendaItem, type Appointment } from "../data/appointments";
import { planSeries, trainingWeek } from "../data/seriesPlan";
import { useAsync } from "../app/useAsync";
import { dayOf } from "../app/dates";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { eventName, eventsAtVisit, eventTime, listPatientEvents, type Occurrence } from "../data/patientEvents";
import { staffName, useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { DEFAULT_VISIT_MINUTES, fmtVisit } from "./calendar";
import { localInput } from "./pageKit";
import { Chips } from "./parts";
import { PatientPicker, type PickedPatient } from "./PatientPicker";

const DURATIONS = ["30", "45", "60", "90"];
/** «la semana del 24 nov». */
const weekOf = (iso: string) => `La semana del ${new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}`;
const skippedText = (n: number) => (n === 1 ? "se salta una semana de viaje" : `se saltan ${n} semanas de viaje`);
/** «jue 12 nov». */
const dayWithWeekday = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
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
  /** Lo que el paciente tiene ese día en su calendario (una operación, un viaje, un entrenamiento a esa hora): también se avisa. */
  const [busyDay, setBusyDay] = useState<Occurrence[] | null>(null);
  /** Su calendario (src/data/patientEvents.ts): para la serie (se salta sus viajes) y para decir qué días entrena. */
  const events = useAsync(async () => (open && patientId ? listPatientEvents(getDb(), patientId) : []), [open, patientId], { tables: ["events"] });
  const whenIso = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null;
  /** Una serie (cita nueva, «Cada semana»): las semanas que se salta por sus viajes, para verlo antes de darla. */
  const plan = whenIso && !appointment && repeat > 1 ? planSeries(whenIso, repeat, minutes, events.data ?? []) : null;
  /** Sus entrenamientos de cada semana y los días en que no entrena, para elegir uno libre. */
  const training = whenIso ? trainingWeek(events.data ?? [], dayOf(whenIso)) : null;

  // Cada vez que se abre: con los datos de la cita, o vacía para dar una nueva.
  useEffect(() => {
    if (!open) return;
    setWhen(appointment ? localInput(appointment.startsAt) : start ? localInput(start) : "");
    setMinutes(appointment?.minutes ?? DEFAULT_VISIT_MINUTES);
    setAssignedTo(appointment ? (appointment.assignedTo ?? "") : person !== undefined ? (person ?? "") : (memberEmail() ?? ""));
    setPicked(null);
    setRepeat(1);
    setClash(null);
    setBusyDay(null);
  }, [open, appointment, start, person]);

  const save = async (anyway = false) => {
    if (!patientId) return setError("Elige el paciente.");
    if (!when) return setError("Pon el día y la hora de la cita.");
    const startsAt = new Date(when).toISOString();
    // Sin equipo (sin clínica) no se toca con quién es.
    const who = staff.length ? { assignedTo: assignedTo || null } : {};
    const count = appointment ? 1 : repeat;
    const evs = await listPatientEvents(getDb(), patientId);
    // Una serie se salta las semanas en que está de viaje (y sigue después); una cita sola, no: de esa se avisa.
    const series = count > 1 ? planSeries(startsAt, count, minutes, evs) : { starts: [startsAt], skipped: [] };
    if (!series.starts.length) return setError("Todas esas semanas está de viaje: elige otro día.");
    if (!anyway) {
      // ¿Ya hay algo a esa hora (de esa persona, en una clínica)? ¿Tiene él algo ese día? Se avisa; se puede dar igualmente.
      const found: AgendaItem[] = [];
      const his: Occurrence[] = [];
      for (const at of series.starts) {
        found.push(...(await clashes(getDb(), at, minutes, staff.length ? who.assignedTo : undefined, appointment?.id)));
        his.push(...eventsAtVisit(evs, at, minutes));
      }
      setClash(found.length ? found : null);
      setBusyDay(his.length ? his : null);
      if (found.length || his.length) return;
    }
    setClash(null);
    setBusyDay(null);
    const last = series.starts.at(-1)!;
    const n = series.starts.length;
    return run(
      () =>
        appointment
          ? updateAppointment(getDb(), appointment.id, { startsAt, minutes, ...who })
          : createSeries(getDb(), patientId, { minutes, ...who }, series.starts),
      appointment
        ? "Cita cambiada"
        : n > 1
          ? `${n} citas dadas, una por semana hasta el ${dayWithWeekday(dayOf(last))}${series.skipped.length ? `; ${skippedText(series.skipped.length)}` : ""}`
          : "Cita dada",
      appointment ? undefined : () => onCreated?.(patientId),
    );
  };

  /** Al cambiar el día, la hora, la duración o con quién: los avisos ya no valen. */
  const clearWarnings = () => {
    setClash(null);
    setBusyDay(null);
  };
  return { picked, setPicked, patientId, when, setWhen, minutes, setMinutes, assignedTo, setAssignedTo, repeat, setRepeat, clash, setClash, busyDay, setBusyDay, clearWarnings, plan, training, save };
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
  const { picked, setPicked, when, setWhen, minutes, setMinutes, assignedTo, setAssignedTo, repeat, setRepeat, clash, busyDay, clearWarnings, plan, training, save } = form;
  const warned = !!clash || !!busyDay;
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
            clearWarnings();
          }}
        />
      )}
      <TextField
        label="Día y hora"
        type="datetime-local"
        value={when}
        onChange={(e) => {
          setWhen(e.target.value);
          clearWarnings();
        }}
      />
      {training && (
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <Dumbbell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tingle" />
          <span>
            Entrena {training.text}.{training.free ? ` No entrena: ${training.free}.` : ""}
          </span>
        </p>
      )}
      <Chips label="Duración" options={DURATIONS} render={(o) => `${o} min`} value={[String(minutes)]} onChange={(v) => {
          if (!v[0]) return;
          setMinutes(Number(v[0]));
          clearWarnings();
        }} />
      {!appointment && (
        <SelectField label="Repetir" value={repeat} onChange={(e) => {
          setRepeat(Number(e.target.value));
          clearWarnings();
        }}>
          {REPEATS.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "No se repite" : `Cada semana, ${n} citas`}
            </option>
          ))}
        </SelectField>
      )}
      {plan && plan.skipped.length > 0 && (
        <Alert tone="info" title={plan.skipped.length === 1 ? "Se salta una semana: está de viaje" : `Se saltan ${plan.skipped.length} semanas: está de viaje`}>
          {plan.skipped.map((x) => `${weekOf(x.startsAt)} (${eventName(x.event)})`).join(" · ")}.{" "}
          {plan.starts.length ? `La última cita, el ${dayWithWeekday(dayOf(plan.starts.at(-1)!))}.` : "Elige otro día."}
        </Alert>
      )}
      {staff.length > 0 && (
        <SelectField
          label="Con quién"
          value={assignedTo}
          onChange={(e) => {
            setAssignedTo(e.target.value);
            clearWarnings();
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
      {busyDay && (
        <Alert tone="warning" title={busyDay.length === 1 ? "Ese día tiene algo en su calendario" : `Esos días tiene ${busyDay.length} cosas en su calendario`}>
          {busyDay
            .slice(0, 3)
            .map((o) => `${eventName(o.event)} (${dayWithWeekday(o.day)}, ${eventTime(o.event).toLowerCase()})`)
            .join(" · ")}
          {busyDay.length > 3 ? "…" : ""}. Cambia el día o la hora, o dala igualmente.
        </Alert>
      )}
      <Button type="submit" block loading={busy}>
        {appointment ? "Guardar el cambio" : repeat > 1 ? `Dar las ${repeat} citas` : "Dar la cita"}
      </Button>
      {warned && (
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
