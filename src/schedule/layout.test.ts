import { describe, expect, it } from "vitest";
import { atMinutes, dayOf, hourRange, inColumn, minutesOf, personColumns, placeInLanes, snap } from "./layout";

describe("agenda: cuentas", () => {
  it("día y minutos de un instante, y vuelta", () => {
    const iso = atMinutes("2026-10-20", 10 * 60 + 30);
    expect(dayOf(iso)).toBe("2026-10-20");
    expect(minutesOf(iso)).toBe(630);
    expect(snap(637)).toBe(630);
    expect(snap(638)).toBe(645);
  });

  it("horas a la vista: de 7 a 21, o más si hace falta", () => {
    expect(hourRange([])).toEqual({ from: 7, to: 21 });
    expect(hourRange([{ start: 6 * 60 + 30, end: 7 * 60 }, { start: 21 * 60, end: 22 * 60 + 15 }])).toEqual({ from: 6, to: 23 });
  });

  it("lo que se solapa comparte el ancho; lo que no, ocupa toda la columna", () => {
    const items = [
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 690 },
      { id: "c", start: 660, end: 720 },
      { id: "d", start: 800, end: 845 },
    ];
    const placed = placeInLanes(items, (i) => i);
    const by = Object.fromEntries(placed.map((p) => [p.item.id, [p.lane, p.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });

  it("columnas por persona: cada una con lo suyo; sin persona, todo", () => {
    const [ana, nadie] = personColumns("2026-10-20", ["ana@x.es", null]);
    expect(inColumn(ana!, "2026-10-20", "ana@x.es")).toBe(true);
    expect(inColumn(ana!, "2026-10-20", null)).toBe(false);
    expect(inColumn(nadie!, "2026-10-20", null)).toBe(true);
    expect(inColumn({ key: "x", day: "2026-10-20" }, "2026-10-20", "eva@x.es")).toBe(true);
  });
});
