// El día de la Agenda como lista (dayRows.ts).
import { describe, expect, it } from "vitest";
import type { AgendaItem } from "../data/appointments";
import type { Closure } from "../data/closures";
import { countByDay, dayRows, spanText } from "./dayRows";

const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m).toISOString();
const visit = (id: string, h: number, m = 0, status: AgendaItem["status"] = "scheduled"): AgendaItem => ({ id, patientId: id, name: id, startsAt: at(h, m), minutes: 45, status, assignedTo: null });
const closure = (from: string, to: string, note = "Formación"): Closure => ({ id: "k", staffEmail: "", startsAt: from, endsAt: to, note, createdBy: "" });
const brief = (rows: ReturnType<typeof dayRows>) => rows.map((r) => (r.type === "visit" ? r.item.id : r.type === "free" ? `libre ${r.minutes}` : `cerrado ${r.closure.note}`));

describe("el día en lista", () => {
  it("las citas por orden y los huecos de media hora o más entre ellas; las anuladas no cuentan", () => {
    const rows = dayRows("2026-11-17", [visit("c", 13, 45), visit("a", 8, 30), visit("b", 9, 15), visit("x", 11, 0, "cancelled")], []);
    // 8:30–9:15, 9:15–10:00, libre hasta las 13:45 (3 h 45 min), 13:45.
    expect(brief(rows)).toEqual(["a", "b", "libre 225", "c"]);
  });

  it("sin turnos no se inventa el horario: ni antes de la primera ni después de la última", () => {
    expect(brief(dayRows("2026-11-17", [visit("a", 10)], []))).toEqual(["a"]);
    expect(dayRows("2026-11-17", [], [])).toEqual([]);
  });

  it("con turnos, también lo libre desde que empieza y hasta que acaba el turno", () => {
    const rows = dayRows("2026-11-17", [visit("a", 10)], [], [{ startsAt: at(9), endsAt: at(14) }]);
    expect(brief(rows)).toEqual(["libre 60", "a", "libre 195"]);
  });

  it("un rato cerrado sale en su sitio y no cuenta como libre", () => {
    const rows = dayRows("2026-11-17", [visit("a", 10), visit("b", 13)], [closure(at(11), at(12, 30))]);
    // 10:00–10:45, [10:45–11:00 son 15 min: no llega], cerrado 11:00–12:30, libre 12:30–13:00, 13:00.
    expect(brief(rows)).toEqual(["a", "cerrado Formación", "libre 30", "b"]);
  });

  it("otro día no entra", () => {
    expect(dayRows("2026-11-18", [visit("a", 10)], [closure(at(11), at(12))])).toEqual([]);
  });

  it("textos y cuenta por día", () => {
    expect([30, 60, 90, 225].map(spanText)).toEqual(["30 min", "1 h", "1 h 30 min", "3 h 45 min"]);
    expect(countByDay([visit("a", 10), visit("b", 11), visit("x", 12, 0, "cancelled")]).get("2026-11-17")).toBe(2);
  });
});
