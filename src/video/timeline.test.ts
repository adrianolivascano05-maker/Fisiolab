import { describe, expect, it } from "vitest";
import { frameAt, seekTime, type Timeline } from "./timeline";

// Ritmo irregular como el del Pixel: media 30,08 fps con saltos.
const times = Array.from({ length: 412 }, (_, i) => i / 30.08 + 0.004 * Math.sin(i * 1.7));
times.sort((a, b) => a - b);
const tl: Timeline = { times, offset: 0 };

describe("línea de tiempo real", () => {
  it("cada fotograma se busca dentro de su propio intervalo", () => {
    for (const f of [0, 50, 211, 271, 410]) {
      const t = seekTime(tl, f, 30);
      expect(t).toBeGreaterThan(times[f]!);
      expect(t).toBeLessThan(times[f + 1]!);
      expect(frameAt(tl, t, 30, 411)).toBe(f);
    }
  });

  it("suponer 30 fps exactos falla en el 211 con el ritmo real del Pixel (lo que pasaba antes)", () => {
    const pixel: Timeline = { times: Array.from({ length: 412 }, (_, i) => i / 30.08), offset: 0 };
    expect(frameAt(pixel, (211 + 0.5) / 30, 30, 411)).toBe(212);
    expect(frameAt(pixel, seekTime(pixel, 211, 30), 30, 411)).toBe(211);
  });

  it("respeta un inicio retrasado (lista de edición)", () => {
    const delayed: Timeline = { times, offset: 0.069 };
    expect(frameAt(delayed, seekTime(delayed, 211, 30), 30, 411)).toBe(211);
    expect(frameAt(delayed, 0.01, 30, 411)).toBe(0);
  });

  it("el último fotograma también se puede ver", () => {
    expect(frameAt(tl, seekTime(tl, 411, 30), 30, 411)).toBe(411);
  });

  it("sin línea de tiempo usa el ritmo fijo", () => {
    expect(seekTime(null, 10, 240)).toBeCloseTo(10.5 / 240, 9);
    expect(frameAt(null, 10.5 / 240, 240, 2399)).toBe(10);
  });
});
