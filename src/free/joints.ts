// Puntos del modelo de pose (33, numeración de BlazePose) y puntos derivados para la medición.
import type { Landmark3D } from "./types";

/** Puntos que se ofrecen para medir, con su índice en el modelo. */
export const baseJoints: { id: string; label: string; index: number }[] = [
  { id: "nose", label: "Nariz", index: 0 },
  { id: "l_ear", label: "Oreja izquierda", index: 7 },
  { id: "r_ear", label: "Oreja derecha", index: 8 },
  { id: "l_shoulder", label: "Hombro izquierdo", index: 11 },
  { id: "r_shoulder", label: "Hombro derecho", index: 12 },
  { id: "l_elbow", label: "Codo izquierdo", index: 13 },
  { id: "r_elbow", label: "Codo derecho", index: 14 },
  { id: "l_wrist", label: "Muñeca izquierda", index: 15 },
  { id: "r_wrist", label: "Muñeca derecha", index: 16 },
  { id: "l_hip", label: "Cadera izquierda", index: 23 },
  { id: "r_hip", label: "Cadera derecha", index: 24 },
  { id: "l_knee", label: "Rodilla izquierda", index: 25 },
  { id: "r_knee", label: "Rodilla derecha", index: 26 },
  { id: "l_ankle", label: "Tobillo izquierdo", index: 27 },
  { id: "r_ankle", label: "Tobillo derecho", index: 28 },
  { id: "l_heel", label: "Talón izquierdo", index: 29 },
  { id: "r_heel", label: "Talón derecho", index: 30 },
  { id: "l_foot", label: "Punta del pie izquierdo", index: 31 },
  { id: "r_foot", label: "Punta del pie derecho", index: 32 },
];

/** Puntos derivados: el modelo no tiene C7 ni sacro; se aproximan con los puntos medios. */
const derivedJoints: { id: string; label: string; from: [number, number] }[] = [
  { id: "mid_ear", label: "Centro de la cabeza (orejas)", from: [7, 8] },
  { id: "mid_shoulder", label: "Base del cuello (≈ C7)", from: [11, 12] },
  { id: "mid_hip", label: "Centro de la pelvis (≈ sacro)", from: [23, 24] },
];

export const jointLabel = (id: string) => baseJoints.find((j) => j.id === id)?.label ?? derivedJoints.find((j) => j.id === id)?.label ?? id;

export const allJoints = [...derivedJoints.map((j) => ({ id: j.id, label: j.label })), ...baseJoints.map((j) => ({ id: j.id, label: j.label }))];

/** Coordenadas de un punto (base o derivado) en una lista de 33 puntos. */
export function jointPoint(points: Landmark3D[], id: string): Landmark3D | null {
  const base = baseJoints.find((j) => j.id === id);
  if (base) return points[base.index] ?? null;
  const d = derivedJoints.find((j) => j.id === id);
  if (!d) return null;
  const a = points[d.from[0]];
  const b = points[d.from[1]];
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

/** Esqueleto minimalista: cabeza-cuello, columna, cintura escapular, brazos y piernas. */
export const skeleton: [string, string][] = [
  ["mid_ear", "mid_shoulder"],
  ["mid_shoulder", "mid_hip"],
  ["l_shoulder", "r_shoulder"],
  ["l_hip", "r_hip"],
  ["l_shoulder", "l_elbow"],
  ["l_elbow", "l_wrist"],
  ["r_shoulder", "r_elbow"],
  ["r_elbow", "r_wrist"],
  ["l_hip", "l_knee"],
  ["l_knee", "l_ankle"],
  ["l_ankle", "l_foot"],
  ["l_heel", "l_foot"],
  ["r_hip", "r_knee"],
  ["r_knee", "r_ankle"],
  ["r_ankle", "r_foot"],
  ["r_heel", "r_foot"],
];

/** Puntos que se dibujan (y a los que se ancla un toque). */
export const drawnJoints = [...new Set(skeleton.flat())];

/** Mediciones preparadas: lo más habitual en consulta, con su plano y sus vectores. */
export const presets: {
  id: string;
  label: string;
  plane: "sagittal" | "frontal" | "transverse" | "screen";
  reference: { type: "plumb_line" } | { type: "axial_body"; start: string; end: string };
  movement: { start: string; end: string };
}[] = [
  { id: "sh_abd_r", label: "Abducción de hombro derecho", plane: "frontal", reference: { type: "axial_body", start: "mid_shoulder", end: "mid_hip" }, movement: { start: "r_shoulder", end: "r_elbow" } },
  { id: "sh_abd_l", label: "Abducción de hombro izquierdo", plane: "frontal", reference: { type: "axial_body", start: "mid_shoulder", end: "mid_hip" }, movement: { start: "l_shoulder", end: "l_elbow" } },
  { id: "sh_flex_r", label: "Flexión de hombro derecho", plane: "sagittal", reference: { type: "axial_body", start: "mid_shoulder", end: "mid_hip" }, movement: { start: "r_shoulder", end: "r_elbow" } },
  { id: "sh_flex_l", label: "Flexión de hombro izquierdo", plane: "sagittal", reference: { type: "axial_body", start: "mid_shoulder", end: "mid_hip" }, movement: { start: "l_shoulder", end: "l_elbow" } },
  { id: "hip_flex_r", label: "Flexión de cadera derecha", plane: "sagittal", reference: { type: "axial_body", start: "mid_hip", end: "mid_shoulder" }, movement: { start: "r_hip", end: "r_knee" } },
  { id: "hip_flex_l", label: "Flexión de cadera izquierda", plane: "sagittal", reference: { type: "axial_body", start: "mid_hip", end: "mid_shoulder" }, movement: { start: "l_hip", end: "l_knee" } },
  { id: "knee_r", label: "Rodilla derecha (muslo y tibia)", plane: "sagittal", reference: { type: "axial_body", start: "r_knee", end: "r_hip" }, movement: { start: "r_knee", end: "r_ankle" } },
  { id: "knee_l", label: "Rodilla izquierda (muslo y tibia)", plane: "sagittal", reference: { type: "axial_body", start: "l_knee", end: "l_hip" }, movement: { start: "l_knee", end: "l_ankle" } },
  { id: "trunk_flex", label: "Inclinación del tronco", plane: "sagittal", reference: { type: "plumb_line" }, movement: { start: "mid_hip", end: "mid_shoulder" } },
  { id: "neck_flex", label: "Cabeza respecto al tronco", plane: "sagittal", reference: { type: "axial_body", start: "mid_hip", end: "mid_shoulder" }, movement: { start: "mid_shoulder", end: "mid_ear" } },
];
