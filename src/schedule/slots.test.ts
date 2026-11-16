// Huecos para dar una cita (slots.ts).
import { describe, expect, it } from "vitest";
import type { PatientEvent } from "../data/patientEvents";
import { freeStarts, proposeSlots, usualSlot } from "./slots";

// Lunes 16 de noviembre de 2026, a las 8:00.
const NOW = new Date(2026, 10, 16, 8, 0);
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const visit = (day: number, h: number, m = 0, status: "scheduled" | "cancelled" = "scheduled") => ({ startsAt: at(day, h, m), minutes: 45, status });
type Input = Parameters<typeof proposeSlots>[0];
const base = (over: Partial<Input> = {}): Input => ({ now: NOW, minutes: 45, busy: [], closures: [], shifts: [], events: [], ...over });
const hours = (list: string[]) => list.map((iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
const event = (over: Partial<PatientEvent>): PatientEvent =>
  ({ id: "e", patientId: "p", kind: "travel", title: "", startsOn: "2026-11-17", endsOn: null, time: null, minutes: null, repeatDays: [], repeatUntil: null, notes: "", skipDays: [], createdAt: "", updatedAt: "", ...over }) as PatientEvent;

describe("las horas libres de un día", () => {
  it("sin turnos, de lunes a viernes de 9 a 20, de media en media hora, sin pisar otra cita", () => {
    const free = hours(freeStarts(base({ busy: [visit(17, 10), visit(17, 12, 0, "cancelled")] }), "2026-11-17"));
    expect(free[0]).toBe("09:00");
    // La cita de las 10:00 dura 45 min: ni 9:30 (acabaría a las 10:15) ni 10:00 ni 10:30; 10:45 no es media hora en punto.
    expect(free).not.toContain("09:30");
    expect(free).not.toContain("10:00");
    expect(free).not.toContain("10:30");
    expect(free).toContain("11:00");
    // La anulada no ocupa.
    expect(free).toContain("12:00");
    // La última cabe entera antes de las 20:00.
    expect(free.at(-1)).toBe("19:00");
    // En fin de semana no se propone nada.
    expect(freeStarts(base(), "2026-11-21")).toEqual([]);
  });

  it("con turnos esa semana, solo dentro del turno; con la agenda cerrada, nada", () => {
    const shifts = [{ startsAt: at(17, 15), endsAt: at(17, 18) }];
    expect(hours(freeStarts(base({ shifts }), "2026-11-17"))).toEqual(["15:00", "15:30", "16:00", "16:30", "17:00"]);
    // Otro día de esa semana sin turno: nada (la semana ya está organizada).
    expect(freeStarts(base({ shifts }), "2026-11-18")).toEqual([]);
    expect(freeStarts(base({ closures: [{ startsAt: at(17, 0), endsAt: at(18, 0) }] }), "2026-11-17")).toEqual([]);
  });

  it("hoy, como pronto dentro de una hora; y nunca en un día de viaje del paciente", () => {
    expect(hours(freeStarts(base({ now: new Date(2026, 10, 16, 17, 10) }), "2026-11-16"))).toEqual(["18:30", "19:00"]);
    expect(freeStarts(base({ events: [event({ kind: "travel", startsOn: "2026-11-17", endsOn: "2026-11-19" })] }), "2026-11-18")).toEqual([]);
  });
});

describe("los huecos propuestos", () => {
  it("tres, cada uno de un día distinto, empezando por el más cercano", () => {
    const slots = proposeSlots(base({ busy: [visit(16, 9), visit(16, 10)] }));
    expect(slots.map((s) => s.startsAt)).toEqual([at(16, 11), at(17, 9), at(18, 9)]);
    expect(slots.every((s) => !s.usual)).toBe(true);
  });

  it("primero su hora de siempre, si está libre", () => {
    const past = [visit(3, 17), visit(10, 17), visit(5, 9)];
    // Los martes a las 17:00 (el 3 y el 10 de noviembre de 2026 son martes).
    expect(usualSlot(past)).toBe("2 17:00");
    const slots = proposeSlots(base({ past }));
    expect(slots[0]).toEqual({ startsAt: at(17, 17), usual: true });
    expect(slots).toHaveLength(3);
    // Con ese rato ocupado, la del martes siguiente.
    expect(proposeSlots(base({ past, busy: [visit(17, 17)] }))[0]).toEqual({ startsAt: at(24, 17), usual: true });
    // Una sola cita no hace costumbre.
    expect(usualSlot([visit(3, 17)])).toBeNull();
  });
});
