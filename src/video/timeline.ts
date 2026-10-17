// Fotograma ↔ tiempo del reproductor a partir de la hora real de cada fotograma del archivo.
// Los vídeos de móvil no van a un ritmo exacto (p. ej. 30,08 fps con saltos de 31-36 ms):
// suponer un ritmo fijo acaba mostrando el fotograma de al lado.

export type Timeline = {
  /** Hora de presentación de cada fotograma en el archivo, en segundos, ordenadas. */
  times: number[];
  /** Diferencia entre la hora del archivo y la del reproductor (inicios retrasados, listas de edición). */
  offset: number;
};

/** Tiempo al que hay que llevar el reproductor para ver el fotograma `frame`: el centro de su intervalo. */
export function seekTime(tl: Timeline | null, frame: number, fallbackFps: number): number {
  if (!tl || tl.times.length === 0) return (frame + 0.5) / fallbackFps;
  const { times, offset } = tl;
  const i = Math.max(0, Math.min(times.length - 1, frame));
  const next = times[i + 1] ?? times[i]! + (times.length > 1 ? (times[i]! - times[0]!) / Math.max(1, i) || 1 / fallbackFps : 1 / fallbackFps);
  return (times[i]! + next) / 2 + offset;
}

/** Fotograma que se ve en el instante `t` del reproductor (el último que ya ha empezado). */
export function frameAt(tl: Timeline | null, t: number, fallbackFps: number, last: number): number {
  if (!tl || tl.times.length === 0) return Math.max(0, Math.min(last, Math.floor(t * fallbackFps)));
  const { times, offset } = tl;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! + offset <= t + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(last, lo);
}
