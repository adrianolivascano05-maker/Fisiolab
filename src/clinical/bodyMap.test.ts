import { describe, expect, it } from "vitest";
import { orphanText } from "./anamnesis";
import { mapScore } from "./questionnaires";
import { formatMarks, MAP_HEIGHT, marksText, parseMarks, regionsOf, ZONES, type Shape } from "./bodyMap";

const box = (s: Shape) => (s.kind === "ellipse" ? { x0: s.cx - s.rx, x1: s.cx + s.rx, y0: s.cy - s.ry, y1: s.cy + s.ry } : { x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.h });

describe("mapa corporal", () => {
  it("cada zona tiene un id único, un nombre y al menos una vista, dentro del dibujo", () => {
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
    for (const z of ZONES) {
      expect(z.label).not.toContain("{l}");
      expect(z.front ?? z.back).toBeDefined();
      for (const s of [z.front, z.back].filter(Boolean) as Shape[]) {
        const b = box(s);
        expect(b.x0).toBeGreaterThanOrEqual(0);
        expect(b.x1).toBeLessThanOrEqual(200);
        expect(b.y0).toBeGreaterThanOrEqual(0);
        expect(b.y1).toBeLessThanOrEqual(MAP_HEIGHT);
      }
    }
  });

  it("de frente, el derecho del paciente está a la izquierda del dibujo; de espaldas, a la derecha", () => {
    const d = ZONES.find((z) => z.id === "hombro_d")!;
    const i = ZONES.find((z) => z.id === "hombro_i")!;
    expect(box(d.front!).x1).toBeLessThan(100);
    expect(box(i.front!).x0).toBeGreaterThan(100);
    expect(box(d.back!).x0).toBeGreaterThan(100);
    expect(box(i.back!).x1).toBeLessThan(100);
    expect(ZONES.find((z) => z.id === "rodilla_i")!.label).toBe("Rodilla izquierda");
    expect(ZONES.find((z) => z.id === "codo_d")!.label).toBe("Codo derecho");
  });

  it("las zonas de una misma vista no se pisan", () => {
    for (const view of ["front", "back"] as const) {
      const boxes = ZONES.filter((z) => z[view]).map((z) => ({ id: z.id, ...box(z[view]!) }));
      for (const a of boxes)
        for (const b of boxes) {
          if (a.id >= b.id) continue;
          const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
          expect(overlap, `${view}: ${a.id} y ${b.id}`).toBe(false);
        }
    }
  });

  it("guarda y lee «zona:síntoma:intensidad»; ignora lo que no entiende y las zonas repetidas", () => {
    const marks = parseMarks(["hombro_d:dolor:6", "lumbar:rigidez:", "nada:dolor:3", "codo_i:picor:2", "hombro_d:hormigueo:1", "rodilla_i:dolor:11", 4]);
    expect(marks).toEqual([
      { zone: "hombro_d", symptom: "dolor", intensity: 6 },
      { zone: "lumbar", symptom: "rigidez", intensity: null },
      { zone: "rodilla_i", symptom: "dolor", intensity: null },
    ]);
    expect(formatMarks(marks)).toEqual(["hombro_d:dolor:6", "lumbar:rigidez:", "rodilla_i:dolor:"]);
    expect(parseMarks("hombro_d:dolor:6")).toEqual([]);
  });

  it("se lee de la cabeza a los pies; lo marcado antes en la anamnesis se sigue leyendo", () => {
    const value = ["rodilla_i:dolor:", "lumbar:rigidez:", "hombro_d:dolor:6", "mano_d:hormigueo:3"];
    const text = "Hombro derecho: dolor 6/10; Lumbar: rigidez; Muñeca y mano derecha: hormigueo 3/10; Rodilla izquierda: dolor";
    expect(marksText(value)).toBe(text);
    expect(orphanText("mapa_dolor", value)).toEqual({ label: "Mapa del dolor (ahora está en Cuestionarios)", text });
    expect(marksText([])).toBe("");
  });

  it("propone las articulaciones de los tests y el lado", () => {
    expect(regionsOf(parseMarks(["hombro_d:dolor:4", "brazo_d:dolor:", "lumbar:rigidez:7"]))).toEqual({ regions: ["hombro", "lumbar"], side: "Derecho", maxIntensity: 7 });
    expect(regionsOf(parseMarks(["rodilla_d:dolor:", "rodilla_i:dolor:"]))).toEqual({ regions: ["rodilla"], side: "Los dos", maxIntensity: null });
    // Hombro derecho y rodilla izquierda: «Los dos» confundiría; el lado de cada una queda en el mapa.
    expect(regionsOf(parseMarks(["hombro_d:dolor:", "rodilla_i:dolor:"])).side).toBeNull();
    expect(regionsOf(parseMarks(["abdomen:dolor:"]))).toEqual({ regions: [], side: null, maxIntensity: null });
  });

  it("como cuestionario, la nota es la intensidad más alta", () => {
    expect(mapScore(parseMarks(["hombro_d:dolor:4", "lumbar:rigidez:7"]))).toBe(7);
    expect(() => mapScore([])).toThrow("Marca al menos una zona");
    expect(() => mapScore(parseMarks(["lumbar:rigidez:"]))).toThrow("Pon la intensidad");
  });
});
