// Los campos para apuntar un evento del calendario del paciente (qué es, cuándo, a qué hora, una nota), sin base de
// datos: los usan la hoja de la clínica (EventSheet.tsx) y la página del paciente («Tu calendario» por enlace,
// src/patientForm/PublicFormPage.tsx). Cada tipo propone lo normal mientras no se toque «Cuándo».
import { todayDay } from "../app/dates";
import { DEFAULT_EVENT_MINUTES, EVENT_KINDS, EVENT_LIMITS, weekdayName, weekdayOf, type EventInput, type EventKind, type PatientEvent } from "../data/patientEvents";
import { TextAreaField, TextField } from "../ui/Field";
import { Chips } from "./parts";

export type Span = "one" | "several" | "weekly";
const SPANS: { id: Span; label: string }[] = [
  { id: "one", label: "Un día" },
  { id: "several", label: "Varios días" },
  { id: "weekly", label: "Cada semana" },
];
const DURATIONS = [30, 60, 90, 120];
const WEEK = [1, 2, 3, 4, 5, 6, 7];
const short = (d: number) => weekdayName(d).slice(0, 3).replace(/^./, (c) => c.toUpperCase());

/** Lo normal de cada tipo: un entrenamiento se repite cada semana; un viaje dura varios días; lo demás, un día. */
export const spanFor = (kind: EventKind | ""): Span => (kind === "training" ? "weekly" : kind === "travel" ? "several" : "one");

/** Lo que se está escribiendo. `spanTouched`: si ya se eligió «Cuándo» a mano (entonces cambiar el tipo no lo toca). */
export type EventDraft = {
  kind: EventKind | "";
  title: string;
  span: Span;
  spanTouched: boolean;
  startsOn: string;
  endsOn: string;
  repeatDays: number[];
  repeatUntil: string;
  time: string;
  minutes: number;
  notes: string;
};

/** Para empezar: lo de un evento que se cambia o, uno nuevo, vacío (el día que se miraba o hoy; el tipo, si se sabe). */
export function draftOf(event: PatientEvent | null, day?: string | null, kind?: EventKind): EventDraft {
  if (event)
    return {
      kind: event.kind,
      title: event.title,
      span: event.repeatDays.length ? "weekly" : event.endsOn ? "several" : "one",
      spanTouched: true,
      startsOn: event.startsOn,
      endsOn: event.endsOn ?? "",
      repeatDays: event.repeatDays,
      repeatUntil: event.repeatUntil ?? "",
      time: event.time ?? "",
      minutes: event.minutes ?? DEFAULT_EVENT_MINUTES,
      notes: event.notes,
    };
  const k = kind ?? "";
  const startsOn = day ?? todayDay();
  return {
    kind: k,
    title: "",
    span: spanFor(k),
    spanTouched: false,
    startsOn,
    endsOn: "",
    repeatDays: spanFor(k) === "weekly" ? [weekdayOf(startsOn)] : [],
    repeatUntil: "",
    time: "",
    minutes: DEFAULT_EVENT_MINUTES,
    notes: "",
  };
}

/** Lo que falta antes de guardarlo (lo demás lo comprueba `checkEvent`). */
export function draftError(d: EventDraft): string | null {
  if (!d.kind) return "Elige qué es.";
  if (d.span === "several" && !d.endsOn) return "Pon el último día.";
  if (d.span === "weekly" && d.repeatDays.length === 0) return "Elige qué días de la semana.";
  return null;
}

/** Lo que se guarda (sin `kind` vacío: antes, `draftError`). */
export function draftInput(d: EventDraft, skipDays: string[] = []): EventInput {
  return {
    kind: d.kind as EventKind,
    title: d.title,
    startsOn: d.startsOn,
    endsOn: d.span === "several" ? d.endsOn : null,
    time: d.time || null,
    minutes: d.time ? d.minutes : null,
    repeatDays: d.span === "weekly" ? d.repeatDays : [],
    repeatUntil: d.span === "weekly" ? d.repeatUntil || null : null,
    notes: d.notes,
    skipDays,
  };
}

export function EventFields({ value: d, onChange }: { value: EventDraft; onChange: (d: EventDraft) => void }) {
  const set = (patch: Partial<EventDraft>) => onChange({ ...d, ...patch });
  const hint = EVENT_KINDS.find((k) => k.id === d.kind)?.hint;
  const durations = DURATIONS.includes(d.minutes) ? DURATIONS : [...DURATIONS, d.minutes].sort((a, b) => a - b);
  return (
    <>
      <Chips
        label="Qué es"
        options={EVENT_KINDS.map((k) => k.id)}
        render={(o) => EVENT_KINDS.find((k) => k.id === o)!.label}
        value={d.kind ? [d.kind] : []}
        onChange={(v) => {
          const kind = (v[0] as EventKind | undefined) ?? "";
          // Lo normal de cada tipo, mientras no se haya elegido «Cuándo» a mano.
          if (d.spanTouched) return set({ kind });
          const span = spanFor(kind);
          set({ kind, span, repeatDays: span === "weekly" && d.repeatDays.length === 0 && d.startsOn ? [weekdayOf(d.startsOn)] : d.repeatDays });
        }}
      />
      <TextField label="Nombre (si quieres)" hint={hint} value={d.title} maxLength={EVENT_LIMITS.title} onChange={(e) => set({ title: e.target.value })} />
      <Chips
        label="Cuándo"
        options={SPANS.map((s) => s.id)}
        render={(o) => SPANS.find((s) => s.id === o)!.label}
        value={[d.span]}
        onChange={(v) => {
          if (!v[0]) return;
          const span = v[0] as Span;
          // Cada semana: de entrada, el día de la semana del día puesto.
          set({ span, spanTouched: true, repeatDays: span === "weekly" && d.repeatDays.length === 0 && d.startsOn ? [weekdayOf(d.startsOn)] : d.repeatDays });
        }}
      />
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <TextField
          label={d.span === "one" ? "Día" : d.span === "several" ? "Primer día" : "Desde"}
          type="date"
          value={d.startsOn}
          required
          onChange={(e) => set({ startsOn: e.target.value })}
        />
        {d.span === "several" && <TextField label="Último día" type="date" value={d.endsOn} min={d.startsOn} onChange={(e) => set({ endsOn: e.target.value })} />}
        {d.span === "weekly" && (
          <TextField label="Hasta (si acaba)" type="date" value={d.repeatUntil} min={d.startsOn} hint="Sin fecha, sigue." onChange={(e) => set({ repeatUntil: e.target.value })} />
        )}
      </div>
      {d.span === "weekly" && (
        <Chips
          label="Qué días"
          multiple
          options={WEEK.map(String)}
          render={(o) => short(Number(o))}
          value={d.repeatDays.map(String)}
          onChange={(v) => set({ repeatDays: v.map(Number).sort((a, b) => a - b) })}
        />
      )}
      <TextField label="Hora (si la tiene)" type="time" value={d.time} hint="Sin hora, es de todo el día." onChange={(e) => set({ time: e.target.value })} />
      {d.time && (
        <Chips label="Cuánto dura" options={durations.map(String)} render={(o) => `${o} min`} value={[String(d.minutes)]} onChange={(v) => v[0] && set({ minutes: Number(v[0]) })} />
      )}
      <TextAreaField label="Nota (si quieres)" rows={2} value={d.notes} maxLength={EVENT_LIMITS.notes} onChange={(e) => set({ notes: e.target.value })} />
    </>
  );
}
