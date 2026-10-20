// Fórmulas de salto. Todas son ciencia publicada (las referencias, junto a cada fórmula).
// Entradas y salidas en SI: segundos, metros, kilogramos, newtons, vatios.

export const G = 9.81;

/** Altura del salto a partir del tiempo de vuelo: h = g·t² / 8 (Bosco et al., 1983). */
export function heightFromFlightTime(flightTimeS: number): number {
  if (!(flightTimeS > 0)) throw new RangeError("El tiempo de vuelo debe ser mayor que cero");
  return (G * flightTimeS * flightTimeS) / 8;
}

/** Índice de fuerza reactiva del drop jump: altura (m) / tiempo de contacto (s). */
export function reactiveStrengthIndex(heightM: number, contactTimeS: number): number {
  if (!(contactTimeS > 0)) throw new RangeError("El tiempo de contacto debe ser mayor que cero");
  return heightM / contactTimeS;
}

export type SamozinoInput = {
  /** Masa del paciente más la carga extra, en kg. */
  massKg: number;
  heightM: number;
  /** Distancia de empuje (hpo), en metros. */
  pushOffDistanceM: number;
};

export type SamozinoOutput = { forceN: number; velocityMS: number; powerW: number };

/**
 * Fuerza, velocidad y potencia medias de la fase de empuje (Samozino et al., 2008):
 * F = m·g·(h/hpo + 1), v = √(g·h/2), P = F·v.
 */
export function samozino({ massKg, heightM, pushOffDistanceM }: SamozinoInput): SamozinoOutput {
  if (!(massKg > 0)) throw new RangeError("La masa debe ser mayor que cero");
  if (!(pushOffDistanceM > 0)) throw new RangeError("La distancia de empuje debe ser mayor que cero");
  if (!(heightM > 0)) throw new RangeError("La altura debe ser mayor que cero");
  const forceN = massKg * G * (heightM / pushOffDistanceM + 1);
  const velocityMS = Math.sqrt((G * heightM) / 2);
  return { forceN, velocityMS, powerW: forceN * velocityMS };
}

/**
 * Rigidez vertical a partir de los tiempos de contacto y vuelo (Dalleau et al., 2004), en N/m.
 * Supone que la fuerza durante el contacto sigue una onda seno:
 * k = m·π·(tv + tc) / (tc² · ((tv + tc)/π − tc/4)).
 */
export function verticalStiffness(massKg: number, contactTimeS: number, flightTimeS: number): number {
  if (!(massKg > 0) || !(contactTimeS > 0) || !(flightTimeS > 0)) throw new RangeError("Masa y tiempos deben ser mayores que cero");
  const total = flightTimeS + contactTimeS;
  return (massKg * Math.PI * total) / (contactTimeS * contactTimeS * (total / Math.PI - contactTimeS / 4));
}

/**
 * Dynamic Rebound Index (Brooks, 2026): (altura de caída + altura del salto) / (g · tc²). Sin unidades.
 * A diferencia del RSI, tiene en cuenta desde qué altura se cae.
 */
export function dynamicReboundIndex(dropHeightM: number, jumpHeightM: number, contactTimeS: number): number {
  if (!(contactTimeS > 0)) throw new RangeError("El tiempo de contacto debe ser mayor que cero");
  return (dropHeightM + jumpHeightM) / (G * contactTimeS * contactTimeS);
}

/**
 * Rangos fuera de los cuales un resultado probablemente viene de una marca mal puesta
 * o de unos fps mal indicados. No bloquean: solo avisan.
 */
export const plausible = {
  heightCm: { min: 3, max: 80 },
  contactTimeMs: { min: 80, max: 900 },
};
