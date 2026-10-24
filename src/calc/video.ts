// Conversión de fotogramas a tiempo real. El cálculo usa los fps de GRABACIÓN, no los del archivo:
// un vídeo a cámara lenta exportado a 30 fps sigue teniendo cada fotograma separado 1/240 s en la realidad.

function framesToSeconds(frames: number, captureFps: number): number {
  if (!(captureFps > 0)) throw new RangeError("Los fps deben ser mayores que cero");
  return frames / captureFps;
}

/** Intervalo entre dos fotogramas marcados, en segundos. Exige que el segundo vaya después. */
export function intervalS(fromFrame: number, toFrame: number, captureFps: number): number {
  if (toFrame <= fromFrame) throw new RangeError("El segundo evento debe ir después del primero");
  return framesToSeconds(toFrame - fromFrame, captureFps);
}

/** Por debajo de esto, un fotograma de error ya mueve la altura de un CMJ más de 1,5 cm. */
export const MIN_RECOMMENDED_FPS = 100;
