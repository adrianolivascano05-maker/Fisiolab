// «Vuelve de viaje y no tiene cita»: los pacientes en tratamiento (vinieron en los dos meses antes de irse y no tienen
// todos sus motivos de consulta dados de alta) que vuelven de un viaje apuntado en su calendario
// (src/data/patientEvents.ts), sin haber venido desde que se fueron (una cita atendida o una sesión) ni tener una cita
// pendiente desde el día que vuelven. Las citas que se quedaron dentro del viaje («No vino», o pendientes sin tocar) no
// cuentan.
// Salen desde dos días antes de volver hasta una semana después en Agenda › Hoy › Pendiente y, con el permiso de
// contacto firmado, a partir del día que vuelve, en la bandeja de envíos (outbox.ts) para escribirle. En cuanto tiene
// una cita (o una sesión), deja de salir.
import { addDays } from "../app/dates";
import type { Db } from "../data/db";

export type BackFromTrip = {
  patientId: string;
  name: string;
  phone: string;
  email: string;
  /** La columna `privacy` del paciente, tal cual (su permiso de contacto). */
  privacy: string | null;
  /** El viaje. */
  eventId: string;
  title: string;
  /** El día que vuelve (el siguiente al último día del viaje). */
  back: string;
};

/** Desde cuántos días antes de volver sale, y hasta cuántos después. */
export const BACK_BEFORE = 2;
export const BACK_AFTER = 6;
/** «En tratamiento»: vino (una cita no anulada o una sesión) en estos días antes de irse. */
export const ACTIVE_DAYS = 60;

/** Los que vuelven de viaje sin cita, alrededor de `today` (AAAA-MM-DD de Madrid): uno por paciente, su última vuelta. */
export async function backFromTrip(db: Db, today: string): Promise<BackFromTrip[]> {
  const rows = await db.query<BackFromTrip>(
    `select e.id as eventId, e.title, e.patient_id as patientId, p.name, coalesce(p.phone, '') as phone, coalesce(p.email, '') as email,
            p.privacy, date(coalesce(e.ends_on, e.starts_on), '+1 day') as back
       from patient_events e join patients p on p.id = e.patient_id
      where e.kind = 'travel' and e.repeat_days = ''
        and coalesce(e.ends_on, e.starts_on) between ? and ?
        and not exists (select 1 from appointments a where a.patient_id = e.patient_id
                         and ((a.status = 'done' and a.starts_at >= e.starts_on)
                           or (a.status = 'scheduled' and a.starts_at >= date(coalesce(e.ends_on, e.starts_on), '+1 day'))))
        and not exists (select 1 from sessions s where s.patient_id = e.patient_id and s.performed_at >= e.starts_on)
        and not (exists (select 1 from episodes ep where ep.patient_id = e.patient_id)
                 and not exists (select 1 from episodes ep where ep.patient_id = e.patient_id and ep.closed_at is null))
        and (exists (select 1 from appointments a where a.patient_id = e.patient_id and a.status <> 'cancelled'
                      and a.starts_at >= date(e.starts_on, '-${ACTIVE_DAYS} days') and a.starts_at < e.starts_on)
          or exists (select 1 from sessions s where s.patient_id = e.patient_id
                      and s.performed_at >= date(e.starts_on, '-${ACTIVE_DAYS} days') and s.performed_at < e.starts_on))
      order by back desc, p.name`,
    [addDays(today, -BACK_AFTER - 1), addDays(today, BACK_BEFORE - 1)],
  );
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.patientId) && !!seen.add(r.patientId));
}

/** «Vuelve el jueves 12 de noviembre», «Vuelve hoy» o «Volvió el lunes 9 de noviembre». */
export function backText(back: string, today: string): string {
  if (back === today) return "Vuelve hoy";
  const day = new Date(`${back}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return back > today ? `Vuelve el ${day}` : `Volvió el ${day}`;
}
