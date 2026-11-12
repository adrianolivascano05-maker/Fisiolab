// «Tu calendario» por enlace: el paciente apunta desde su móvil lo suyo (entrenamientos, partidos, una operación, una
// prueba, un viaje) y llega a su calendario en la ficha (src/data/patientEvents.ts). Aquí, lo que se acepta de lo que
// manda: cada cosa limpia con las mismas reglas que en la clínica; lo que no vale se deja fuera (y se cuenta).
import { checkEvent, EVENT_KINDS, EVENT_LIMITS, type EventInput, type EventKind } from "../data/patientEvents";

export { CALENDAR_KIND } from "../clinical/patientForms";
/** Cuántas cosas puede mandar de una vez. */
export const CALENDAR_MAX = 30;
/** Lo que se añade a la nota de cada cosa que apunta él, para que se sepa en la clínica. */
export const FROM_PATIENT = "Lo apuntó el paciente.";

/** Lo que puede elegir el paciente: los mismos tipos que en la clínica. */
export const PATIENT_KINDS: { id: EventKind; label: string }[] = EVENT_KINDS.map((k) => ({ id: k.id, label: k.label }));

/** Lo que manda el paciente: `answers.events` (y nada más). */
export type CalendarAnswers = { events: unknown[] };

/** Lo que vale de lo que manda: como mucho {@link CALENDAR_MAX}, cada una comprobada como en la clínica. */
export function cleanPatientEvents(incoming: Record<string, unknown>): { events: EventInput[]; dropped: number } {
  const raw = Array.isArray(incoming.events) ? incoming.events.slice(0, CALENDAR_MAX) : [];
  const events: EventInput[] = [];
  let dropped = Array.isArray(incoming.events) ? Math.max(0, incoming.events.length - CALENDAR_MAX) : 0;
  for (const r of raw) {
    if (typeof r !== "object" || r === null) {
      dropped++;
      continue;
    }
    const o = r as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const input: EventInput = {
      kind: str(o.kind) as EventKind,
      title: str(o.title),
      startsOn: str(o.startsOn),
      endsOn: str(o.endsOn) || null,
      time: str(o.time) || null,
      minutes: typeof o.minutes === "number" ? o.minutes : null,
      repeatDays: Array.isArray(o.repeatDays) ? o.repeatDays.filter((d): d is number => typeof d === "number") : [],
      repeatUntil: str(o.repeatUntil) || null,
      notes: str(o.notes),
    };
    try {
      const clean = checkEvent(input);
      // Su nota (recortada si hace falta para que quepa) y que lo apuntó él.
      const room = EVENT_LIMITS.notes - FROM_PATIENT.length - 1;
      events.push({ ...clean, notes: clean.notes ? `${clean.notes.slice(0, room)}\n${FROM_PATIENT}` : FROM_PATIENT });
    } catch {
      dropped++;
    }
  }
  return { events, dropped };
}
