// Un solo «hoy» y un solo «día de un instante», en la hora de Madrid: cerca de medianoche no pueden salir días distintos.
import { describe, expect, it } from "vitest";
import { addDays, dayOf, monthOf, todayDay } from "./dates";

describe("fechas", () => {
  it("el día de un instante es el de Madrid, no el de UTC", () => {
    // Las 23:30 UTC de un día de verano son ya las 01:30 del siguiente en Madrid (UTC+2).
    expect(dayOf("2026-07-10T23:30:00Z")).toBe("2026-07-11");
    // En invierno (UTC+1), las 23:30 UTC también son el día siguiente; las 22:30, no.
    expect(dayOf("2026-01-10T23:30:00Z")).toBe("2026-01-11");
    expect(dayOf("2026-01-10T22:30:00Z")).toBe("2026-01-10");
    expect(dayOf(new Date("2026-03-01T12:00:00Z"))).toBe("2026-03-01");
  });

  it("hoy es el día de Madrid de ahora mismo", () => {
    expect(todayDay()).toBe(dayOf(new Date()));
    expect(todayDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sumar días no se mueve con los cambios de hora ni con los meses", () => {
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25"); // cambio de hora de octubre
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // cambio de hora de marzo
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("el mes de un día, de un instante o de hoy", () => {
    expect(monthOf("2026-10-28")).toBe("2026-10");
    expect(monthOf("2026-07-31T23:30:00Z")).toBe("2026-08");
    expect(monthOf()).toBe(todayDay().slice(0, 7));
  });
});
