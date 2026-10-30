import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkExpired, daysSinceCheck, forgetCheck, lastCheck, offlineDays, recordCheck } from "./offlineExpiry";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
const DAY = 86_400_000;

describe("caducidad sin conexión", () => {
  const t0 = Date.parse("2026-10-30T10:00:00Z");
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("sin dato, cuenta desde ahora (al actualizar la app nadie se queda fuera); con dato, desde la última comprobación", () => {
    expect(lastCheck("a.c1", t0)).toBe(t0);
    expect(daysSinceCheck("a.c1", t0 + 6 * DAY)).toBe(6);
    recordCheck("a.c1", t0 + 6 * DAY);
    expect(daysSinceCheck("a.c1", t0 + 8 * DAY)).toBe(2);
    forgetCheck("a.c1");
    expect(daysSinceCheck("a.c1", t0 + 20 * DAY)).toBe(0);
  });

  it("caduca al llegar a los días de la clínica (3, 7 o 14; otra cosa, 7)", () => {
    recordCheck("a.c1", t0);
    expect(checkExpired("a.c1", 7, t0 + 6 * DAY + DAY / 2)).toBe(false);
    expect(checkExpired("a.c1", 7, t0 + 7 * DAY)).toBe(true);
    expect(checkExpired("a.c1", 3, t0 + 3 * DAY)).toBe(true);
    expect(checkExpired("a.c1", 14, t0 + 8 * DAY)).toBe(false);
    expect(offlineDays(3)).toBe(3);
    expect(offlineDays("14")).toBe(14);
    expect(offlineDays(5)).toBe(7);
    expect(offlineDays(undefined)).toBe(7);
  });
});
