import { describe, expect, it } from "vitest";
import { heightFromFlightTime, reactiveStrengthIndex, samozino } from "./jump";
import { computeJump, marksFromFrames } from "./results";
import { intervalS } from "./video";

describe("altura por tiempo de vuelo", () => {
  it("0,5 s de vuelo son 30,66 cm", () => {
    expect(heightFromFlightTime(0.5)).toBeCloseTo(0.3066, 4);
  });
  it("rechaza tiempos no positivos", () => {
    expect(() => heightFromFlightTime(0)).toThrow(RangeError);
  });
});

describe("RSI", () => {
  it("0,30 m en 0,20 s de contacto dan 1,5", () => {
    expect(reactiveStrengthIndex(0.3, 0.2)).toBeCloseTo(1.5, 6);
  });
});

describe("Samozino", () => {
  // 70 kg, 35 cm, hpo 40 cm: F = 70·9,81·(0,875+1) = 1287,6 N; v = √(9,81·0,35/2) = 1,3103 m/s
  it("calcula F, v y P medias del empuje", () => {
    const r = samozino({ massKg: 70, heightM: 0.35, pushOffDistanceM: 0.4 });
    expect(r.forceN).toBeCloseTo(1287.56, 1);
    expect(r.velocityMS).toBeCloseTo(1.3103, 3);
    expect(r.powerW).toBeCloseTo(1287.56 * 1.3103, 0);
  });
});

describe("fotogramas a tiempo", () => {
  it("120 fotogramas a 240 fps son 0,5 s", () => {
    expect(intervalS(100, 220, 240)).toBe(0.5);
  });
  it("rechaza el aterrizaje antes del despegue", () => {
    expect(() => intervalS(220, 100, 240)).toThrow(RangeError);
  });
});

describe("computeJump", () => {
  const base = { captureFps: 240, bodyMassKg: 70, extraLoadKg: 0, pushOffDistanceCm: 40, dropHeightCm: null };

  it("CMJ: altura, vuelo y Samozino", () => {
    const out = computeJump({ ...base, type: "cmj", marks: marksFromFrames({ takeoff: 100, landing: 220 }) });
    const get = (m: string) => out.results.find((r) => r.metric === m)?.value;
    expect(out.missing).toEqual([]);
    expect(get("jump_height_cm")).toBeCloseTo(30.66, 2);
    expect(get("flight_time_ms")).toBeCloseTo(500, 6);
    expect(get("power_w")).toBeGreaterThan(0);
    expect(out.warnings).toEqual([]);
  });

  it("dice qué marcas faltan", () => {
    expect(computeJump({ ...base, type: "dj", marks: marksFromFrames({ takeoff: 10 }) }).missing).toEqual(["contact", "landing"]);
  });

  it("sin masa o sin hpo no calcula fuerza ni potencia", () => {
    const out = computeJump({ ...base, pushOffDistanceCm: null, type: "sj", marks: marksFromFrames({ takeoff: 0, landing: 120 }) });
    expect(out.results.map((r) => r.metric)).toEqual(["jump_height_cm", "flight_time_ms"]);
  });

  it("DJ: contacto y RSI, sin Samozino", () => {
    // contacto 48 fotogramas = 200 ms; vuelo 120 = 500 ms → 30,66 cm; RSI 1,533
    const out = computeJump({ ...base, type: "dj", marks: marksFromFrames({ contact: 52, takeoff: 100, landing: 220 }) });
    const get = (m: string) => out.results.find((r) => r.metric === m)?.value;
    expect(get("contact_time_ms")).toBeCloseTo(200, 6);
    expect(get("rsi")).toBeCloseTo(1.533, 3);
    expect(get("force_n")).toBeUndefined();
    expect(get("stiffness_kn_m")).toBeGreaterThan(0);
    expect(get("dri")).toBeUndefined(); // sin altura de caída
  });

  it("DJ con altura de caída: DRI", () => {
    const out = computeJump({ ...base, dropHeightCm: 30, type: "dj", marks: marksFromFrames({ contact: 52, takeoff: 100, landing: 220 }) });
    // (0,30 + 0,3066) / (9,81 · 0,2²) = 1,546
    expect(out.results.find((r) => r.metric === "dri")?.value).toBeCloseTo(1.546, 3);
  });

  it("CMJ con inicio del movimiento: tiempo hasta el despegue y RSI-mod", () => {
    // inicio f4, despegue f100: 96 fotogramas = 400 ms; 0,3066 m / 0,4 s = 0,766
    const out = computeJump({ ...base, type: "cmj", marks: marksFromFrames({ movement_start: 4, takeoff: 100, landing: 220 }) });
    const get = (m: string) => out.results.find((r) => r.metric === m)?.value;
    expect(get("time_to_takeoff_ms")).toBeCloseTo(400, 6);
    expect(get("rsi_mod")).toBeCloseTo(0.766, 3);
  });

  it("CMJ con brazos y unipodal: altura sí, Samozino no (el modelo es a dos piernas y sin brazos)", () => {
    for (const type of ["cmj_arms", "single_leg"] as const) {
      const out = computeJump({ ...base, type, marks: marksFromFrames({ takeoff: 100, landing: 220 }) });
      expect(out.results.map((r) => r.metric)).toEqual(["jump_height_cm", "flight_time_ms"]);
    }
  });

  it("avisa de alturas imposibles (fps mal indicados)", () => {
    // Vídeo a cámara lenta exportado a 30 fps tratado como si fuera de 30 fps reales: 8 veces el vuelo.
    const out = computeJump({ ...base, captureFps: 30, type: "cmj", marks: marksFromFrames({ takeoff: 100, landing: 220 }) });
    expect(out.warnings.length).toBe(1);
  });
});
