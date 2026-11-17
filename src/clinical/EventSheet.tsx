// La hoja para apuntar o cambiar un evento del calendario del paciente (src/data/patientEvents.ts): qué es, cuándo (un
// día, varios seguidos o cada semana unos días), a qué hora si la tiene y una nota (los campos, en EventFields.tsx).
// Al cambiar uno que se repite se cambia la serie entera (es una sola cosa: «entrena martes y jueves»).
// Si al guardarlo ya tiene citas que caen ahí (unas vacaciones apuntadas después de darle la serie), la hoja lo dice
// con cada cita, para cambiarla o anularla a un toque (su hoja de siempre), o dejarlas así.
import { CalendarCheck, ChevronRight, Trash } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { bumpData } from "../app/dataVersion";
import { appointmentsOf, type Appointment } from "../data/appointments";
import { getDb } from "../data/db";
import {
  dayLong,
  dayShort,
  deletePatientEvent,
  endedBefore,
  eventName,
  getPatientEvent,
  repeatText,
  savePatientEvent,
  visitsInEvents,
  withDay,
  withoutDay,
  type EventInput,
  type EventKind,
  type PatientEvent,
} from "../data/patientEvents";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { AppointmentSheet } from "./AppointmentSheet";
import { fmtVisit } from "./calendar";
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
  /** Una cita que cae en lo que se acaba de guardar, abierta en su hoja (para cambiarla o anularla). */
  const [visit, setVisit] = useState<{ appointment: Appointment; name: string } | null>(null);
  const openVisit = async (a: Appointment) => {
    const name = (await getPatient(getDb(), patientId))?.name ?? "";
    onClose();
    setVisit({ appointment: a, name });
  };
  // El formulario solo existe con la hoja abierta: cada vez que se abre, empieza de nuevo con lo del evento (o vacío).
  return (
    <>
      <Sheet open={open} onClose={onClose} title={event ? "Cambiar evento" : "Apuntar evento"}>
        {open && <EventForm key={event?.id ?? `nuevo-${day ?? ""}`} patientId={patientId} event={event} day={day} preset={preset} onDone={onClose} onVisit={(a) => void openVisit(a)} />}
      </Sheet>
      {/* Solo cuando se abre una cita: montada y cerrada, su formulario seguiría en la página (la de la sesión ya tiene uno). */}
      {visit && <AppointmentSheet open onClose={() => setVisit(null)} patientId={patientId} patientName={visit.name} appointment={visit.appointment} />}
    </>
  );
}

function EventForm({
  patientId,
  event,
  day,
  preset,
  onDone,
  onVisit,
}: {
  patientId: string;
  event: PatientEvent | null;
  day?: string | null;
  preset?: { kind?: EventKind };
  onDone: () => void;
  onVisit: (a: Appointment) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<EventDraft>(() => draftOf(event, day, preset?.kind));
  /** Guardado: sus citas pendientes que caen en él (si hay, se dicen antes de cerrar). */
  const [after, setAfter] = useState<Appointment[] | null>(null);
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
      const id = await savePatientEvent(getDb(), patientId, draftInput(draft, event?.skipDays ?? []), event?.id);
      bumpData("events");
      toast(event ? "Evento cambiado" : "Evento apuntado", "success");
      const saved = await getPatientEvent(getDb(), id);
      const hit = saved ? visitsInEvents(await appointmentsOf(getDb(), patientId), [saved]) : [];
      if (hit.length) return setAfter(hit.map((h) => h.appointment));
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
      // Deshacer: se vuelve a apuntar tal como estaba.
      const { kind, title, startsOn, endsOn, time, minutes, repeatDays, repeatUntil, notes, skipDays, patientId } = event;
      toast("Evento borrado", "success", {
        label: "Deshacer",
        run: async () => {
          await savePatientEvent(getDb(), patientId, { kind, title, startsOn, endsOn, time, minutes, repeatDays, repeatUntil, notes, skipDays });
          bumpData("events");
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (after) return <VisitsInside appointments={after} onVisit={onVisit} onDone={onDone} />;

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

/** Recién guardado: las citas que ya tenía y caen ahí, cada una a un toque para cambiarla o anularla. */
function VisitsInside({ appointments, onVisit, onDone }: { appointments: Appointment[]; onVisit: (a: Appointment) => void; onDone: () => void }) {
  const one = appointments.length === 1;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  return (
    <div ref={box} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <Alert tone="warning" title={one ? "Ya tiene una cita esos días" : `Ya tiene ${appointments.length} citas esos días`}>
        {one ? "Tócala para cambiarla o anularla" : "Toca cada una para cambiarla o anularla"}; si va a venir igualmente, {one ? "déjala" : "déjalas"} así.
      </Alert>
      <VisitList appointments={appointments} onVisit={onVisit} />
      <Button variant="secondary" block onClick={onDone}>
        {one ? "Dejarla así" : "Dejarlas así"}
      </Button>
    </div>
  );
}

/** Unas citas, cada una a un toque para abrir su hoja (cambiarla o anularla); con lo que pisa, si se da. */
export function VisitList({ appointments, onVisit, detail }: { appointments: Appointment[]; onVisit: (a: Appointment) => void; detail?: (a: Appointment) => string }) {
  return (
    <ul className="flex flex-col gap-2">
      {appointments.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => onVisit(a)}
            className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-accent"
          >
            <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold first-letter:uppercase">{fmtVisit(a.startsAt)}</span>
              {detail && <span className="text-sm text-text-muted">{detail(a)}</span>}
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-chevron" />
          </button>
        </li>
      ))}
    </ul>
  );
}
