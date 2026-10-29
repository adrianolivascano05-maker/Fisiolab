// La siguiente cita en el calendario del fisioterapeuta sin conectar ninguna cuenta: un enlace que abre Google
// Calendar con el evento ya escrito (se confirma con «Guardar») y un archivo .ics (RFC 5545) que abren el
// calendario del iPhone o del Mac, Outlook y casi todos los demás. El evento lleva solo las iniciales del paciente
// y la hora: ni su nombre, ni «Fisioterapia», ni un enlace a su ficha, ni nada de su historia clínica. Con la cuenta
// de Google conectada, la app apunta además las citas sola en un calendario suyo (src/cloud/googleCalendar.ts), con
// estos mismos eventos.
import type { Session } from "../data/clinical";
import { saveFile } from "../app/download";

export type CalendarEvent = {
  /** Estable para la misma cita: si se vuelve a añadir, el calendario la reconoce. */
  uid: string;
  /** ISO. */
  start: string;
  minutes: number;
  title: string;
  description: string;
};

export const DEFAULT_VISIT_MINUTES = 45;

/** «lun, 26 oct, 10:00» */
export const fmtVisit = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/**
 * Lo que guardaron las versiones anteriores en Ajustes › Google Calendar (nombre o iniciales). Ya no cambia nada: el
 * evento lleva siempre las iniciales.
 */
export type EventNames = "full" | "initials";

/** «Lucía Pérez Gil» → «L. P. G.» */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .join(" ");

/** El evento de una cita (la siguiente de una sesión o una de la agenda): solo las iniciales y la hora. */
export function visitEvent(s: Pick<Session, "id" | "nextAt" | "nextMinutes">, patient: { name: string }): CalendarEvent | null {
  if (!s.nextAt) return null;
  const who = initials(patient.name);
  return {
    uid: `cita-${s.id}@cenit-fisiolab`,
    start: s.nextAt,
    minutes: s.nextMinutes ?? DEFAULT_VISIT_MINUTES,
    title: who,
    description: `Cita de ${who}`,
  };
}

export const end = (e: CalendarEvent) => new Date(Date.parse(e.start) + e.minutes * 60_000);
/** 2026-10-26T09:00:00.000Z → 20261026T090000Z */
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utc(new Date(e.start))}/${utc(end(e))}`,
    details: e.description,
    ctz: "Europe/Madrid",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Texto de una propiedad: \ ; , y saltos de línea van escapados. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Líneas de 75 bytes como máximo; las siguientes empiezan con un espacio. No parte una letra con tilde. */
function fold(line: string): string {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function icsText(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OmniClin//Citas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(new Date(e.start))}`,
    `DTEND:${utc(end(e))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Abre el .ics: en el iPhone, Safari enseña el evento para añadirlo; en lo demás se descarga y se abre. */
export function openIcs(e: CalendarEvent, fileName: string) {
  const text = icsText(e);
  if (isIos()) {
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`;
    return;
  }
  saveFile(fileName, text, "text/calendar;charset=utf-8");
}
