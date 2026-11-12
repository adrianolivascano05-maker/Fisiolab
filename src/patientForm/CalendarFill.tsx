// «Tu calendario» en la página del paciente (PublicFormPage.tsx): apunta cada cosa (entrenamientos, partidos, una
// operación, una prueba, un viaje) con los mismos campos que en la clínica (src/clinical/EventFields.tsx), ve la lista
// de lo apuntado (y quita lo que no) y lo manda todo junto con «Enviar». Se guarda en su móvil hasta que lo envía.
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { checkEvent, eventName, eventSpan, eventTime, kindLabel, type EventInput, type PatientEvent } from "../data/patientEvents";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { draftError, draftInput, draftOf, EventFields, type EventDraft } from "../clinical/EventFields";
import { CALENDAR_MAX } from "./calendarForm";

/** Para enseñarlo con los mismos textos que en la clínica. */
const asEvent = (e: EventInput): PatientEvent => ({ id: "", patientId: "", createdAt: "", updatedAt: "", skipDays: [], ...e });

export function CalendarFill({ events, onChange }: { events: EventInput[]; onChange: (events: EventInput[]) => void }) {
  const [draft, setDraft] = useState<EventDraft>(() => draftOf(null));
  const [error, setError] = useState<string | null>(null);
  const full = events.length >= CALENDAR_MAX;
  const add = () => {
    const missing = draftError(draft);
    if (missing) return setError(missing);
    try {
      onChange([...events, checkEvent(draftInput(draft))]);
      setDraft(draftOf(null));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="flex flex-col gap-3">
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
