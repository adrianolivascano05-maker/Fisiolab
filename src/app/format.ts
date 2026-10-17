import type { JumpType } from "../calc/results";

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
  sj: { short: "SJ", long: "SJ (desde sentadilla)" },
  dj: { short: "Drop jump", long: "Drop jump (desde un cajón)" },
};

export function testLabel(type: string): string {
  return type in jumpLabels ? jumpLabels[type as JumpType].short : type;
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
};
