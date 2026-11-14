// «Tu calendario» en la página del paciente (PublicFormPage.tsx): apunta cada cosa (entrenamientos, partidos, una
// operación, una prueba, un viaje) con los mismos campos que en la clínica (src/clinical/EventFields.tsx), ve la lista
// de lo apuntado (y quita lo que no) y lo manda todo junto con «Enviar». Se guarda en su móvil hasta que lo envía.
// Arriba, lo que ya tenía apuntado en la clínica y sus próximas citas (como estaban al crear el enlace), solo para
// verlo: lo mismo no se puede añadir otra vez.
import { CalendarCheck, Plus, X } from "lucide-react";
import { useState } from "react";
import { checkEvent, eventKey, eventName, eventSpan, eventTime, kindLabel, type EventInput, type PatientEvent } from "../data/patientEvents";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { draftError, draftInput, draftOf, EventFields, type EventDraft } from "../clinical/EventFields";
import { CALENDAR_MAX } from "./calendarForm";

/** Para enseñarlo con los mismos textos que en la clínica. */
const asEvent = (e: EventInput): PatientEvent => ({ id: "", patientId: "", createdAt: "", updatedAt: "", skipDays: [], ...e });

/** «martes, 17 de noviembre, 10:00», en la hora de Madrid (la de la clínica). */
const visitText = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export function CalendarFill({
  events,
  onChange,
  known = [],
  visits = [],
}: {
  events: EventInput[];
  onChange: (events: EventInput[]) => void;
  /** Lo que ya tiene apuntado en la clínica (solo para verlo). */
  known?: EventInput[];
  /** Sus próximas citas (solo para verlas). */
  visits?: string[];
}) {
  const [draft, setDraft] = useState<EventDraft>(() => draftOf(null));
  const [error, setError] = useState<string | null>(null);
  const full = events.length >= CALENDAR_MAX;
  const add = () => {
    const missing = draftError(draft);
    if (missing) return setError(missing);
    try {
      const next = checkEvent(draftInput(draft));
      const key = eventKey(next);
      if (known.some((e) => eventKey(e) === key)) return setError("Eso ya está apuntado en la clínica.");
      if (events.some((e) => eventKey(e) === key)) return setError("Eso ya lo has apuntado.");
      onChange([...events, next]);
      setDraft(draftOf(null));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {(known.length > 0 || visits.length > 0) && (
        <section aria-labelledby="h-ya" className="flex flex-col gap-2">
          <h2 id="h-ya" className="text-lg">
            Ya apuntado en la clínica
          </h2>
          <p className="text-sm text-text-muted">Así estaba cuando te mandaron este enlace. No hace falta que lo apuntes otra vez.</p>
          <ul className="flex flex-col gap-2">
            {visits.map((v) => (
              <li key={v} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Cita</span> · <span className="first-letter:uppercase">{visitText(v)}</span>
                </span>
              </li>
            ))}
            {known.map((e, i) => {
              const ev = asEvent(e);
              return (
                <li key={i} className="flex flex-col rounded-md border border-border bg-surface px-3 py-2">
                  <span className="font-semibold break-words">{eventName(ev)}</span>
                  <span className="text-sm text-text-muted">
                    {e.title ? `${kindLabel(e.kind)} · ` : ""}
                    {eventSpan(ev)} · {eventTime(ev)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {events.length > 0 && (
        <section aria-labelledby="h-apuntado" className="flex flex-col gap-2">
          <h2 id="h-apuntado" className="text-lg">
            Lo que has apuntado ({events.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {events.map((e, i) => {
              const ev = asEvent(e);
              return (
                <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-bg py-1 pr-1 pl-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold break-words">{eventName(ev)}</span>
                    <span className="text-sm text-text-muted">
                      {e.title ? `${kindLabel(e.kind)} · ` : ""}
                      {eventSpan(ev)} · {eventTime(ev)}
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" aria-label={`Quitar «${eventName(ev)}»`} icon={<X aria-hidden="true" className="size-4" />} onClick={() => onChange(events.filter((_, j) => j !== i))}>
                    Quitar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {full ? (
        <p className="text-sm text-text-muted">Como mucho {CALENDAR_MAX} cosas de una vez: envíalas y, si te falta algo, díselo en la consulta.</p>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-bg p-3">
          <legend className="px-1 font-semibold">{events.length ? "Añadir otra cosa" : "Añadir"}</legend>
          <EventFields
            value={draft}
            onChange={(d) => {
              setDraft(d);
              setError(null);
            }}
          />
          {error && <Alert tone="danger" title={error} />}
          <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={add}>
            Añadir a mi calendario
          </Button>
        </fieldset>
      )}
    </div>
  );
}
