// Cámaras precalculadas (scripts/gallery3d-cameras.mjs): elegir la mejor vista cuesta varios cientos de
// milisegundos en un móvil; con la tabla, la figura abre al momento. Si una figura cambia, su clave ya
// no está en la tabla y la cámara se calcula al abrirla.
import type { FigureSpec } from "../figure";
import data from "./cameras.json";

/** [acimut, elevación, centro x, y, z, distancia]. */
export type CamState = [number, number, number, number, number, number];

export const CAMERAS = data as unknown as Record<string, CamState>;

/** Huella de la descripción de una figura (FNV-1a de 32 bits). */
export function cameraKey(spec: FigureSpec): string {
  const s = JSON.stringify(spec);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
