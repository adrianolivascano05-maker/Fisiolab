// «Añadir al calendario»: la siguiente cita de una sesión a Google Calendar (enlace) o al calendario del móvil,
// del Mac u Outlook (archivo .ics). No conecta ninguna cuenta: el fisioterapeuta confirma en su calendario.
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Session } from "../data/clinical";
import { Button, IconButton } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { googleCalendarUrl, openIcs, type CalendarEvent } from "./calendar";

export const DEFAULT_VISIT_MINUTES = 45;

/** «lun, 26 oct, 10:00» */
export const fmtVisit = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** El evento de la siguiente cita que se puso en una sesión. */
export function visitEvent(s: Session, patient: { id: string; name: string }): CalendarEvent | null {
  if (!s.nextAt) return null;
  const link = new URL(`${import.meta.env.BASE_URL}pacientes/${patient.id}`, window.location.origin).href;
  return {
    uid: `cita-${s.id}@cenit-fisiolab`,
    start: s.nextAt,
    minutes: s.nextMinutes ?? DEFAULT_VISIT_MINUTES,
    title: `Fisioterapia · ${patient.name}`,
    description: `Siguiente cita de ${patient.name}.\nSu ficha en la app (en este dispositivo): ${link}`,
  };
}

const googleLink =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover";

export function CalendarSheet({ open, onClose, event, title = "Añadir al calendario" }: { open: boolean; onClose: () => void; event: CalendarEvent; title?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p>
        <span className="font-semibold">{fmtVisit(event.start)}</span> · {event.minutes} min
      </p>
      {/* Se cierra después del clic, con el enlace ya seguido: un enlace que sale de la página antes puede no abrirse. */}
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={googleLink} onClick={() => setTimeout(onClose)}>
        <ExternalLink aria-hidden="true" className="size-5" /> Google Calendar
      </a>
      <Button
        variant="secondary"
        block
        icon={<Download aria-hidden="true" className="size-5" />}
        onClick={() => {
          openIcs(event, `cita-fisioterapia-${event.start.slice(0, 10)}.ics`);
          onClose();
        }}
      >
        iPhone, Mac, Outlook u otro (.ics)
      </Button>
      <p className="text-sm text-text-muted">
        Google Calendar se abre con la cita ya escrita: pulsa «Guardar». El archivo .ics lo abren el calendario del iPhone y del Mac, Outlook y casi
        todos los demás. El evento lleva el nombre del paciente y la hora, nada de su historia clínica.
      </p>
    </Sheet>
  );
}

/** Botón que abre la hoja. `compact`: solo el icono. */
export function CalendarButton({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <IconButton label="Añadir al calendario" onClick={() => setOpen(true)} className="text-accent">
          <CalendarPlus aria-hidden="true" className="size-5" />
        </IconButton>
      ) : (
        <Button variant="secondary" size="sm" icon={<CalendarPlus aria-hidden="true" className="size-4" />} onClick={() => setOpen(true)}>
          Añadir al calendario
        </Button>
      )}
      <CalendarSheet open={open} onClose={() => setOpen(false)} event={event} />
    </>
  );
}
