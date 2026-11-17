// La hora de ahora para dibujar una pantalla: se toma una vez, al abrirla, y no cambia mientras se dibuja (React pide
// que dibujar dé siempre lo mismo; leer el reloj en cada dibujo puede dar resultados que bailan). Para lo que pasa al
// tocar un botón, `nowIso()` y `nowMs()` de src/app/dates.ts.
import { useState } from "react";

/** El instante (ms) en que se abrió la pantalla. */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

/** Lo mismo, como texto ISO («2026-11-17T10:00:00.000Z»). */
export function useNowIso(): string {
  const [now] = useState(() => new Date().toISOString());
  return now;
}
