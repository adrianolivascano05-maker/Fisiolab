import { describe, expect, it } from "vitest";
import { bookableSpans, fitsWindow, freeWindows, madridIso, startTimes, weekdayOf } from "./availability";

// Lunes 26 de octubre de 2026 (ya en horario de invierno, UTC+1), a las 8:00 de Madrid.
const NOW = "2026-10-26T07:00:00.000Z";

describe("fechas de Madrid", () => {
  it("horario de verano e invierno", () => {
    expect(madridIso("2026-10-23", "09:00")).toBe("2026-10-23T07:00:00.000Z"); // verano, UTC+2
    expect(madridIso("2026-10-26", "09:00")).toBe("2026-10-26T08:00:00.000Z"); // invierno, UTC+1
    expect(weekdayOf("2026-10-26")).toBe(1);
    expect(weekdayOf("2026-11-01")).toBe(7);
  });
});

describe("franjas libres", () => {
  const hours = { 1: [["09:00", "14:00"]] as [string, string][], 2: [["16:00", "18:00"]] as [string, string][] };

  it("el horario semanal menos las citas, desde la antelación mínima", () => {
    const w = freeWindows({
      now: NOW,
      days: 1,
      minNoticeHours: 2, // desde las 10:00
      hours,
      pros: [{ id: "", shifts: [], busy: [{ from: madridIso("2026-10-26", "11:00"), to: madridIso("2026-10-26", "12:00") }] }],
    });
    expect(w).toEqual([
      { pro: "", from: madridIso("2026-10-26", "10:00"), to: madridIso("2026-10-26", "11:00") },
      { pro: "", from: madridIso("2026-10-26", "12:00"), to: madridIso("2026-10-26", "14:00") },
      { pro: "", from: madridIso("2026-10-27", "16:00"), to: madridIso("2026-10-27", "18:00") },
    ]);
  });

  it("con turnos, los turnos de cada fisio en vez del horario", () => {
    const w = freeWindows({
      now: NOW,
      days: 7,
      minNoticeHours: 0,
      hours,
      pros: [
        { id: "a", shifts: [{ from: madridIso("2026-10-28", "15:00"), to: madridIso("2026-10-28", "19:00") }], busy: [] },
        { id: "b", shifts: [], busy: [] },
      ],
    });
    expect(w.filter((x) => x.pro === "a")).toEqual([{ pro: "a", from: madridIso("2026-10-28", "15:00"), to: madridIso("2026-10-28", "19:00") }]);
    // b, sin turnos: el horario de la clínica (dos lunes y dos martes en 7 días cuentan los que entran).
    expect(w.filter((x) => x.pro === "b").length).toBeGreaterThanOrEqual(2);
  });

  it("horas de inicio cada 15 minutos donde cabe la cita entera; una vez aunque haya dos fisios libres", () => {
    const windows = [
      { pro: "a", from: madridIso("2026-10-26", "10:00"), to: madridIso("2026-10-26", "11:10") },
      { pro: "b", from: madridIso("2026-10-26", "10:20"), to: madridIso("2026-10-26", "11:30") },
    ];
    const s = startTimes(windows, 60, 15, NOW);
    expect(s.map((x) => [new Date(x.at).toISOString().slice(11, 16), x.pro])).toEqual([
      ["09:00", "a"], // 10:00 en Madrid
      ["09:30", "b"], // 10:30
    ]);
    expect(startTimes(windows, 60, 15, NOW, "b").map((x) => x.pro)).toEqual(["b"]);
    expect(fitsWindow(windows, "a", madridIso("2026-10-26", "10:00"), 60)).toBe(true);
    expect(fitsWindow(windows, "a", madridIso("2026-10-26", "10:15"), 60)).toBe(false);
    expect(fitsWindow(windows, "b", madridIso("2026-10-26", "10:00"), 60)).toBe(false);
  });
});

describe("agenda cerrada", () => {
  const hours = { 1: [["09:00", "14:00"]] as [string, string][], 2: [["09:00", "14:00"], ["16:00", "20:00"]] as [string, string][] };
  const at = (day: string, hm: string) => madridIso(day, hm);

  it("los ratos cerrados no se ofrecen; el contorno no quita las citas pero sí lo cerrado", () => {
    const input = {
      now: NOW,
      days: 1,
      minNoticeHours: 0,
      hours,
      pros: [
        {
          id: "",
          shifts: [],
          busy: [{ from: at("2026-10-26", "10:00"), to: at("2026-10-26", "11:00") }],
          // El lunes cerrado entero y el martes por la tarde.
          closed: [
            { from: at("2026-10-26", "00:00"), to: at("2026-10-27", "00:00") },
            { from: at("2026-10-27", "15:00"), to: at("2026-10-27", "21:00") },
          ],
        },
      ],
    };
    expect(freeWindows(input)).toEqual([{ pro: "", from: at("2026-10-27", "09:00"), to: at("2026-10-27", "14:00") }]);
    expect(bookableSpans(input)).toEqual([{ pro: "", from: at("2026-10-27", "09:00"), to: at("2026-10-27", "14:00") }]);
  });

  it("cada fisio con sus cierres: el de uno no quita los huecos del otro", () => {
    const w = freeWindows({
      now: NOW,
      days: 0,
      minNoticeHours: 0,
      hours,
      pros: [
        { id: "laura", shifts: [], busy: [], closed: [{ from: at("2026-10-26", "12:00"), to: at("2026-10-26", "14:00") }] },
        { id: "pablo", shifts: [], busy: [], closed: [] },
      ],
    });
    expect(w).toEqual([
      { pro: "laura", from: at("2026-10-26", "09:00"), to: at("2026-10-26", "12:00") },
      { pro: "pablo", from: at("2026-10-26", "09:00"), to: at("2026-10-26", "14:00") },
    ]);
  });
});
