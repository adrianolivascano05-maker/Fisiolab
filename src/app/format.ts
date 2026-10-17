import type { JumpType } from "../calc/results";
import { getMovement, isRomType, jointLabels, movementLabel, type RomJoint } from "../calc/rom";
import { getExercise } from "../calc/strength";

const nf = (digits: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmt(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : nf(digits).format(n);
}

/** "62,5" o "62.5" → 62.5; vacío → null; texto no numérico → NaN. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

export function decimalText(n: number | null): string {
  return n === null ? "" : String(n).replace(".", ",");
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });
}

/** "14/10/26": para tablas estrechas. */
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Madrid" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

export const jumpLabels: Record<JumpType, { short: string; long: string }> = {
  cmj: { short: "CMJ", long: "CMJ (con contramovimiento)" },
  cmj_arms: { short: "CMJ brazos", long: "CMJ con brazos libres" },
  sj: { short: "SJ", long: "SJ (desde sentadilla)" },
  dj: { short: "Drop jump", long: "Drop jump (desde un cajón)" },
  single_leg: { short: "Unipodal", long: "CMJ a una pierna" },
  rj_10_5: { short: "10/5", long: "Saltos repetidos 10/5" },
  horizontal: { short: "Horizontal", long: "Salto horizontal a pies juntos" },
};

export const sideLabels = { left: "izquierda", right: "derecha" } as const;

export function isJumpType(type: string): type is JumpType {
  return type in jumpLabels;
}

/** Nombre corto de un test: "CMJ", "Movilidad · cadera"... */
export function testLabel(type: string): string {
  if (isJumpType(type)) return jumpLabels[type].short;
  if (isRomType(type)) return `Movilidad · ${jointLabels[type.slice(4) as RomJoint].toLowerCase()}`;
  if (type === "vbt") return "Fuerza";
  return type;
}

/** Nombre de una medición concreta, con su movimiento y lado si los tiene. */
export function testTitle(t: { type: string; side: "left" | "right" | null; movement?: string | null; exercise?: string | null; extraLoadKg?: number }): string {
  const m = t.movement ? getMovement(t.movement) : undefined;
  if (m) return movementLabel(m, t.side);
  const e = t.exercise ? getExercise(t.exercise) : undefined;
  if (e) return `${e.label} · ${fmt(t.extraLoadKg ?? 0, (t.extraLoadKg ?? 0) % 1 ? 1 : 0)} kg`;
  return `${testLabel(t.type)}${t.side ? ` ${sideLabels[t.side]}` : ""}`;
}

export const metricLabels: Record<string, { label: string; digits: number }> = {
  jump_height_cm: { label: "Altura del salto", digits: 1 },
  flight_time_ms: { label: "Tiempo de vuelo", digits: 0 },
  contact_time_ms: { label: "Tiempo de contacto", digits: 0 },
  rsi: { label: "RSI", digits: 2 },
  force_n: { label: "Fuerza media", digits: 0 },
  velocity_m_s: { label: "Velocidad media", digits: 2 },
  power_w: { label: "Potencia media", digits: 0 },
  relative_power_w_kg: { label: "Potencia relativa", digits: 1 },
  time_to_takeoff_ms: { label: "Tiempo hasta el despegue", digits: 0 },
  rsi_mod: { label: "RSI modificado", digits: 2 },
  stiffness_kn_m: { label: "Rigidez vertical", digits: 1 },
  dri: { label: "DRI", digits: 2 },
  jump_distance_cm: { label: "Distancia", digits: 0 },
  angle_deg: { label: "Ángulo", digits: 0 },
  bar_velocity_m_s: { label: "Velocidad de la barra", digits: 2 },
  velocity_loss_pct: { label: "Pérdida de velocidad", digits: 0 },
  wall_distance_cm: { label: "Distancia a la pared", digits: 1 },
};
