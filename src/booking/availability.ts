// Huecos libres para la reserva online: el horario de la clínica (o los turnos de cada fisio) menos las citas que ya
// hay. Lo calcula la app y sube al servidor solo las franjas libres (de qué hora a qué hora y con quién), nunca las
// citas ni los pacientes. La página pública reparte cada franja en horas de inicio según lo que dura la cita.

/** «09:00»–«14:00»: una franja del horario semanal. */
export type Range = [string, string];
/** Día de la semana: 1 lunes … 7 domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WeeklyHours = Partial<Record<Weekday, Range[]>>;
/** Una franja libre, con quién (id público del fisio; «» si la clínica no deja elegir). */
export type Window = { pro: string; from: string; to: string };
/** Un rato ocupado o de trabajo, en instantes ISO. */
export type Span = { from: string; to: string };

export const DEFAULT_HOURS: WeeklyHours = {
  1: [["09:00", "14:00"], ["16:00", "20:00"]],
  2: [["09:00", "14:00"], ["16:00", "20:00"]],
  3: [["09:00", "14:00"], ["16:00", "20:00"]],
  4: [["09:00", "14:00"], ["16:00", "20:00"]],
  5: [["09:00", "14:00"]],
};

const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Un día y una hora de Madrid («2026-10-26», «09:30») como instante ISO, con su horario de verano o de invierno. */
export function madridIso(day: string, hm: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = hm.split(":").map(Number) as [number, number];
  const wanted = Date.UTC(y, m - 1, d, h, mi);
  let t = wanted;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(parts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    t += wanted - shown;
  }
  return new Date(t).toISOString();
}

/** El día de Madrid de un instante («2026-10-26»). */
export const madridDayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (day: string): Weekday => (((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1) as Weekday;

/** Quita a unas franjas los ratos ocupados. Todo en milisegundos. */
function subtract(free: [number, number][], busy: [number, number][]): [number, number][] {
  let out = free;
  for (const [b0, b1] of busy) {
    const next: [number, number][] = [];
    for (const [f0, f1] of out) {
      if (b1 <= f0 || b0 >= f1) next.push([f0, f1]);
      else {
        if (b0 > f0) next.push([f0, b0]);
        if (b1 < f1) next.push([b1, f1]);
      }
    }
    out = next;
  }
  return out;
}

export type AvailabilityInput = {
  now: string;
  /** Cuántos días hacia delante se puede reservar. */
  days: number;
  /** Con cuántas horas de antelación como mínimo. */
  minNoticeHours: number;
  hours: WeeklyHours;
  /**
   * Los fisios que salen en la reserva: id público, sus turnos (si tiene), sus citas y sus ratos con la agenda cerrada
   * (los suyos y los de toda la clínica). Sin equipo, uno con id «».
   */
  pros: { id: string; shifts: Span[]; busy: Span[]; closed?: Span[] }[];
};

const spans = (list: Span[]) => list.map((s): [number, number] => [Date.parse(s.from), Date.parse(s.to)]);
const toWindow = (pro: string, [a, b]: [number, number]): Window => ({ pro, from: new Date(a).toISOString(), to: new Date(b).toISOString() });

/**
 * Cuándo se puede reservar con cada fisio, sin quitar las citas: sus turnos (o, si no tiene ninguno, el horario de la
 * clínica) desde ahora más la antelación mínima hasta dentro de `days` días, sin los ratos con la agenda cerrada. Se
 * publica también, para que al anular una cita el servidor solo deje libre lo que está dentro.
 */
export function bookableSpans(input: AvailabilityInput): Window[] {
  const start = Date.parse(input.now) + input.minNoticeHours * 3_600_000;
  const today = madridDayOf(input.now);
  const last = addDay(today, input.days);
  const lastMs = Date.parse(madridIso(addDay(last, 1), "00:00"));
  const out: Window[] = [];
  for (const pro of input.pros) {
    // Con turnos en estas semanas, sus turnos; si no tiene ninguno, el horario de la clínica.
    const shifts = spans(pro.shifts).filter(([a, b]) => b > start && a < lastMs);
    let open: [number, number][] = [];
    if (shifts.length) open = shifts;
    else
      for (let day = today; day <= last; day = addDay(day, 1))
        for (const [a, b] of input.hours[weekdayOf(day)] ?? []) open.push([Date.parse(madridIso(day, a)), Date.parse(madridIso(day, b))]);
    open = open.map(([a, b]): [number, number] => [Math.max(a, start), Math.min(b, lastMs)]).filter(([a, b]) => b > a);
    for (const w of subtract(open, spans(pro.closed ?? [])).sort((x, y) => x[0] - y[0])) out.push(toWindow(pro.id, w));
  }
  return out;
}

/** Las franjas libres de cada fisio: cuándo se puede reservar con él (`bookableSpans`) menos las citas que ya tiene. */
export function freeWindows(input: AvailabilityInput): Window[] {
  const bookable = bookableSpans(input);
  const out: Window[] = [];
  for (const pro of input.pros) {
    const open = spans(bookable.filter((w) => w.pro === pro.id).map((w) => ({ from: w.from, to: w.to })));
    for (const w of subtract(open, spans(pro.busy)).sort((x, y) => x[0] - y[0])) out.push(toWindow(pro.id, w));
  }
  return out;
}

/**
 * Las horas a las que se puede empezar una cita de `minutes` minutos dentro de las franjas, cada `step` minutos en
 * punto (10:00, 10:15…). Si dos fisios están libres a la misma hora, sale una vez con el primero.
 */
export function startTimes(windows: Window[], minutes: number, step: number, notBefore: string, pro?: string): { at: string; pro: string }[] {
  const min = Date.parse(notBefore);
  const seen = new Map<string, string>();
  for (const w of windows) {
    if (pro !== undefined && pro !== "" && w.pro !== pro) continue;
    const from = Math.max(Date.parse(w.from), min);
    const to = Date.parse(w.to);
    const stepMs = step * 60_000;
    // Al minuto en punto del paso (las horas de Madrid van en horas enteras respecto a UTC).
    for (let t = Math.ceil(from / stepMs) * stepMs; t + minutes * 60_000 <= to; t += stepMs) {
      const at = new Date(t).toISOString();
      if (!seen.has(at)) seen.set(at, w.pro);
    }
  }
  return [...seen].sort((a, b) => a[0].localeCompare(b[0])).map(([at, p]) => ({ at, pro: p }));
}

/** Si una cita (inicio y minutos) cabe entera en alguna franja de ese fisio. */
export function fitsWindow(windows: Window[], pro: string, at: string, minutes: number): boolean {
  const a = Date.parse(at);
  const b = a + minutes * 60_000;
  return windows.some((w) => w.pro === pro && Date.parse(w.from) <= a && b <= Date.parse(w.to));
}
