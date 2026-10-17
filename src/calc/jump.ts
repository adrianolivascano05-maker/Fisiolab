// Fórmulas de salto. Todas son ciencia publicada (ver replica/architecture.md, tabla de fórmulas).
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
 * Rangos fuera de los cuales un resultado probablemente viene de una marca mal puesta
 * o de unos fps mal indicados. No bloquean: solo avisan.
 */
export const plausible = {
  heightCm: { min: 3, max: 80 },
  contactTimeMs: { min: 80, max: 900 },
};
