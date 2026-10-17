import { heightFromFlightTime, plausible, reactiveStrengthIndex, samozino } from "./jump";
import { intervalS } from "./video";

export type JumpType = "cmj" | "sj" | "dj";
export type MarkEvent = "contact" | "takeoff" | "landing";

export type Metric =
  | "jump_height_cm"
  | "flight_time_ms"
  | "contact_time_ms"
  | "rsi"
  | "force_n"
  | "velocity_m_s"
  | "power_w"
  | "relative_power_w_kg";

export type ComputedResult = { metric: Metric; value: number; unit: string };

export type JumpInput = {
  type: JumpType;
  captureFps: number;
  /** Fotograma de cada evento marcado. */
  frames: Partial<Record<MarkEvent, number>>;
  bodyMassKg: number | null;
  extraLoadKg: number;
  pushOffDistanceCm: number | null;
};

export type JumpOutput = { results: ComputedResult[]; warnings: string[]; missing: MarkEvent[] };

/** Marcas necesarias para cada tipo de salto, en el orden en que ocurren. */
export function requiredMarks(type: JumpType): MarkEvent[] {
  return type === "dj" ? ["contact", "takeoff", "landing"] : ["takeoff", "landing"];
}

/** Calcula todos los resultados que permiten las marcas y los datos del paciente. */
export function computeJump(input: JumpInput): JumpOutput {
  const missing = requiredMarks(input.type).filter((e) => input.frames[e] === undefined);
  if (missing.length) return { results: [], warnings: [], missing };

  const { takeoff, landing, contact } = input.frames as Record<MarkEvent, number>;
  const flightS = intervalS(takeoff, landing, input.captureFps);
  const heightM = heightFromFlightTime(flightS);
  const results: ComputedResult[] = [
    { metric: "jump_height_cm", value: heightM * 100, unit: "cm" },
    { metric: "flight_time_ms", value: flightS * 1000, unit: "ms" },
  ];
  const warnings: string[] = [];
  const cm = heightM * 100;
  if (cm < plausible.heightCm.min || cm > plausible.heightCm.max) {
    warnings.push("Altura poco habitual: revisa las marcas y los fps de grabación.");
  }

  if (input.type === "dj") {
    const contactS = intervalS(contact, takeoff, input.captureFps);
    results.push({ metric: "contact_time_ms", value: contactS * 1000, unit: "ms" });
    results.push({ metric: "rsi", value: reactiveStrengthIndex(heightM, contactS), unit: "" });
    const ms = contactS * 1000;
    if (ms < plausible.contactTimeMs.min || ms > plausible.contactTimeMs.max) {
      warnings.push("Tiempo de contacto poco habitual: revisa la marca de contacto.");
    }
  }

  // Fuerza, velocidad y potencia (Samozino) solo para saltos sin caída previa y con los datos del paciente.
  if (input.type !== "dj" && input.bodyMassKg && input.pushOffDistanceCm) {
    const massKg = input.bodyMassKg + input.extraLoadKg;
    const f = samozino({ massKg, heightM, pushOffDistanceM: input.pushOffDistanceCm / 100 });
    results.push(
      { metric: "force_n", value: f.forceN, unit: "N" },
      { metric: "velocity_m_s", value: f.velocityMS, unit: "m/s" },
      { metric: "power_w", value: f.powerW, unit: "W" },
      { metric: "relative_power_w_kg", value: f.powerW / input.bodyMassKg, unit: "W/kg" },
    );
  }

  return { results, warnings, missing: [] };
}
