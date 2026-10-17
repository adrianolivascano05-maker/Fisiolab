import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { tests } from "../data";
import { CAMERAS, cameraKey } from "./cameras";
import { contacts, examinerPose, planExaminer } from "./examiner";
import { layoutPatient, patientPose } from "./layout";
import { anchorInfo, DIM, fk, patientAngles, postureQ, upSide } from "./rig";

const figures = tests.flatMap((t) => t.figures.map((f, i) => ({ id: `${t.id}#${i}`, f })));
const poseOf = (f: (typeof figures)[number]["f"], m: number) => fk(new Vector3(0, 100, 0), postureQ(f.posture, upSide(f)), patientAngles(f, m));

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
      const poses = [0, 1].map((m) => patientPose(L, m, 0));
      const plan = planExaminer(f, poses, L.table);
      expect(plan, id).not.toBeNull();
      for (const p of poses) {
        const base = examinerPose(plan!, contacts(f, p, null, plan), 0);
        const cts = contacts(f, p, base, plan);
        const ex = examinerPose(plan!, cts, 1);
        for (const arm of plan!.arms) {
          const palm = ex.seg[`${arm.side}_hand`].p.clone().add(new Vector3(0, -8, 1.7).applyQuaternion(ex.seg[`${arm.side}_hand`].q));
          const gap = palm.distanceTo(cts[arm.hand]!.p);
          if (gap > 4) far.push(`${id} ${f.hands[arm.hand]} ${gap.toFixed(1)} cm`);
        }
      }
    }
    expect(far).toEqual([]);
  }, 60_000);

  it("cada figura tiene su cámara precalculada (si falla: node scripts/gallery3d-cameras.mjs)", () => {
    const missing = figures.filter(({ f }) => !CAMERAS[cameraKey(f)]).map((x) => x.id);
    expect(missing).toEqual([]);
  });
});
