// Mecánica de carrera (S18): contactos y despegues marcados en el vídeo, apoyo tras apoyo.
// Funciones puras; las prueba running.test.ts.

export type Step = { side: "left" | "right"; contactS: number; flightS: number | null; stepS: number | null };

export type RunningSummary = {
  steps: Step[];
  contactS: number;
  flightS: number | null;
  /** Pasos por minuto. */
  frequencySpm: number | null;
  /** Fracción de la zancada en contacto: contacto / (2 · tiempo de paso). */
  dutyFactor: number | null;
  /** Solo con la velocidad de la cinta. */
  stepLengthM: number | null;
  left: number | null;
  right: number | null;
  /** (más largo − más corto) / más largo · 100 en el contacto medio de cada pierna. */
  asymmetryPct: number | null;
};

export const MIN_STEPS = 4;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * `contacts` y `takeoffs` en segundos, alternos: contacto 1, despegue 1, contacto 2…
 * El paso i va del contacto i al contacto i+1; los lados alternan desde `firstSide`.
 */
export function summarizeRunning(contacts: number[], takeoffs: number[], firstSide: "left" | "right", speedKmh: number | null = null): RunningSummary {
  const n = Math.min(contacts.length, takeoffs.length);
  if (n < MIN_STEPS) throw new RangeError(`Hacen falta al menos ${MIN_STEPS} apoyos`);
  const steps: Step[] = [];
  for (let i = 0; i < n; i++) {
    if (!(takeoffs[i]! > contacts[i]!)) throw new RangeError("Cada despegue debe ir después de su contacto");
    const next = contacts[i + 1];
    steps.push({
      side: i % 2 === 0 ? firstSide : firstSide === "left" ? "right" : "left",
      contactS: takeoffs[i]! - contacts[i]!,
      flightS: next !== undefined ? next - takeoffs[i]! : null,
      stepS: next !== undefined ? next - contacts[i]! : null,
    });
  }
  const contactS = mean(steps.map((s) => s.contactS))!;
  const flights = steps.flatMap((s) => (s.flightS === null ? [] : [s.flightS]));
  const stepTimes = steps.flatMap((s) => (s.stepS === null ? [] : [s.stepS]));
  const stepS = mean(stepTimes);
  const left = mean(steps.filter((s) => s.side === "left").map((s) => s.contactS));
  const right = mean(steps.filter((s) => s.side === "right").map((s) => s.contactS));
  return {
    steps,
    contactS,
    flightS: mean(flights),
    frequencySpm: stepS ? 60 / stepS : null,
    dutyFactor: stepS ? contactS / (2 * stepS) : null,
    stepLengthM: stepS && speedKmh ? (speedKmh / 3.6) * stepS : null,
    left,
    right,
    asymmetryPct: left && right ? ((Math.max(left, right) - Math.min(left, right)) / Math.max(left, right)) * 100 : null,
  };
}
