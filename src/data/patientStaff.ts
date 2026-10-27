// Los fisios que llevan a cada paciente (migración 034): uno o varios del equipo, elegidos en su ficha
// (src/clinical/PatientPhysios.tsx). Mismo estilo que repo.ts: las pantallas no escriben SQL.
import type { Db } from "./db";

const clean = (email: string) => email.trim().toLowerCase();
/** La fila de un fisio en un paciente: la misma en todos los dispositivos (asignarlo dos veces no la duplica). */
const rowId = (patientId: string, email: string) => `${patientId}|${clean(email)}`;

/** Los correos de los fisios que lo llevan, por orden. */
export async function patientPhysios(db: Db, patientId: string): Promise<string[]> {
  const rows = await db.query<{ staff_email: string }>("select staff_email from patient_staff where patient_id = ? order by staff_email", [patientId]);
  return rows.map((r) => r.staff_email);
}

/** Deja exactamente estos fisios: añade los nuevos y quita los que ya no están (los que siguen no se tocan). */
export async function setPatientPhysios(db: Db, patientId: string, emails: string[]): Promise<void> {
  const want = [...new Set(emails.map(clean).filter(Boolean))];
  const now = new Date().toISOString();
  await db.transaction([
    {
      sql: `delete from patient_staff where patient_id = ? and staff_email not in (select value from json_each(?))`,
      bind: [patientId, JSON.stringify(want)],
    },
    ...want.map((email) => ({
      sql: "insert into patient_staff (id, patient_id, staff_email, created_at, updated_at) values (?, ?, ?, ?, ?) on conflict (id) do nothing",
      bind: [rowId(patientId, email), patientId, email, now, now],
    })),
  ]);
}

/** Cuántas citas (no anuladas) tiene con cada fisio: para proponer a quién asignarlo. */
export async function appointmentsByPhysio(db: Db, patientId: string): Promise<Map<string, number>> {
  const rows = await db.query<{ email: string; n: number }>(
    "select assigned_to as email, count(*) as n from appointments where patient_id = ? and assigned_to is not null and status <> 'cancelled' group by assigned_to",
    [patientId],
  );
  return new Map(rows.map((r) => [r.email, Number(r.n)]));
}
