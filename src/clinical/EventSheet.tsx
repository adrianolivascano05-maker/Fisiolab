// La hoja para apuntar o cambiar un evento del calendario del paciente (src/data/patientEvents.ts): qué es, cuándo (un
// día, varios seguidos o cada semana unos días), a qué hora si la tiene y una nota (los campos, en EventFields.tsx).
// Al cambiar uno que se repite se cambia la serie entera (es una sola cosa: «entrena martes y jueves»).
import { Trash } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { bumpData } from "../app/dataVersion";
import { getDb } from "../data/db";
import {
  dayLong,
  dayShort,
  deletePatientEvent,
  endedBefore,
  eventName,
  repeatText,
  savePatientEvent,
  withDay,
  withoutDay,
  type EventInput,
  type EventKind,
  type PatientEvent,
} from "../data/patientEvents";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { draftError, draftInput, draftOf, EventFields, type EventDraft } from "./EventFields";

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
  const [draft, setDraft] = useState<EventDraft>(() => draftOf(event, day, preset?.kind));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const missing = draftError(draft);
    if (missing) return setError(missing);
    setBusy(true);
    setError(null);
    try {
      await savePatientEvent(getDb(), patientId, draftInput(draft, event?.skipDays ?? []), event?.id);
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
      <EventFields
        value={draft}
        onChange={(d) => {
          setDraft(d);
          setError(null);
        }}
      />
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
