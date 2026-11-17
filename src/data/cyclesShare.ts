// «Enviar la semana al paciente» (docs/ciclos.md, fase B): una página de solo lectura por enlace cifrado, con el mismo
// mecanismo que los formularios (la clave va después de «#» y el servidor solo guarda bytes ilegibles). Lleva sus
// ejercicios de esa semana con lo que el fisio marque (los kilos y el esfuerzo, solo si los marca), «Cómo se hace» de
// cada uno si el fisio lo ha escrito, sus próximas citas y, si se marca, la línea de fases con «estás aquí» y el
// objetivo general. Caduca al acabar la semana (el domingo a medianoche, hora de Madrid).
//
// Solo copia lo que el fisio ya ha escrito en el plan: no añade nada ni lo cambia.
import { addDays, dayOf } from "../app/dates";
import { doseText, kgOfPct, LIMITS, phaseAt, sentKey, weekDays, type Dose, type LoadedPlan } from "./cycles";
import type { Db } from "./db";

/** Lo que se marca al enviarla. */
export type ShareOptions = {
  /** Los kilos (y el % del 1RM pasado a kilos, si tiene 1RM). */
  kg: boolean;
  /** El esfuerzo (RPE o RIR), como esté en el plan. */
  effort: boolean;
  /** La línea de fases con «estás aquí» y el objetivo general. */
  plan: boolean;
};

export type SharedItem = { name: string; dose: string; how?: string };
/** Lo que va cifrado en el enlace (FormRequest.week). */
export type WeekShare = {
  v: 1;
  /** Primer y último día de la semana (AAAA-MM-DD). */
  from: string;
  to: string;
  /** Sesiones por semana. */
  perWeek: number;
  /** Las sesiones tipo de esa semana: con su letra solo si hay más de una. */
  sessions: { label: string | null; items: SharedItem[] }[];
  /** El fisio la ha marcado como semana de valoración. */
  assess?: boolean;
  /** Solo si el fisio lo marca: el objetivo general, los nombres de las fases y dónde está. */
  plan?: { goal: string; phases: string[]; at: number; week: number; weeks: number };
};

/** Lo de una casilla que se le enseña: sin kilos ni esfuerzo si no se marcan. */
export function patientDose(d: Dose, oneRm: number | null, opts: Pick<ShareOptions, "kg" | "effort">): Dose {
  const out: Dose = { ...d };
  if (!opts.effort) delete out.effort;
  if (opts.kg && out.pct !== undefined && !(out.kg && out.kg > 0)) {
    const kg = kgOfPct(oneRm, out.pct);
    if (kg !== null) {
      out.kg = kg;
      delete out.pct;
    }
  }
  if (!opts.kg) {
    delete out.kg;
    delete out.pct;
  }
  return out;
}

/** La semana `week` del plan (desde 0) para el paciente; null si cae fuera del plan o esa fase aún no tiene ejercicios. */
export function weekShare(loaded: LoadedPlan, week: number, opts: ShareOptions): WeekShare | null {
  const { plan, phases } = loaded;
  const at = phaseAt(plan, week);
  if (!at) return null;
  const ref = plan.phases[at.index]!;
  const doc = phases[ref.id];
  const cells = doc?.weeks[at.week] ?? {};
  const effort = opts.effort ? plan.effort : "none";
  const tpls = (doc?.sessions ?? []).filter((s) => s.exercises.some((e) => e.name.trim()));
  if (!tpls.length) return null;
  const [from, to] = weekDays(plan, week);
  return {
    v: 1,
    from,
    to,
    perWeek: plan.perWeek,
    ...(doc?.assess?.includes(at.week) ? { assess: true } : {}),
    sessions: tpls.map((s) => ({
      label: tpls.length > 1 ? s.label : null,
      items: s.exercises
        .filter((e) => e.name.trim())
        .map((e) => {
          const dose = doseText(patientDose(cells[s.id]?.[e.id] ?? {}, e.oneRm, opts), effort, e.timeUnit);
          return { name: e.name.trim(), dose, ...(e.how?.trim() ? { how: e.how.trim() } : {}) };
        }),
    })),
    ...(opts.plan ? { plan: { goal: plan.goal.trim(), phases: plan.phases.map((p) => p.name), at: at.index, week: at.week, weeks: at.weeks } } : {}),
  };
}

/** Cuándo acaba la semana de `day`: el lunes siguiente a las 0:00 en Madrid (con horario de verano o sin él). */
export function weekEnd(day: string): string {
  const monday = addDays(day, 7 - ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const utc = Date.parse(`${monday}T00:00:00Z`);
  // Madrid va 1 o 2 horas por delante: la primera de las dos que ya es lunes allí.
  const t = [utc - 2 * 3_600_000, utc - 3_600_000].find((x) => dayOf(new Date(x)) === monday) ?? utc;
  return new Date(t).toISOString();
}

// ---------- Los enlaces mandados ----------

/** Un enlace mandado: para volver a copiarlo o anularlo. `week`: la semana del plan, desde 0. */
export type SentWeek = { id: string; key: string; week: number; sentAt: string; expiresAt: string; cancelledAt?: string };

export async function loadSent(db: Db, patientId: string, episodeId: string): Promise<SentWeek[]> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [sentKey(patientId, episodeId)]);
  const list = row ? (JSON.parse(row.value) as unknown) : [];
  return Array.isArray(list) ? (list as SentWeek[]).filter((x) => x && typeof x.id === "string" && typeof x.key === "string") : [];
}

async function saveSent(db: Db, patientId: string, episodeId: string, list: SentWeek[]): Promise<void> {
  await db.transaction([
    {
      sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
      bind: [sentKey(patientId, episodeId), JSON.stringify(list)],
    },
  ]);
}

/** Apunta un enlace mandado (los más recientes primero; se guardan los {@link LIMITS.sent} últimos). */
export async function addSent(db: Db, patientId: string, episodeId: string, sent: SentWeek): Promise<void> {
  const list = await loadSent(db, patientId, episodeId);
  await saveSent(db, patientId, episodeId, [sent, ...list.filter((x) => x.id !== sent.id)].slice(0, LIMITS.sent));
}

/** Marca un enlace como anulado (se quita del servidor aparte). */
export async function cancelSent(db: Db, patientId: string, episodeId: string, id: string, at = new Date().toISOString()): Promise<void> {
  const list = await loadSent(db, patientId, episodeId);
  await saveSent(db, patientId, episodeId, list.map((x) => (x.id === id ? { ...x, cancelledAt: at } : x)));
}

/** Si un enlace aún vale (ni caducado ni anulado). */
export const sentAlive = (s: SentWeek, now = Date.now()) => !s.cancelledAt && Date.parse(s.expiresAt) > now;
