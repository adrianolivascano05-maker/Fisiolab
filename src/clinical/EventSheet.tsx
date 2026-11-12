// La hoja para apuntar o cambiar un evento del calendario del paciente (src/data/patientEvents.ts): qué es, cuándo (un
// día, varios seguidos o cada semana unos días), a qué hora si la tiene y una nota. Al cambiar uno que se repite se
// cambia la serie entera (es una sola cosa: «entrena martes y jueves»).
import { Trash } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { bumpData } from "../app/dataVersion";
import { todayDay } from "../app/dates";
import { getDb } from "../data/db";
import {
  dayLong,
  dayShort,
  DEFAULT_EVENT_MINUTES,
  deletePatientEvent,
  endedBefore,
  EVENT_KINDS,
  EVENT_LIMITS,
  eventName,
  repeatText,
  savePatientEvent,
  weekdayName,
  weekdayOf,
  withDay,
  withoutDay,
  type EventInput,
  type EventKind,
  type PatientEvent,
} from "../data/patientEvents";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextAreaField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { Chips } from "./parts";

type Span = "one" | "several" | "weekly";
const SPANS: { id: Span; label: string }[] = [
  { id: "one", label: "Un día" },
  { id: "several", label: "Varios días" },
  { id: "weekly", label: "Cada semana" },
];
const DURATIONS = [30, 60, 90, 120];
const WEEK = [1, 2, 3, 4, 5, 6, 7];
const short = (d: number) => weekdayName(d).slice(0, 3).replace(/^./, (c) => c.toUpperCase());

/** Lo normal de cada tipo: un entrenamiento se repite cada semana; un viaje dura varios días; lo demás, un día. */
const spanFor = (kind: EventKind | ""): Span => (kind === "training" ? "weekly" : kind === "travel" ? "several" : "one");

export function EventSheet({
  open,
  onClose,
  patientId,
  event,
  day,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  /** El que se cambia; null para apuntar uno nuevo. */
  event: PatientEvent | null;
  /** Para uno nuevo: el día que se estaba mirando (si no, hoy). Para uno que se repite: el día que se tocó. */
  day?: string | null;
  /** Para uno nuevo: lo que ya se sabe (desde la anamnesis, «Operación»). */
  preset?: { kind?: EventKind };
}) {
  // El formulario solo existe con la hoja abierta: cada vez que se abre, empieza de nuevo con lo del evento (o vacío).
  return (
    <Sheet open={open} onClose={onClose} title={event ? "Cambiar evento" : "Apuntar evento"}>
      {open && <EventForm key={event?.id ?? `nuevo-${day ?? ""}`} patientId={patientId} event={event} day={day} preset={preset} onDone={onClose} />}
    </Sheet>
  );
}

function EventForm({
  patientId,
  event,
  day,
  preset,
  onDone,
}: {
  patientId: string;
  event: PatientEvent | null;
  day?: string | null;
  preset?: { kind?: EventKind };
  onDone: () => void;
}) {
  const toast = useToast();
  const startKind: EventKind | "" = event?.kind ?? preset?.kind ?? "";
  const [kind, setKind] = useState<EventKind | "">(startKind);
  const [title, setTitle] = useState(event?.title ?? "");
  const [span, setSpan] = useState<Span>(event ? (event.repeatDays.length ? "weekly" : event.endsOn ? "several" : "one") : spanFor(startKind));
  /** Si ya se ha elegido «Cuándo» a mano: entonces cambiar el tipo no lo toca. */
  const [spanTouched, setSpanTouched] = useState(!!event);
  const [startsOn, setStartsOn] = useState(event?.startsOn ?? day ?? todayDay());
  const [endsOn, setEndsOn] = useState(event?.endsOn ?? "");
  const [repeatDays, setRepeatDays] = useState<number[]>(event?.repeatDays ?? (spanFor(startKind) === "weekly" ? [weekdayOf(event?.startsOn ?? day ?? todayDay())] : []));
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil ?? "");
  const [time, setTime] = useState(event?.time ?? "");
  const [minutes, setMinutes] = useState(event?.minutes ?? DEFAULT_EVENT_MINUTES);
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const hint = EVENT_KINDS.find((k) => k.id === kind)?.hint;
  const durations = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!kind) return setError("Elige qué es.");
    if (span === "several" && !endsOn) return setError("Pon el último día.");
    if (span === "weekly" && repeatDays.length === 0) return setError("Elige qué días de la semana.");
    setBusy(true);
    setError(null);
    try {
      await savePatientEvent(
        getDb(),
        patientId,
        {
          kind,
          title,
          startsOn,
          endsOn: span === "several" ? endsOn : null,
          time: time || null,
          minutes: time ? minutes : null,
          repeatDays: span === "weekly" ? repeatDays : [],
          repeatUntil: span === "weekly" ? repeatUntil || null : null,
          notes,
          skipDays: event?.skipDays ?? [],
        },
        event?.id,
      );
      bumpData("events");
      toast(event ? "Evento cambiado" : "Evento apuntado", "success");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /** Lo de un día de algo que se repite (no saldrá ese día, acabar ahí, volver a ponerlo): se guarda al momento. */
  const change = async (input: EventInput, done: string) => {
    if (!event) return;
    setBusy(true);
    try {
      await savePatientEvent(getDb(), patientId, input, event.id);
      bumpData("events");
      toast(done, "success");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const ended = event && day && event.repeatDays.length ? endedBefore(event, day) : null;

  const remove = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await deletePatientEvent(getDb(), event.id);
      bumpData("events");
      toast("Evento borrado", "success");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void save(e)}>
      <p className="text-sm text-text-muted">Lo suyo fuera de la clínica. No ocupa la agenda ni se le recuerda.</p>
      {/* Tocado un día de algo que se repite: lo de ese día, a un toque. */}
      {event && day && event.repeatDays.length > 0 && (
        <div role="group" aria-label={`Solo el ${dayLong(day)}`} className="flex flex-col gap-2 rounded-md bg-surface p-3">
          <p className="text-sm font-semibold first-letter:uppercase">{dayLong(day)}</p>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <Button variant="secondary" loading={busy} onClick={() => void change(withoutDay(event, day), `El ${dayShort(day)} ya no sale`)}>
              Este día no
            </Button>
            {ended && (
              <Button variant="secondary" loading={busy} onClick={() => void change(ended, `Hasta el ${dayShort(ended.repeatUntil!)}`)}>
                Desde este día ya no
              </Button>
            )}
          </div>
        </div>
      )}
      {event && event.skipDays.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Días que no</p>
          <ul className="flex flex-wrap gap-2">
            {event.skipDays.map((d) => (
              <li key={d}>
                <Button size="sm" variant="secondary" aria-label={`Volver a poner el ${dayShort(d)}`} loading={busy} onClick={() => void change(withDay(event, d), `El ${dayShort(d)} vuelve a salir`)}>
                  {dayShort(d)} · volver a poner
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Chips
        label="Qué es"
        options={EVENT_KINDS.map((k) => k.id)}
        render={(o) => EVENT_KINDS.find((k) => k.id === o)!.label}
        value={kind ? [kind] : []}
        onChange={(v) => {
          const next = (v[0] as EventKind | undefined) ?? "";
          setKind(next);
          // Lo normal de cada tipo, mientras no se haya elegido «Cuándo» a mano.
          if (!spanTouched) {
            setSpan(spanFor(next));
            if (spanFor(next) === "weekly" && repeatDays.length === 0 && startsOn) setRepeatDays([weekdayOf(startsOn)]);
          }
          setError(null);
        }}
      />
      <TextField label="Nombre (si quieres)" hint={hint} value={title} maxLength={EVENT_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
      <Chips
        label="Cuándo"
        options={SPANS.map((s) => s.id)}
        render={(o) => SPANS.find((s) => s.id === o)!.label}
        value={[span]}
        onChange={(v) => {
          if (!v[0]) return;
          const next = v[0] as Span;
          setSpan(next);
          setSpanTouched(true);
          // Cada semana: de entrada, el día de la semana del día puesto.
          if (next === "weekly" && repeatDays.length === 0 && startsOn) setRepeatDays([weekdayOf(startsOn)]);
          setError(null);
        }}
      />
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <TextField
          label={span === "one" ? "Día" : span === "several" ? "Primer día" : "Desde"}
          type="date"
          value={startsOn}
          required
          onChange={(e) => setStartsOn(e.target.value)}
        />
        {span === "several" && <TextField label="Último día" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />}
        {span === "weekly" && (
          <TextField label="Hasta (si acaba)" type="date" value={repeatUntil} min={startsOn} hint="Sin fecha, sigue." onChange={(e) => setRepeatUntil(e.target.value)} />
        )}
      </div>
      {span === "weekly" && (
        <Chips
          label="Qué días"
          multiple
          options={WEEK.map(String)}
          render={(o) => short(Number(o))}
          value={repeatDays.map(String)}
          onChange={(v) => {
            setRepeatDays(v.map(Number).sort((a, b) => a - b));
            setError(null);
          }}
        />
      )}
      <TextField label="Hora (si la tiene)" type="time" value={time} hint="Sin hora, es de todo el día." onChange={(e) => setTime(e.target.value)} />
      {time && (
        <Chips
          label="Cuánto dura"
          options={durations.map(String)}
          render={(o) => `${o} min`}
          value={[String(minutes)]}
          onChange={(v) => v[0] && setMinutes(Number(v[0]))}
        />
      )}
      <TextAreaField label="Nota (si quieres)" rows={2} value={notes} maxLength={EVENT_LIMITS.notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        {event ? "Guardar el cambio" : "Apuntar"}
      </Button>
      {event &&
        (confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-danger p-3">
            <p className="text-sm">
              ¿Borrar «{eventName(event)}»?{event.repeatDays.length ? ` Se borran todas las semanas (cada ${repeatText(event.repeatDays)}).` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                No
              </Button>
              <Button ref={confirmRef} variant="danger" loading={busy} onClick={() => void remove()}>
                Borrar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" block icon={<Trash aria-hidden="true" className="size-5" />} onClick={() => setConfirming(true)}>
            Borrar el evento
          </Button>
        ))}
    </form>
  );
}
