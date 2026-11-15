// La lista de sus próximas citas para mandársela (upcoming.ts).
import { describe, expect, it } from "vitest";
import type { Appointment } from "../data/appointments";
import { SHEET_MAX, sheetRows, upcomingLines, upcomingOf, UPCOMING_MAX } from "./upcoming";

const visit = (id: string, startsAt: string, status: Appointment["status"] = "scheduled", assignedTo: string | null = null): Appointment => ({ id, patientId: "p", startsAt, minutes: 45, status, assignedTo });
const now = new Date("2026-11-12T12:00:00.000Z");

describe("sus próximas citas", () => {
  it("solo las pendientes que aún no han empezado, por orden, con quién si lo hay", () => {
    const list = [
      visit("b", "2026-11-24T09:00:00.000Z", "scheduled", "laura@clinica.test"),
      visit("old", "2026-11-10T09:00:00.000Z"),
      visit("gone", "2026-11-20T09:00:00.000Z", "cancelled"),
      visit("a", "2026-11-17T09:00:00.000Z"),
    ];
    expect(upcomingOf(list, now).map((a) => a.id)).toEqual(["a", "b"]);
    expect(upcomingLines(list, (e) => (e ? "Laura" : null), now)).toEqual(["· martes, 17 de noviembre a las 10:00", "· martes, 24 de noviembre a las 10:00 (con Laura)"]);
  });

  it("como mucho diez", () => {
    const many = Array.from({ length: 14 }, (_, i) => visit(`v${i}`, new Date(Date.UTC(2026, 10, 13 + i, 9)).toISOString()));
    expect(upcomingLines(many, undefined, now)).toHaveLength(UPCOMING_MAX);
  });

  it("la hoja en papel: día, hora y con quién; el año si es otro; como mucho 30 y cuántas más", () => {
    const list = [visit("b", "2027-01-05T09:00:00.000Z", "scheduled", "laura@clinica.test"), visit("a", "2026-11-17T09:00:00.000Z"), visit("gone", "2026-11-20T09:00:00.000Z", "cancelled")];
    expect(sheetRows(list, (e) => (e ? "Laura" : null), now)).toEqual({
      rows: [
        { id: "a", day: "martes, 17 de noviembre", hour: "10:00", who: null },
        { id: "b", day: "martes, 5 de enero de 2027", hour: "10:00", who: "Laura" },
      ],
      more: 0,
    });
    const many = Array.from({ length: SHEET_MAX + 4 }, (_, i) => visit(`v${i}`, new Date(Date.UTC(2026, 10, 13 + i, 9)).toISOString()));
    const sheet = sheetRows(many, undefined, now);
    expect(sheet.rows).toHaveLength(SHEET_MAX);
    expect(sheet.more).toBe(4);
  });
});
