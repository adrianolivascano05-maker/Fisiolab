// Lo de su calendario que conviene tener delante al escribir la sesión (src/data/patientEvents.ts): cuánto hace de su
// operación y lo próximo (un partido, un viaje, una prueba), contado desde el día de la sesión, y «Apuntar en su
// calendario» para lo que cuente en la consulta («me operan el 3», «el sábado tengo partido») sin salir de la sesión.
import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { eventNotes, listPatientEvents, type EventKind } from "../data/patientEvents";
import { Button } from "../ui/Button";
import { EventSheet } from "./EventSheet";

export function CalendarNote({ patientId, day, kind }: { patientId: string; /** El día desde el que se cuenta. */ day: string; kind?: EventKind }) {
  const events = useAsync(() => listPatientEvents(getDb(), patientId), [patientId], { tables: ["events"] });
  const [open, setOpen] = useState(false);
  const notes = events.data ? eventNotes(events.data, day, { brief: true }) : [];
  return (
    <div className="flex flex-col gap-1">
      {notes.length > 0 && (
        <p className="flex items-start gap-2 text-sm">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tingle" />
          <Link to={`/pacientes/${patientId}/calendario`} className="underline underline-offset-2">
            {notes.map((n) => n.text).join(" · ")}
          </Link>
        </p>
      )}
      <Button variant="ghost" size="sm" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setOpen(true)}>
        Apuntar en su calendario
      </Button>
      <EventSheet open={open} onClose={() => setOpen(false)} patientId={patientId} event={null} day={null} preset={kind ? { kind } : undefined} />
    </div>
  );
}
