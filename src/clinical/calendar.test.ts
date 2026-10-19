import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsText, type CalendarEvent } from "./calendar";

const visit: CalendarEvent = {
  uid: "cita-abc@cenit-fisiolab",
  start: "2026-10-26T09:00:00.000Z",
  minutes: 45,
  title: "Fisioterapia · Íñigo Peña, hijo",
  description: "Siguiente cita de Íñigo.\nSu ficha en la app (en este dispositivo): https://example.org/Fisiolab/pacientes/abc; gracias",
};

describe("cita en el calendario", () => {
  it(".ics: inicio y fin en UTC, texto escapado, líneas de 75 bytes y CRLF", () => {
    const ics = icsText(visit, new Date("2026-10-19T08:00:00.000Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nDTSTART:20261026T090000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261026T094500Z\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261019T080000Z\r\n");
    expect(ics).toContain("\r\nUID:cita-abc@cenit-fisiolab\r\n");
    expect(ics).toContain("SUMMARY:Fisioterapia · Íñigo Peña\\, hijo");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Al desplegar las líneas sale el texto entero, con el salto de línea y el punto y coma escapados.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Siguiente cita de Íñigo.\\nSu ficha en la app (en este dispositivo): https://example.org/Fisiolab/pacientes/abc\\; gracias");
    expect(unfolded).not.toMatch(/�/);
  });

  it("Google Calendar: evento ya escrito con sus horas", () => {
    const url = new URL(googleCalendarUrl(visit));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(visit.title);
    expect(url.searchParams.get("dates")).toBe("20261026T090000Z/20261026T094500Z");
    expect(url.searchParams.get("details")).toBe(visit.description);
  });
});
