// Detección automática de las repeticiones de fuerza: se sigue la altura de las muñecas (que agarran la
// barra) o de la cadera (hip thrust). Cada subida de la barra, del punto más bajo al más alto, es la
// fase concéntrica de una repetición. Funciones puras.
import type { MarkInput } from "../calc/results";
import type { Detection } from "./jumpDetect";
import type { Landmark3D } from "./types";

export type BarSample = { frame: number; y: number | null };

/** Qué puntos siguen a la barra en cada ejercicio. */
export function barPoints(exercise: string): number[] {
  return exercise === "hip_thrust" ? [23, 24] : [15, 16];
}

export function barSample(frame: number, points: Landmark3D[] | null, exercise: string): BarSample {
  if (!points) return { frame, y: null };
  const seen = barPoints(exercise)
    .map((i) => points[i])
    .filter((p): p is Landmark3D => !!p && (p.visibility ?? 1) >= 0.5);
  return { frame, y: seen.length ? seen.reduce((s, p) => s + p.y, 0) / seen.length : null };
}

/**
 * Propone inicio y fin de la subida de cada repetición. Inicio: primer fotograma en que la barra ya ha
 * dejado el punto más bajo. Fin: primer fotograma en que llega arriba. En la imagen, subir es que y baje.
 */
export function detectReps(all: BarSample[]): Detection {
  const raw = all.filter((s): s is { frame: number; y: number } => s.y !== null).sort((a, b) => a.frame - b.frame);
  if (raw.length < 10) return { error: "No se ven las manos (o la cadera). Graba de lado, con el cuerpo entero en el cuadro y buena luz." };
  // Mediana de 3 contra el temblor de los puntos.
  const s = raw.map((p, i) => ({ frame: p.frame, y: [raw[i - 1]?.y ?? p.y, p.y, raw[i + 1]?.y ?? p.y].sort((a, b) => a - b)[1]! }));
  const sorted = s.map((p) => p.y).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]!;
  const range = q(0.95) - q(0.05);
  if (range < 0.02) return { error: "No se ve subir y bajar la barra en el vídeo." };
  const prom = 0.35 * range;

  // Zigzag: extremos que se alejan al menos `prom` del anterior. bottom = punto más bajo (y máxima).
  const pivots: { i: number; bottom: boolean }[] = [];
  let cand = 0;
  let dir: "down" | "up" | null = null; // Sentido de la barra en la imagen: down = y crece.
  for (let i = 1; i < s.length; i++) {
    const y = s[i]!.y;
    if (dir === null) {
      if (y - s[cand]!.y >= prom) {
        pivots.push({ i: cand, bottom: false });
        dir = "down";
        cand = i;
      } else if (s[cand]!.y - y >= prom) {
        pivots.push({ i: cand, bottom: true });
        dir = "up";
        cand = i;
      } else if (Math.abs(y - s[0]!.y) > Math.abs(s[cand]!.y - s[0]!.y)) cand = i;
    } else if (dir === "down") {
      if (y > s[cand]!.y) cand = i;
      else if (s[cand]!.y - y >= prom) {
        pivots.push({ i: cand, bottom: true });
        dir = "up";
        cand = i;
      }
    } else {
      if (y < s[cand]!.y) cand = i;
      else if (y - s[cand]!.y >= prom) {
        pivots.push({ i: cand, bottom: false });
        dir = "down";
        cand = i;
      }
    }
  }
  if (dir !== null) pivots.push({ i: cand, bottom: dir === "down" });

  const marks: MarkInput[] = [];
  for (let k = 0; k + 1 < pivots.length; k++) {
    const b = pivots[k]!;
    const t = pivots[k + 1]!;
    if (!b.bottom || t.bottom) continue;
    const yb = s[b.i]!.y;
    const yt = s[t.i]!.y;
    const eps = Math.max(0.03 * (yb - yt), 0.004);
    let start = b.i;
    while (start < t.i && s[start]!.y >= yb - eps) start++;
    let end = start;
    while (end < t.i && s[end]!.y > yt + eps) end++;
    if (end <= start) continue;
    const n = marks.length / 2;
    marks.push({ event: "bar_start", frame: s[start]!.frame, seriesIndex: n }, { event: "bar_end", frame: s[end]!.frame, seriesIndex: n });
  }
  if (!marks.length) return { error: "No se encuentra ninguna subida completa de la barra." };
  const warnings: string[] = [];
  const hidden = 1 - raw.length / all.length;
  if (hidden > 0.2) warnings.push(`En el ${Math.round(hidden * 100)} % de los fotogramas no se ven las manos: revisa las marcas.`);
  return { marks, warnings };
}
