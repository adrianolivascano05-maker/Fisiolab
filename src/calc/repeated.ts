// Saltos repetidos 10/5 (Harper et al., 2011): 10 rebotes seguidos, buscando poco contacto y mucha altura.
// El RSI de cada rebote es altura / tiempo de contacto; el resultado es la media de los 5 mejores RSI.
import { heightFromFlightTime, plausible, reactiveStrengthIndex } from "./jump";
import { intervalS } from "./video";

export type Rebound = { index: number; flightS: number; heightM: number; contactS: number | null; rsi: number | null };
export type RepeatedOutput = {
  jumps: Rebound[];
  best5: number[];
  rsiBest5: number | null;
  heightBest5M: number | null;
  contactBest5S: number | null;
  warnings: string[];
};

export const MIN_JUMPS = 6;

/**
 * `takeoffs[i]` y `landings[i]` son los fotogramas del salto i. El primero sale de parado (sin contacto
 * previo); cada contacto va del aterrizaje anterior al despegue siguiente.
 */
export function computeRepeated(takeoffs: number[], landings: number[], captureFps: number): RepeatedOutput {
  const n = Math.min(takeoffs.length, landings.length);
  const jumps: Rebound[] = [];
  for (let i = 0; i < n; i++) {
    const flightS = intervalS(takeoffs[i]!, landings[i]!, captureFps);
    const heightM = heightFromFlightTime(flightS);
    const contactS = i === 0 ? null : intervalS(landings[i - 1]!, takeoffs[i]!, captureFps);
    jumps.push({ index: i + 1, flightS, heightM, contactS, rsi: contactS ? reactiveStrengthIndex(heightM, contactS) : null });
  }
  const rebounds = jumps.filter((j) => j.rsi !== null);
  const best = [...rebounds].sort((a, b) => b.rsi! - a.rsi!).slice(0, 5);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const warnings: string[] = [];
  if (rebounds.length < 5) warnings.push(`Hacen falta al menos ${MIN_JUMPS} saltos marcados (5 rebotes).`);
  if (best.some((j) => j.contactS! * 1000 > plausible.contactTimeMs.max)) warnings.push("Algún contacto es muy largo: revisa las marcas.");
  return {
    jumps,
    best5: best.map((j) => j.index),
    rsiBest5: best.length === 5 ? mean(best.map((j) => j.rsi!)) : null,
    heightBest5M: best.length === 5 ? mean(best.map((j) => j.heightM)) : null,
    contactBest5S: best.length === 5 ? mean(best.map((j) => j.contactS!)) : null,
    warnings,
  };
}
