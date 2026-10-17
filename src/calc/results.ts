import { dynamicReboundIndex, heightFromFlightTime, plausible, reactiveStrengthIndex, samozino, verticalStiffness } from "./jump";
import { computeRepeated } from "./repeated";
import { intervalS } from "./video";

export type JumpType = "cmj" | "cmj_arms" | "sj" | "dj" | "single_leg" | "rj_10_5" | "horizontal";
export type MarkEvent = "movement_start" | "contact" | "takeoff" | "landing" | "bar_start" | "bar_end";

export type Metric =
  | "jump_height_cm"
  | "flight_time_ms"
  | "contact_time_ms"
  | "time_to_takeoff_ms"
  | "rsi"
  | "rsi_mod"
  | "stiffness_kn_m"
  | "dri"
  | "force_n"
  | "velocity_m_s"
  | "power_w"
  | "relative_power_w_kg"
  | "jump_distance_cm";

/** `seriesIndex` 0 es el resultado del test; 1, 2… los de cada salto de una serie (10/5). */
export type ComputedResult = { metric: Metric; value: number; unit: string; seriesIndex?: number };

/** Una marca en el vídeo. En los saltos repetidos, `seriesIndex` dice de qué salto es (0, 1, 2…). */
export type MarkInput = { event: MarkEvent; frame: number; seriesIndex: number };

export type JumpInput = {
  type: JumpType;
  captureFps: number;
  marks: MarkInput[];
  bodyMassKg: number | null;
  extraLoadKg: number;
  pushOffDistanceCm: number | null;
  dropHeightCm: number | null;
};

export type JumpOutput = { results: ComputedResult[]; warnings: string[]; missing: MarkEvent[] };

/** Tipos que se miden con vídeo y una sola fase de vuelo. */
const singleJump: JumpType[] = ["cmj", "cmj_arms", "sj", "dj", "single_leg"];

export function isSeries(type: JumpType) {
  return type === "rj_10_5";
}

export function needsVideo(type: JumpType) {
  return type !== "horizontal";
}

/** Marcas necesarias para cada tipo de salto, en el orden en que ocurren. */
export function requiredMarks(type: JumpType): MarkEvent[] {
  if (type === "dj") return ["contact", "takeoff", "landing"];
  return ["takeoff", "landing"];
}

/** Marcas opcionales: el inicio del movimiento en el CMJ permite el RSI modificado. */
export function optionalMarks(type: JumpType): MarkEvent[] {
  return type === "cmj" || type === "cmj_arms" ? ["movement_start"] : [];
}

/** Samozino supone un empuje con las dos piernas y sin balanceo de brazos. */
function samozinoApplies(type: JumpType) {
  return type === "cmj" || type === "sj";
}

/** Calcula todo lo que permiten las marcas y los datos del paciente. */
export function computeJump(input: JumpInput): JumpOutput {
  if (isSeries(input.type)) return computeSeries(input);
  if (!singleJump.includes(input.type)) return { results: [], warnings: [], missing: [] };

  const at = (e: MarkEvent) => input.marks.find((m) => m.event === e && m.seriesIndex === 0)?.frame;
  const missing = requiredMarks(input.type).filter((e) => at(e) === undefined);
  if (missing.length) return { results: [], warnings: [], missing };

  const takeoff = at("takeoff")!;
  const landing = at("landing")!;
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

  const start = at("movement_start");
  if (start !== undefined && start < takeoff) {
    const tttS = intervalS(start, takeoff, input.captureFps);
    results.push(
      { metric: "time_to_takeoff_ms", value: tttS * 1000, unit: "ms" },
      { metric: "rsi_mod", value: heightM / tttS, unit: "" },
    );
  }

  if (input.type === "dj") {
    const contactS = intervalS(at("contact")!, takeoff, input.captureFps);
    results.push(
      { metric: "contact_time_ms", value: contactS * 1000, unit: "ms" },
      { metric: "rsi", value: reactiveStrengthIndex(heightM, contactS), unit: "" },
    );
    if (input.dropHeightCm) results.push({ metric: "dri", value: dynamicReboundIndex(input.dropHeightCm / 100, heightM, contactS), unit: "" });
    if (input.bodyMassKg) {
      results.push({ metric: "stiffness_kn_m", value: verticalStiffness(input.bodyMassKg, contactS, flightS) / 1000, unit: "kN/m" });
    }
    const ms = contactS * 1000;
    if (ms < plausible.contactTimeMs.min || ms > plausible.contactTimeMs.max) {
      warnings.push("Tiempo de contacto poco habitual: revisa la marca de contacto.");
    }
  }

  if (samozinoApplies(input.type) && input.bodyMassKg && input.pushOffDistanceCm) {
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

function computeSeries(input: JumpInput): JumpOutput {
  const frames = (e: MarkEvent) =>
    input.marks
      .filter((m) => m.event === e)
      .sort((a, b) => a.seriesIndex - b.seriesIndex)
      .map((m) => m.frame);
  const takeoffs = frames("takeoff");
  const landings = frames("landing");
  const n = Math.min(takeoffs.length, landings.length);
  if (n === 0) return { results: [], warnings: [], missing: ["takeoff", "landing"] };
  const out = computeRepeated(takeoffs.slice(0, n), landings.slice(0, n), input.captureFps);
  const results: ComputedResult[] = [];
  for (const j of out.jumps) {
    results.push(
      { metric: "jump_height_cm", value: j.heightM * 100, unit: "cm", seriesIndex: j.index },
      { metric: "flight_time_ms", value: j.flightS * 1000, unit: "ms", seriesIndex: j.index },
    );
    if (j.contactS !== null) {
      results.push(
        { metric: "contact_time_ms", value: j.contactS * 1000, unit: "ms", seriesIndex: j.index },
        { metric: "rsi", value: j.rsi!, unit: "", seriesIndex: j.index },
      );
    }
  }
  if (out.rsiBest5 !== null) {
    results.push(
      { metric: "rsi", value: out.rsiBest5, unit: "", seriesIndex: 0 },
      { metric: "jump_height_cm", value: out.heightBest5M! * 100, unit: "cm", seriesIndex: 0 },
      { metric: "contact_time_ms", value: out.contactBest5S! * 1000, unit: "ms", seriesIndex: 0 },
    );
  }
  return { results, warnings: out.warnings, missing: [] };
}

/** Convierte las marcas de un salto simple ({ despegue: 100, … }) al formato general. */
export function marksFromFrames(frames: Partial<Record<MarkEvent, number>>): MarkInput[] {
  return Object.entries(frames)
    .filter(([, f]) => f !== undefined)
    .map(([event, frame]) => ({ event: event as MarkEvent, frame: frame!, seriesIndex: 0 }));
}
