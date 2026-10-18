// Pruebas clínicas de las figuras con guion: que la animación enseñe exactamente lo que dice la descripción
// (ángulos, sentido de cada rotación, lado), que no se mueva nada más, que los isométricos no se muevan y que la
// capa natural no cambie nada de lo clínico. Cada prueba puede fallar (hay pruebas que lo demuestran).
import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { tests } from "../data";
import { changes, labelMismatches, stepLabel } from "../describe";
import type { FigureSpec } from "../figure";
import { clockOf, sampleTimes, segments } from "../script";
import { anatAngles, jointRotations, keysOf, quatAngle } from "./anatomy";
import { planExaminer } from "./examiner";
import { layoutPatient, patientPose } from "./layout";
import { buildMarks, drawnSense } from "./marks";
import { applyNatural, naturalAt } from "./natural";
import { qAxis, qmul, sgn } from "./rig";
import { scenePoses } from "./scene";
import { sideOf, sideSegment } from "./stage";

const scripted = tests.flatMap((t) => t.figures.map((f, i) => ({ id: `${t.id}#${i}`, f }))).filter((x) => x.f.script);
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

describe("figuras con guion", () => {
  it("hay figuras con guion", () => expect(scripted.length).toBeGreaterThan(0));

  it("el sentido de cada flecha de recorrido y de resistencia es el de su movimiento (al final y a mitad de su paso)", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const L = layoutPatient(f);
      const S = segments(f.script!);
      const marks = buildMarks(f, L);
      marks.steps.forEach((ms, i) =>
        ms.forEach((mk) => {
          if (!mk.path) return;
          const u = mk.path.virtual ? (i + 1) / S : (i + 1) / S;
          const s = drawnSense(L, u, mk.path);
          if (s !== mk.path.sign) bad.push(`${id} paso ${i + 1} ${mk.path.joint}.${mk.path.dof}: dibujada ${s}, debería ${mk.path.sign}`);
          if (!mk.path.virtual) {
            // A mitad del paso: la flecha va hacia donde va el punto en ese momento.
            const n = mk.path.pts.length;
            const half = { ...mk.path, pts: mk.path.pts.slice(0, Math.ceil(n / 2) + 1) };
            const sh = drawnSense(L, (i + 0.5) / S, half);
            if (sh !== 0 && sh !== mk.path.sign) bad.push(`${id} paso ${i + 1} a mitad: dibujada ${sh}, debería ${mk.path.sign}`);
          }
        }),
      );
    }
    expect(bad).toEqual([]);
  }, 300_000);

  it("la comprobación del sentido falla si la flecha se dibuja al revés", () => {
    const { f } = scripted.find((x) => x.f.script!.steps.some((st) => st.to && Object.values(st.to).some((j) => j.rot)))!;
    const L = layoutPatient(f);
    const S = segments(f.script!);
    const marks = buildMarks(f, L);
    const i = marks.steps.findIndex((ms) => ms.some((mk) => mk.path));
    const mk = marks.steps[i]!.find((x) => x.path)!;
    expect(drawnSense(L, (i + 1) / S, mk.path!)).toBe(mk.path!.sign);
    // La misma flecha en el mismo sitio, apuntando al revés (simétrica respecto a su punta).
    const tip = mk.path!.pts[mk.path!.pts.length - 1]!;
    expect(drawnSense(L, (i + 1) / S, { ...mk.path!, pts: mk.path!.pts.map((p) => tip.clone().multiplyScalar(2).sub(p)) })).toBe(-mk.path!.sign);
  });

  it("las etiquetas escritas a mano no contradicen al movimiento", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const keys = keysOf(f);
      f.script!.steps.forEach((st, i) => {
        const ch = changes(keys[i]!.pose, keys[i + 1]!.pose);
        if (st.label) bad.push(...labelMismatches(st.label, ch).map((m) => `${id} paso ${i + 1}: ${m}`));
        // Las de resistencia: lo que dicen frente al sentido que se intenta.
        for (const mk of st.marks ?? [])
          if (mk.kind === "resist" && "joint" in mk && mk.label)
            bad.push(...labelMismatches(mk.label, [{ joint: mk.joint, dof: mk.dof, from: 0, to: mk.sign }]).map((m) => `${id} paso ${i + 1} (resiste): ${m}`));
      });
    }
    expect(bad).toEqual([]);
  });

  it("la comprobación de etiquetas falla si una etiqueta dice RE y el paso hace RI", () => {
    expect(labelMismatches("RE 30°", [{ joint: "r_hip", dof: "rot", from: 0, to: 30 }])).toHaveLength(1);
    expect(labelMismatches("RI 30°", [{ joint: "r_hip", dof: "rot", from: 0, to: 30 }])).toHaveLength(0);
  });

  it("las etiquetas automáticas dicen el sentido del movimiento", () => {
    const f: FigureSpec = { view: "side", posture: "supine", script: { start: { r_hip: { flex: 90 }, r_knee: { flex: 90 } }, steps: [{ to: { r_hip: { rot: -40 } }, text: "" }] } };
    expect(stepLabel(f, keysOf(f), 0)).toBe("RE 40°");
    // Con dos articulaciones, dice cuál es cada una.
    const g: FigureSpec = { view: "side", posture: "supine", script: { start: { r_hip: { flex: 90 }, r_knee: { flex: 90 } }, steps: [{ to: { r_hip: { flex: 115 }, r_knee: { flex: 120 } }, text: "" }] } };
    expect(stepLabel(g, keysOf(g), 0)).toBe("Rodilla: flexión 120° · cadera: flexión 115°");
  });

  it("en cada pose clave, el giro de cada articulación del modelo es el que dice el convenio", () => {
    const bad: string[] = [];
    // El convenio escrito aparte (no con el código del esqueleto): flexión, luego abducción y luego rotación.
    const expected = (k: string, j: { flex?: number; abd?: number; rot?: number; inv?: number }, s: number): Quaternion | null => {
      const F = j.flex ?? 0;
      const A = j.abd ?? 0;
      const R = j.rot ?? 0;
      if (/shoulder|hip/.test(k)) return qmul(qAxis(X, -F), qAxis(Z, s * A), qAxis(Y, -s * R));
      if (/knee/.test(k)) return qmul(qAxis(X, F), qAxis(Z, s * A), qAxis(Y, -s * R));
      // Tobillo: el pie gira sobre el eje de la tibia, luego se flexiona y luego se invierte.
      if (/ankle/.test(k)) return qmul(qAxis(Y, -s * R), qAxis(X, -F), qAxis(Z, -s * (j.inv ?? 0)));
      return null;
    };
    for (const { id, f } of scripted) {
      const L = layoutPatient(f);
      const S = segments(f.script!);
      for (let i = 0; i <= S; i++) {
        const u = i / S;
        const R = jointRotations(patientPose(L, u, 0));
        const A = anatAngles(f, u);
        for (const s of ["r", "l"] as const) {
          for (const j of ["shoulder", "hip", "knee", "ankle"] as const) {
            // Los brazos que el guion no menciona los recoloca la escena para que no choquen: no se miden.
            if (j === "shoulder" && (L.arms[s].flex || L.arms[s].abd)) continue;
            const q = expected(j, { ...A[s][j] }, sgn(s));
            const d = q ? quatAngle(q, R[`${s}_${j}`]!) : 0;
            if (d > 0.05) bad.push(`${id} u=${u.toFixed(2)} ${s}_${j}: ${d.toFixed(2)}°`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);

  it("no se mueve ninguna articulación que el guion no mueva (más de 0,5°)", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const L = layoutPatient(f);
      const moved = new Set<string>();
      const keys = keysOf(f);
      for (let i = 0; i + 1 < keys.length; i++) for (const c of changes(keys[i]!.pose, keys[i + 1]!.pose)) moved.add(c.joint);
      // Lo que cuelga con la gravedad cuando el tronco o la pelvis se inclinan se recoloca solo.
      const leans = moved.has("trunk") || moved.has("pelvis");
      const R0 = jointRotations(patientPose(L, 0, 0));
      for (const t of sampleTimes(clockOf(f, keys), 0.05)) {
        const tl = clockOf(f, keys).at(t);
        const R = jointRotations(patientPose(L, tl.m, 0));
        for (const k of Object.keys(R0)) {
          if (moved.has(k as never)) continue;
          if (k === "r_wrist" || k === "l_wrist") continue; // la mano sigue al antebrazo: se mide en el codo
          if (k.endsWith("_elbow") && moved.has(`${k.slice(0, 2)}elbow` as never)) continue;
          if (leans && /shoulder|hip/.test(k) && !f.script!.start?.[k as never]) continue;
          // El cuello lo inclina el tronco (se mide respecto al tórax: no cambia) y la pelvis la mueve el cuerpo.
          const d = quatAngle(R0[k]!, R[k]!);
          if (d > 0.5) bad.push(`${id} t=${t} ${k} ${d.toFixed(1)}°`);
        }
      }
    }
    expect([...new Set(bad.map((b) => b.replace(/ t=[\d.]+/, "").replace(/ [\d.]+°$/, "")))]).toEqual([]);
  }, 300_000);

  it("en los pasos isométricos no se desplaza nada del paciente", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const L = layoutPatient(f);
      const S = segments(f.script!);
      f.script!.steps.forEach((st, i) => {
        if (st.to || st.shift) return;
        const a = patientPose(L, i / S, 0);
        for (const x of [0.25, 0.5, 0.75, 1]) {
          const b = patientPose(L, (i + x) / S, 0);
          for (const k of Object.keys(a.pt)) if (a.pt[k]!.distanceTo(b.pt[k]!) > 1e-6) bad.push(`${id} paso ${i + 1}: ${k}`);
        }
      });
    }
    expect([...new Set(bad)]).toEqual([]);
  }, 300_000);

  it("la capa natural no cambia ningún ángulo del paciente ni dónde está", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const L = layoutPatient(f);
      const plan = planExaminer(f, L);
      const keys = keysOf(f);
      const clock = clockOf(f, keys);
      for (const t of sampleTimes(clock, 0.05)) {
        const tl = clock.at(t);
        const { pat, ex, cts } = scenePoses(f, L, plan, tl);
        const sec = t * clock.duration;
        const nat = applyNatural(pat, ex, sec, cts.map((c) => c.p));
        void naturalAt(sec);
        const R0 = jointRotations(pat);
        const R1 = jointRotations(nat.pat);
        for (const k of Object.keys(R0)) if (quatAngle(R0[k]!, R1[k]!) > 1e-3) bad.push(`${id} ${k}`);
        for (const k of Object.keys(pat.pt)) if (pat.pt[k]!.distanceTo(nat.pat.pt[k]!) > 1e-9) bad.push(`${id} ${k}`);
        // Y el examinador sigue con las manos donde estaban.
        if (ex && nat.ex) for (const s of ["r", "l"] as const) if (ex.pt[`${s}_wrist`]!.distanceTo(nat.ex.pt[`${s}_wrist`]!) > 1e-9) bad.push(`${id} examinador ${s}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  }, 300_000);

  it("la prueba de la capa natural falla si la capa moviera una articulación del paciente", () => {
    const { f } = scripted[0]!;
    const L = layoutPatient(f);
    const pat = patientPose(L, 0, 0);
    const moved = { ...pat, seg: { ...pat.seg, r_forearm: { p: pat.seg.r_forearm.p, q: qAxis(X, 5).multiply(pat.seg.r_forearm.q) } } };
    expect(quatAngle(jointRotations(pat).r_elbow!, jointRotations(moved).r_elbow!)).toBeGreaterThan(1);
  });

  it("el lado de cada figura es el que dice y la letra D/I va en un miembro de ese lado", () => {
    const bad: string[] = [];
    for (const { id, f } of scripted) {
      const side = sideOf(f);
      if (!f.side) bad.push(`${id}: no dice qué lado explora`);
      if (side === "both") continue;
      const seg = sideSegment(f, side)!;
      if (!seg.startsWith(`${side}_`)) bad.push(`${id}: la letra va en ${seg}`);
      // Lo que se toca, duele o se mueve en los miembros, mayoritariamente de ese lado.
      const keys = keysOf(f);
      // De pie sobre una pierna, la que se levanta no es la explorada: cuenta la de apoyo.
      const L = f.posture === "standing" ? layoutPatient(f) : null;
      if (L) patientPose(L, 0, 0);
      const stance = L?.planted && L.planted.side !== "both" ? L.planted.side : null;
      const lifted = (a: string) => !!stance && a.startsWith(`${stance === "r" ? "l" : "r"}_`) && /hip|knee|ankle/.test(a);
      const moved = keys.slice(1).flatMap((k, i) => changes(keys[i]!.pose, k.pose).map((c) => c.joint as string)).filter((a) => !lifted(a));
      const lateral = [...(f.hands ?? []), ...(f.pain ?? []), ...moved, ...(stance ? [`${stance}_hip`] : [])].filter((a) => /^[rl]_/.test(a));
      const mine = lateral.filter((a) => a.startsWith(`${side}_`)).length;
      if (lateral.length && mine < lateral.length / 2) bad.push(`${id}: dice ${side} pero casi todo es del otro lado`);
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
