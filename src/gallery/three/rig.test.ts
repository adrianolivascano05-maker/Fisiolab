import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { clockOf } from "../script";
import { tests } from "../data";
import { CAMERAS, cameraKey } from "./cameras";
import PLANS from "./plans.json";
import { figureFaults } from "./audit";
import { bodySDF } from "./collide";
import { baseExaminerPose, fitHand, handAt, handTarget, planExaminer } from "./examiner";
import { scenePoses } from "./scene";
import { anglesOf, layoutPatient } from "./layout";
import { keysOf } from "./anatomy";
import { anchorInfo, DIM, fk, postureQ, upSide } from "./rig";

const figures = tests.flatMap((t) => t.figures.map((f, i) => ({ id: `${t.id}#${i}`, f })));
const poseOf = (f: (typeof figures)[number]["f"], m: number) => fk(new Vector3(0, 100, 0), postureQ(f.posture, upSide(f)), anglesOf(f, m));

describe("maniquí 3D", () => {
  it("los segmentos no cambian de longitud en ninguna figura", () => {
    for (const { id, f } of figures) {
      for (const m of [0, 0.5, 1]) {
        const p = poseOf(f, m);
        for (const s of ["r", "l"]) {
          const d = (a: string, b: string) => p.pt[`${s}_${a}`]!.distanceTo(p.pt[`${s}_${b}`]!);
          expect(d("shoulder", "elbow"), id).toBeCloseTo(DIM.upperarm, 6);
          expect(d("elbow", "wrist"), id).toBeCloseTo(DIM.forearm, 6);
          expect(d("hip", "knee"), id).toBeCloseTo(DIM.thigh, 6);
          expect(d("knee", "ankle"), id).toBeCloseTo(DIM.shank, 6);
        }
      }
    }
  });

  it("todos los puntos de manos, flechas y síntomas existen", () => {
    for (const { id, f } of figures) {
      const p = poseOf(f, 0);
      for (const a of [...(f.hands ?? []), ...(f.pain ?? []), ...(f.arrows ?? []).map((x) => x.at)]) expect(anchorInfo(p, a), `${id} ${a}`).not.toBeNull();
    }
  });

  it("las manos del examinador llegan a su sitio", () => {
    const far: string[] = [];
    for (const { id, f } of figures) {
      if (!f.hands?.length) continue;
      const L = layoutPatient(f);
      const plan = planExaminer(f, L);
      expect(plan, id).not.toBeNull();
      for (const m of [0, 1]) {
        const { pat, ex, cts } = scenePoses(f, L, plan, { m, reach: 1, arrows: m });
        const base = baseExaminerPose(plan!, m);
        const sdf = bodySDF(pat);
        for (const arm of plan!.arms) {
          // La muñeca llega a donde la toma la necesita (con la mano asentada en la piel).
          const S = base.pt[`${arm.side}_shoulder`]!.clone().sub(base.girdle[arm.side]);
          const ct = cts[arm.hand]!;
          const fit = fitHand(ct, handTarget(ct, S, handAt(arm, m)), sdf, arm.side);
          const gap = ex!.seg[`${arm.side}_hand`].p.distanceTo(fit.W);
          if (gap > 1.5) far.push(`${id} ${f.hands[arm.hand]} ${gap.toFixed(1)} cm`);
        }
      }
    }
    expect(far).toEqual([]);
  }, 120_000);

  it("en ningún momento hay nada metido en otra cosa ni brazos pasados de los topes de sus articulaciones", () => {
    const bad: string[] = [];
    for (const { id, f } of figures) {
      const L = layoutPatient(f);
      const plan = f.hands?.length ? planExaminer(f, L) : null;
      const { issues, joints } = figureFaults(f, L, plan, 0.05);
      for (const is of issues) bad.push(`${id} t=${is.t} ${is.what} ${is.depth} cm`);
      for (const [what, d] of joints) if (d > 2) bad.push(`${id} ${what} ${d.toFixed(0)}° de más`);
    }
    expect(bad).toEqual([]);
  }, 600_000);

  it("los codos y los hombros del examinador se mueven sin saltos", () => {
    const bad: string[] = [];
    for (const { id, f } of figures) {
      if (!f.hands?.length || f.examiner === "none") continue;
      const L = layoutPatient(f);
      const plan = planExaminer(f, L)!;
      // A 20 imágenes por segundo (la vuelta dura 7 s): el codo no puede ir mucho más deprisa que la mano.
      let prev: ReturnType<typeof scenePoses>["ex"] = null;
      let worst = { k: 0, t: 0, s: "" };
      const clock = clockOf(f, f.script ? keysOf(f) : undefined);
      const n = Math.round(clock.duration * 20);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const ex = scenePoses(f, L, plan, clock.at(t)).ex!;
        if (prev) {
          for (const arm of plan.arms) {
            const s = arm.side;
            // Respecto al hombro (si el examinador se desplaza, todo el brazo va con él).
            const rel = (p: NonNullable<typeof ex>, k: string) => p.pt[`${s}_${k}`]!.clone().sub(p.pt[`${s}_shoulder`]!);
            const dE = rel(ex, "elbow").distanceTo(rel(prev, "elbow"));
            const dW = rel(ex, "wrist").distanceTo(rel(prev, "wrist"));
            const dS = ex.girdle[s].distanceTo(prev.girdle[s]);
            const k = Math.max(dE - 1.5 * dW - 2, dS - 0.8);
            if (k > worst.k) worst = { k, t, s };
          }
        }
        prev = ex;
      }
      if (worst.k > 0) bad.push(`${id} ${worst.s} t=${worst.t.toFixed(3)} salto de ${worst.k.toFixed(1)} cm`);
    }
    expect(bad).toEqual([]);
  }, 300_000);

  it("cada figura con examinador tiene su colocación precalculada (si falla: node scripts/gallery3d-plans.mjs)", () => {
    const missing = figures.filter(({ f }) => f.hands?.length && f.examiner !== "none" && !(PLANS as Record<string, unknown>)[cameraKey(f)]).map((x) => x.id);
    expect(missing).toEqual([]);
  });

  it("cada figura tiene su cámara precalculada (si falla: node scripts/gallery3d-cameras.mjs)", () => {
    const missing = figures.filter(({ f }) => !CAMERAS[cameraKey(f)]).map((x) => x.id);
    expect(missing).toEqual([]);
  });
});
