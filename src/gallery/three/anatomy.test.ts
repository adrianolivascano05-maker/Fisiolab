import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { BodyPose, FigureSpec, Posture } from "../figure";
import { tests } from "../data";
import { jointRotations, LIMITS, limitViolations, measureAngles, quatAngle } from "./anatomy";
import { layoutPatient, patientPose } from "./layout";
import { fk, type Pose3 } from "./rig";
import { anatAngles } from "./anatomy";

/** Figura de prueba: de `start` a `to` en un paso. */
const spec = (posture: Posture, start: BodyPose, to: BodyPose): FigureSpec => ({ view: "side", posture, script: { start, steps: [{ to, text: "" }] } });
/** Poses al principio y al final del paso (u = 0 y u = 1/2: un paso y la vuelta). */
const ends = (f: FigureSpec): [Pose3, Pose3] => {
  const L = layoutPatient(f);
  return [patientPose(L, 0, 0), patientPose(L, 0.5, 0)];
};
/** Un punto o una dirección en el marco del paciente (x a su izquierda, y hacia la cabeza, z hacia delante). */
const local = (p: Pose3, v: Vector3, dir = false) => (dir ? v.clone() : v.clone().sub(p.root.p)).applyQuaternion(p.root.q.clone().invert());
const pt = (p: Pose3, k: string) => local(p, p.pt[k]!);
/** +1 si el lado izquierdo, −1 si el derecho (x del marco del paciente). */
const sx = (s: "r" | "l") => (s === "l" ? 1 : -1);

describe("convenio anatómico: cada signo hace lo que dice", () => {
  for (const s of ["r", "l"] as const) {
    const medial = -sx(s);
    it(`${s}: rotación interna de cadera a 90/90 lleva el pie hacia fuera`, () => {
      const [a, b] = ends(spec("supine", { [`${s}_hip`]: { flex: 90 }, [`${s}_knee`]: { flex: 90 } }, { [`${s}_hip`]: { rot: 30 } }));
      expect((pt(b, `${s}_ankle`).x - pt(a, `${s}_ankle`).x) * medial).toBeLessThan(-10);
    });
    it(`${s}: rotación interna de hombro a 90/90 lleva la mano hacia los pies`, () => {
      const [a, b] = ends(spec("supine", { [`${s}_shoulder`]: { abd: 90 }, [`${s}_elbow`]: { flex: 90 } }, { [`${s}_shoulder`]: { rot: 60 } }));
      expect(pt(b, `${s}_wrist`).y - pt(a, `${s}_wrist`).y).toBeLessThan(-15);
    });
    it(`${s}: rotación externa de hombro con el codo pegado lleva la mano hacia fuera`, () => {
      const [a, b] = ends(spec("standing", { [`${s}_shoulder`]: { abd: 0 }, [`${s}_elbow`]: { flex: 90 } }, { [`${s}_shoulder`]: { rot: -45 } }));
      expect((pt(b, `${s}_wrist`).x - pt(a, `${s}_wrist`).x) * medial).toBeLessThan(-10);
    });
    it(`${s}: rotación interna de la tibia lleva la punta del pie hacia dentro`, () => {
      const [a, b] = ends(spec("sitting", {}, { [`${s}_knee`]: { rot: 25 } }));
      expect((pt(b, `${s}_foottip`).x - pt(a, `${s}_foottip`).x) * medial).toBeGreaterThan(4);
    });
    it(`${s}: pronación pone la palma hacia abajo (codo a 90°)`, () => {
      const f = spec("sitting", { [`${s}_shoulder`]: { flex: 0, abd: 0 }, [`${s}_elbow`]: { flex: 90, pron: 0 } }, { [`${s}_elbow`]: { pron: 80 } });
      const [a, b] = ends(f);
      const palm = (p: Pose3) => local(p, new Vector3(0, 0, 1).applyQuaternion(p.seg[`${s}_hand`].q), true);
      // Neutra: la palma mira hacia dentro; pronada, hacia abajo.
      expect(palm(a).x * medial).toBeGreaterThan(0.8);
      expect(palm(b).y).toBeLessThan(-0.8);
    });
    it(`${s}: supinación pone la palma hacia arriba (codo a 90°)`, () => {
      const [, b] = ends(spec("sitting", { [`${s}_shoulder`]: { flex: 0, abd: 0 }, [`${s}_elbow`]: { flex: 90, pron: 0 } }, { [`${s}_elbow`]: { pron: -80 } }));
      expect(local(b, new Vector3(0, 0, 1).applyQuaternion(b.seg[`${s}_hand`].q), true).y).toBeGreaterThan(0.8);
    });
    it(`${s}: inversión pone la planta del pie mirando hacia dentro`, () => {
      const [, b] = ends(spec("sitting", {}, { [`${s}_ankle`]: { inv: 35 } }));
      const sole = local(b, new Vector3(0, -1, 0).applyQuaternion(b.seg[`${s}_foot`].q), true);
      expect(sole.x * medial).toBeGreaterThan(0.45);
    });
    it(`${s}: rotación externa del pie: la punta va hacia fuera sin mover la tibia`, () => {
      const [a, b] = ends(spec("sitting", { [`${s}_ankle`]: { rot: 0 } }, { [`${s}_ankle`]: { rot: -25 } }));
      expect((pt(b, `${s}_foottip`).x - pt(a, `${s}_foottip`).x) * medial).toBeLessThan(-4);
      expect(pt(b, `${s}_ankle`).distanceTo(pt(a, `${s}_ankle`))).toBeLessThan(1e-6);
    });
    it(`${s}: desviación radial lleva la mano hacia el pulgar`, () => {
      // Posición anatómica (palma hacia delante): el pulgar queda por fuera.
      const [a, b] = ends(spec("standing", { [`${s}_elbow`]: { flex: 0, pron: -90 }, [`${s}_shoulder`]: { abd: 0 } }, { [`${s}_wrist`]: { abd: 20 } }));
      expect((pt(b, `${s}_handtip`).x - pt(a, `${s}_handtip`).x) * medial).toBeLessThan(-3);
    });
    it(`${s}: flexión de hombro, de codo, de rodilla y flexión dorsal van hacia donde deben`, () => {
      const [a, b] = ends(spec("standing", { [`${s}_elbow`]: { flex: 0 } }, { [`${s}_shoulder`]: { flex: 90 } }));
      expect(pt(b, `${s}_wrist`).z - pt(a, `${s}_wrist`).z).toBeGreaterThan(30);
      const [c, d] = ends(spec("standing", { [`${s}_elbow`]: { flex: 0 } }, { [`${s}_elbow`]: { flex: 90 } }));
      expect(pt(d, `${s}_wrist`).z - pt(c, `${s}_wrist`).z).toBeGreaterThan(15);
      const [e, g] = ends(spec("prone", {}, { [`${s}_knee`]: { flex: 90 } }));
      expect(pt(g, `${s}_ankle`).z - pt(e, `${s}_ankle`).z).toBeLessThan(-30);
      const [h, i] = ends(spec("sitting", { [`${s}_ankle`]: { flex: 0 } }, { [`${s}_ankle`]: { flex: 20 } }));
      expect(pt(i, `${s}_foottip`).y - pt(h, `${s}_foottip`).y).toBeGreaterThan(4);
    });
    it(`${s}: abducción de hombro y de cadera separan del cuerpo`, () => {
      const [a, b] = ends(spec("standing", { [`${s}_shoulder`]: { abd: 0 } }, { [`${s}_shoulder`]: { abd: 60 } }));
      expect((pt(b, `${s}_elbow`).x - pt(a, `${s}_elbow`).x) * medial).toBeLessThan(-10);
      const [c, d] = ends(spec("supine", { [`${s}_hip`]: { abd: 0 } }, { [`${s}_hip`]: { abd: 30 } }));
      expect((pt(d, `${s}_ankle`).x - pt(c, `${s}_ankle`).x) * medial).toBeLessThan(-20);
    });
  }
  it("cuello: rotación derecha lleva la nariz a la derecha; inclinación derecha, la cabeza", () => {
    const [, b] = ends(spec("sitting", {}, { neck: { rot: 60 } }));
    const nose = local(b, new Vector3(0, 0, 1).applyQuaternion(b.head.q), true);
    expect(nose.x).toBeLessThan(-0.8);
    const [c, d] = ends(spec("sitting", {}, { neck: { lat: 30 } }));
    expect(pt(d, "head").x - pt(c, "head").x).toBeLessThan(-4);
  });
  it("tronco: rotación derecha gira el pecho a la derecha; inclinación derecha baja el hombro derecho", () => {
    const [, b] = ends(spec("sitting", {}, { trunk: { rot: 40 } }));
    expect(local(b, new Vector3(0, 0, 1).applyQuaternion(b.trunkQ), true).x).toBeLessThan(-0.5);
    const [c, d] = ends(spec("standing", {}, { trunk: { lat: 25 } }));
    expect(pt(d, "neck").x - pt(c, "neck").x).toBeLessThan(-10);
    expect(pt(d, "r_shoulder").y).toBeLessThan(pt(d, "l_shoulder").y);
  });
  it("pelvis: inclinación + baja el lado derecho; rotación + la gira a la derecha", () => {
    const [, b] = ends(spec("supine", {}, { pelvis: { lat: 10 } }));
    expect(b.pt.r_hip!.clone().sub(b.pt.l_hip!).applyQuaternion(b.root.q.clone().invert()).y).toBeLessThan(-2);
    const [, d] = ends(spec("standing", {}, { pelvis: { rot: 20 } }));
    expect(local(d, new Vector3(0, 0, 1).applyQuaternion(d.pelvisQ), true).x).toBeLessThan(-0.3);
  });
});

describe("medida de los ángulos sobre el modelo", () => {
  it("devuelve los ángulos pedidos (ida y vuelta) en todos los grados de libertad", () => {
    const pose: BodyPose = {
      pelvis: { flex: 12, lat: -6, rot: 15 },
      trunk: { flex: 25, lat: 10, rot: -20 },
      neck: { flex: -20, lat: 15, rot: 40 },
      r_shoulder: { flex: 70, abd: 30, rot: 35 },
      l_shoulder: { flex: -20, abd: 45, rot: -40 },
      r_elbow: { flex: 100, pron: 60 },
      l_elbow: { flex: 30, pron: -70 },
      r_wrist: { flex: 40, abd: -20 },
      l_wrist: { flex: -50, abd: 15 },
      r_hip: { flex: 80, abd: -10, rot: 30 },
      l_hip: { flex: 20, abd: 25, rot: -35 },
      r_knee: { flex: 90, rot: 20 },
      l_knee: { flex: 40, rot: -25 },
      r_ankle: { flex: 15, inv: 25, rot: -20 },
      l_ankle: { flex: -30, inv: -15, rot: 15 },
    };
    const f: FigureSpec = { view: "side", posture: "supine", script: { start: pose, steps: [{ text: "" }] } };
    const A = anatAngles(f, 0);
    const p = fk(new Vector3(), layoutPatient(f).rootQ, A);
    const m = measureAngles(p);
    for (const [k, j] of Object.entries(pose)) for (const [d, v] of Object.entries(j)) expect(m[k as keyof BodyPose]![d as "flex"], `${k}.${d}`).toBeCloseTo(v as number, 4);
  });
  it("las articulaciones que el guion no mueve no cambian en toda la maniobra", () => {
    const f = spec("supine", { r_hip: { flex: 90 }, r_knee: { flex: 90 } }, { r_hip: { rot: 30 } });
    const L = layoutPatient(f);
    const R0 = jointRotations(patientPose(L, 0, 0));
    for (const u of [0.1, 0.25, 0.4, 0.5, 0.75]) {
      const R = jointRotations(patientPose(L, u, 0));
      for (const k of Object.keys(R0)) if (k !== "r_hip") expect(quatAngle(R0[k]!, R[k]!), `${k} en u=${u}`).toBeLessThan(0.01);
    }
  });
});

describe("guiones de la galería", () => {
  it("ningún guion pide ángulos fuera de los límites fisiológicos", () => {
    const bad = tests.flatMap((t) => t.figures.flatMap((f, i) => limitViolations(f).map((v) => `${t.id}#${i}: ${v}`)));
    expect(bad).toEqual([]);
  });
  it("los límites cubren todos los grados de libertad del convenio", () => {
    for (const k of ["pelvis", "trunk", "neck", "shoulder", "elbow", "wrist", "hip", "knee", "ankle"]) expect(LIMITS[k], k).toBeTruthy();
  });
});
