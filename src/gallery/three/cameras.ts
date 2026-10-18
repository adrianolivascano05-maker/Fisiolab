// Cámaras precalculadas (scripts/gallery3d-cameras.mjs): elegir la mejor vista cuesta varios cientos de
// milisegundos en un móvil; con la tabla, la figura abre al momento. Si una figura cambia, su clave ya
// no está en la tabla y la cámara se calcula al abrirla.
import type { FigureSpec } from "../figure";
import data from "./cameras.json";

/** [acimut, elevación, centro x, y, z, distancia]. */
export type CamState = [number, number, number, number, number, number];

export const CAMERAS = data as unknown as Record<string, CamState>;

/** Huella de un texto (FNV-1a de 32 bits). */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Huella de lo que decide la cámara de una figura. Sin guion, toda la descripción; con guion, sin los textos
 * (cambiar un texto, una etiqueta o un supuesto no obliga a rehacer la cámara).
 */
export function cameraKey(spec: FigureSpec): string {
  if (!spec.script) return fnv(JSON.stringify(spec));
  const { caption: _c, text: _t, supuestos: _s, ...rest } = spec;
  return fnv(JSON.stringify({ ...rest, script: { ...rest.script, steps: rest.script!.steps.map(({ text: _x, label: _l, dur: _d, hold: _h, ...st }) => st) } }));
}

/** Huella de lo que decide la colocación del examinador (con guion: la postura, las tomas y los ángulos de cada paso). */
export function planKey(spec: FigureSpec): string {
  if (!spec.script) return cameraKey(spec);
  const { view, posture, near, hands, grips, examiner, prop, side, place, script } = spec;
  return "p" + fnv(JSON.stringify({ view, posture, near, hands, grips, examiner, prop, side, place, start: script.start, steps: script.steps.map((st) => ({ to: st.to, shift: st.shift, release: st.release })) }));
}
