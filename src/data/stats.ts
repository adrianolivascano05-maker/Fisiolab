// La clínica en números (src/pages/StatsPage.tsx): sesiones, pacientes nuevos y atendidos, citas y ausencias, altas y,
// en un equipo, cada profesional. Todo sale de lo registrado en la base del dispositivo; nada se envía a ningún sitio.
import type { Db } from "./db";

export type Period = { from: string; to: string };

export type ClinicStats = {
  sessions: number;
  /** Pacientes con alguna sesión en el periodo. */
  patientsSeen: number;
  newPatients: number;
  appointments: { done: number; noShow: number; cancelled: number; scheduled: number };
  /** Ausencias sobre las citas que ya tocaban (atendidas + no vino), de 0 a 1; null sin citas. */
  noShowRate: number | null;
  /** Motivos de consulta terminados (altas). */
  discharges: number;
  /** Por persona del equipo (citas con quién son); vacío sin equipo. */
  byPerson: { email: string | null; done: number; noShow: number; cancelled: number }[];
  /** Sesiones por mes, de los 12 meses que acaban en el periodo (AAAA-MM). */
  monthly: { month: string; sessions: number }[];
};

const one = async (db: Db, sql: string, bind: (string | number)[]) => Number((await db.query<{ n: number }>(sql, bind))[0]?.n ?? 0);

/** Los primeros días de `count` meses seguidos que acaban en el mes de `end` (AAAA-MM-01, hora local). */
export function monthStarts(end: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1));
}

export async function clinicStats(db: Db, p: Period): Promise<ClinicStats> {
  const sessions = await one(db, "select count(*) as n from sessions where performed_at >= ? and performed_at < ?", [p.from, p.to]);
  const patientsSeen = await one(db, "select count(distinct patient_id) as n from sessions where performed_at >= ? and performed_at < ?", [p.from, p.to]);
  const newPatients = await one(db, "select count(*) as n from patients where created_at >= ? and created_at < ?", [p.from, p.to]);
  const discharges = await one(db, "select count(*) as n from episodes where closed_at >= ? and closed_at < ?", [p.from, p.to]);
  const rows = await db.query<{ status: string; assigned_to: string | null; n: number }>(
    "select status, assigned_to, count(*) as n from appointments where starts_at >= ? and starts_at < ? group by status, assigned_to",
    [p.from, p.to],
  );
  const appointments = { done: 0, noShow: 0, cancelled: 0, scheduled: 0 };
  const people = new Map<string | null, { email: string | null; done: number; noShow: number; cancelled: number }>();
  for (const r of rows) {
    const key = r.status === "no_show" ? "noShow" : (r.status as "done" | "cancelled" | "scheduled");
    appointments[key] += r.n;
    const person = people.get(r.assigned_to) ?? { email: r.assigned_to, done: 0, noShow: 0, cancelled: 0 };
    if (key !== "scheduled") person[key] += r.n;
    people.set(r.assigned_to, person);
  }
  const due = appointments.done + appointments.noShow;
  const end = new Date(new Date(p.to).getTime() - 1);
  const months = monthStarts(end, 12);
  const monthly: ClinicStats["monthly"] = [];
  for (let i = 0; i < months.length; i++) {
    const from = months[i]!;
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    monthly.push({
      month: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`,
      sessions: await one(db, "select count(*) as n from sessions where performed_at >= ? and performed_at < ?", [from.toISOString(), to.toISOString()]),
    });
  }
  return {
    sessions,
    patientsSeen,
    newPatients,
    appointments,
    noShowRate: due ? appointments.noShow / due : null,
    discharges,
    byPerson: [...people.values()].filter((x) => x.done + x.noShow + x.cancelled > 0).sort((a, b) => b.done - a.done),
    monthly,
  };
}
