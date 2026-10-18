import { describe, expect, it } from "vitest";
import type { FigureSpec } from "./figure";
import { clockOf, extremeU, minJerk, mixAt, planKeys, poseAt, sampleTimes, scriptKeys } from "./script";

const f: FigureSpec = {
  view: "side",
  posture: "supine",
  script: {
    start: { r_hip: { flex: 90 }, r_knee: { flex: 90 } },
    steps: [
      { to: { r_hip: { rot: 30 } }, text: "RI", dur: 1.2, hold: 0.4 },
      { to: { r_hip: { rot: -40 } }, text: "RE" },
    ],
  },
};

describe("guion", () => {
  it("poses clave: partida, cada paso (acumulando) y vuelta a la partida", () => {
    const k = scriptKeys(f.script!);
    expect(k).toHaveLength(4);
    expect(k[0]!.pose.r_hip).toEqual({ flex: 90, rot: 0 });
    expect(k[1]!.pose.r_hip).toEqual({ flex: 90, rot: 30 });
    expect(k[2]!.pose.r_hip).toEqual({ flex: 90, rot: -40 });
    expect(k[3]!.pose).toEqual(k[0]!.pose);
  });
  it("entre dos poses clave, en línea recta", () => {
    const k = scriptKeys(f.script!);
    expect(poseAt(k, 1 / 6).pose.r_hip!.rot).toBeCloseTo(15);
    expect(poseAt(k, 0.5).pose.r_hip!.rot).toBeCloseTo(-5);
  });
  it("el desplazamiento de un segmento crece, se mantiene y se suelta", () => {
    const k = scriptKeys({ steps: [{ shift: { seg: "r_shank", dir: "anterior", cm: 1 }, text: "" }, { to: { r_knee: { flex: 30 } }, text: "" }, { shift: { seg: "r_shank", dir: "anterior", cm: 0 }, text: "" }] });
    expect(poseAt(k, 0.125).shift?.cm).toBeCloseTo(0.5);
    expect(poseAt(k, 0.375).shift?.cm).toBeCloseTo(1);
    expect(poseAt(k, 0.625).shift?.cm).toBeCloseTo(0.5);
    expect(poseAt(k, 0.8).shift).toBeNull();
  });
  it("la pose más alejada y cuánto se aleja", () => {
    const k = scriptKeys(f.script!);
    expect(extremeU(k)).toBeCloseTo(2 / 3);
    expect(mixAt(k, 0)).toBe(0);
    expect(mixAt(k, 2 / 3)).toBeCloseTo(1);
    expect(mixAt(k, 1)).toBe(0);
    expect(planKeys(f.script)).toHaveLength(7);
  });
  it("mínimo jerk: de 0 a 1, simétrica y con velocidad nula en los extremos", () => {
    expect(minJerk(0)).toBe(0);
    expect(minJerk(1)).toBe(1);
    expect(minJerk(0.5)).toBeCloseTo(0.5);
    expect(minJerk(0.01)).toBeLessThan(0.0001);
  });
});

describe("reloj", () => {
  const c = clockOf(f);
  it("dura lo que suman sus partes y las fases cubren la vuelta", () => {
    expect(c.duration).toBeCloseTo(1.6 + 1.2 + 0.4 + 1.6 + 0.6 + 1.8 + 1.4 + 0.9 + 0.4);
    expect(c.phases[0]!.from).toBe(0);
    expect(c.phases[3]!.to).toBe(1);
    for (let i = 1; i < 4; i++) expect(c.phases[i]!.from).toBeCloseTo(c.phases[i - 1]!.to);
  });
  it("el progreso nunca vuelve atrás y acaba en la partida", () => {
    let prev = -1;
    for (const t of sampleTimes(c, 0.005)) {
      const m = c.at(t).m;
      expect(m).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = m;
    }
    expect(c.at(0.999).m).toBe(1);
  });
  it("cada paso llega a su pose al final de su movimiento y la mantiene en la pausa", () => {
    const s0 = c.steps[0]!;
    expect(c.at(s0.moveTo).m).toBeCloseTo(1 / 3);
    expect(c.at((s0.moveTo + s0.to) / 2).m).toBeCloseTo(1 / 3);
    expect(c.at((s0.moveTo + s0.to) / 2).step).toBe(0);
    expect(c.at((c.steps[1]!.moveTo + c.steps[1]!.to) / 2).step).toBe(1);
  });
  it("las manos llegan antes de moverse y se van después de la vuelta", () => {
    expect(c.at(0).reach).toBe(0);
    expect(c.at(c.steps[0]!.from).reach).toBe(1);
    expect(c.at(0.999).reach).toBe(0);
  });
  it("no hay huecos entre pasos al sumar duraciones con decimales", () => {
    // 1,6 + (0,8 + 0,4) + (2,6 + 0,8) no da lo mismo sumado en un orden que en otro.
    const g: FigureSpec = { ...f, script: { steps: [{ text: "a", dur: 0.8, hold: 0.4 }, { to: { r_knee: { flex: 10 } }, text: "b", dur: 2.6, hold: 0.8 }] } };
    const cg = clockOf(g);
    const end = cg.phases[1]!.to;
    for (let k = 1; k < 400; k++) expect(cg.at(end - k * Number.EPSILON).step).toBe(1);
  });
  it("el dolor puede desaparecer en un paso (arco doloroso)", () => {
    const g: FigureSpec = { ...f, script: { steps: [{ text: "a", to: { r_hip: { abd: 20 } } }, { text: "b", to: { r_hip: { abd: 40 } }, pain: true }, { text: "c", to: { r_hip: { abd: 60 } }, painEnd: true }] } };
    const cg = clockOf(g);
    const [s0, s1, s2] = cg.steps;
    expect(cg.at((s0!.from + s0!.moveTo) / 2).pain).toBe(0);
    expect(cg.at(s1!.moveTo).pain).toBe(1);
    expect(cg.at(s2!.moveTo).pain).toBe(0);
    // Y volver (Bragard: cede al bajar la pierna y reaparece con la flexión dorsal).
    const h: FigureSpec = { ...f, script: { steps: [...g.script!.steps, { text: "d", to: { r_ankle: { flex: 20 } }, pain: true }] } };
    const ch = clockOf(h);
    expect(ch.at(ch.steps[2]!.moveTo).pain).toBe(0);
    expect(ch.at(ch.steps[3]!.moveTo).pain).toBe(1);
  });
  it("sin guion, el reloj de siempre (7 s)", () => {
    const old = clockOf({ view: "side", posture: "supine" });
    expect(old.duration).toBe(7);
    expect(old.at(0.6).m).toBe(1);
  });
});
