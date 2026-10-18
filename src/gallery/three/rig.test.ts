import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { tests } from "../data";
import { CAMERAS, cameraKey } from "./cameras";
import PLANS from "./plans.json";
import { bodySDF, skinPoints, tableD } from "./collide";
import { contacts, examinerPose, handAt, handTarget, planExaminer } from "./examiner";
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
      for (const [m, p] of poses.entries()) {
        const base = examinerPose(plan!, contacts(f, p, null, plan), 0, m);
        const cts = contacts(f, p, base, plan);
        const ex = examinerPose(plan!, cts, 1, m);
        for (const arm of plan!.arms) {
          // La muñeca llega a donde la toma la necesita.
          const S = base.pt[`${arm.side}_shoulder`]!;
          const gap = ex.seg[`${arm.side}_hand`].p.distanceTo(handTarget(cts[arm.hand]!, S, handAt(arm, m)).W);
          if (gap > 4) far.push(`${id} ${f.hands[arm.hand]} ${gap.toFixed(1)} cm`);
        }
      }
    }
    expect(far).toEqual([]);
  }, 60_000);

  it("el examinador no se mete en el paciente ni en la camilla, ni el paciente en sí mismo", () => {
    const bad: string[] = [];
    for (const { id, f } of figures) {
      const L = layoutPatient(f);
      const poses = [0, 1].map((m) => patientPose(L, m, 0));
      const plan = f.hands?.length ? planExaminer(f, poses, L.table) : null;
      for (const m of [0, 0.5, 1]) {
        const pat = patientPose(L, m, 1);
        const psdf = bodySDF(pat);
        // Antebrazos y manos del paciente fuera de su tronco y su cabeza (apoyados, como mucho, hundiendo algo la piel).
        const worst = Math.min(...skinPoints(pat, (p) => /forearm|hand/.test(p), 2).map((sp) => psdf(sp.p, (q) => q !== "torso" && q !== "head").d));
        if (worst < -2.5) bad.push(`${id} m=${m} paciente: antebrazo o mano dentro del cuerpo ${(-worst).toFixed(1)} cm`);
        if (!plan) continue;
        const base = examinerPose(plan, contacts(f, pat, null, plan), 0, m);
        const cts = contacts(f, pat, base, plan);
        const ex = examinerPose(plan, cts, 1, m);
        // Cuerpo, cabeza, piernas y brazos del examinador fuera del paciente y de la camilla.
        const body = skinPoints(ex, (p) => !/hand|forearm/.test(p), 2);
        const inside = Math.min(...body.map((sp) => psdf(sp.p).d));
        if (inside < -1.5) bad.push(`${id} m=${m} examinador dentro del paciente ${(-inside).toFixed(1)} cm`);
        if (L.table && Math.min(...body.map((sp) => tableD(L.table!, sp.p))) < -1.5) bad.push(`${id} m=${m} examinador dentro de la camilla`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it("cada figura con examinador tiene su colocación precalculada (si falla: node scripts/gallery3d-plans.mjs)", () => {
    const missing = figures.filter(({ f }) => f.hands?.length && f.examiner !== "none" && !(PLANS as Record<string, unknown>)[cameraKey(f)]).map((x) => x.id);
    expect(missing).toEqual([]);
  });

  it("cada figura tiene su cámara precalculada (si falla: node scripts/gallery3d-cameras.mjs)", () => {
    const missing = figures.filter(({ f }) => !CAMERAS[cameraKey(f)]).map((x) => x.id);
    expect(missing).toEqual([]);
  });
});
