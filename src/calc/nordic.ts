// Nórdico de isquios (S20): ángulo de rotura y momento de fuerza estimado en la rodilla.
// Funciones puras; las prueba nordic.test.ts.
//
// Modelo (propio, por validar): el nórdico es casi estático, así que en la rotura el momento que
// hacen los isquios iguala al de la gravedad sobre todo lo que queda por encima de las rodillas:
//   M = m · g · d · sen(θ)
// θ: inclinación de la línea rodilla-cadera respecto a la vertical (0° de rodillas, erguido).
// m: masa por encima de las rodillas = masa · (1 − 2 · (pierna 0,0465 + pie 0,0145)) = 0,878 · masa.
// d: distancia de la rodilla a su centro de masas, 0,322 · estatura, de las proporciones
//    antropométricas habituales (rodilla a 0,285·H, centro de masas del cuerpo a ~0,55·H).
// El momento se reparte entre las dos piernas.
import type { PhotoSpec } from "./rom";
import { G } from "./jump";

export const ABOVE_KNEE_MASS = 1 - 2 * (0.0465 + 0.0145);
const KNEE_TO_COM_HEIGHT = 0.322;

/** Marcado sobre el fotograma de la rotura: de la rodilla a la cadera, respecto a la vertical. */
export const nordicPhoto: PhotoSpec = {
  kind: "vertical",
  points: ["Rodilla", "Cadera"],
  note: "Con el móvil recto y de lado.",
};

export type NordicTorque = { totalNm: number; perLegNm: number; perLegNmKg: number };

export function nordicTorque(bodyMassKg: number, heightCm: number, angleDeg: number): NordicTorque {
  if (!(bodyMassKg > 0) || !(heightCm > 0)) throw new RangeError("Hacen falta la masa y la estatura");
  if (!(angleDeg >= 0 && angleDeg <= 90)) throw new RangeError("El ángulo debe estar entre 0 y 90°");
  const totalNm = ABOVE_KNEE_MASS * bodyMassKg * G * KNEE_TO_COM_HEIGHT * (heightCm / 100) * Math.sin((angleDeg * Math.PI) / 180);
  return { totalNm, perLegNm: totalNm / 2, perLegNmKg: totalNm / 2 / bodyMassKg };
}

/** Rango plausible del ángulo de rotura: fuera de él se avisa. */
export const plausibleNordic = { angleDeg: { min: 10, max: 85 } };
