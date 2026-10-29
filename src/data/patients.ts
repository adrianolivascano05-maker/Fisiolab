// Pacientes: la ficha (datos, buscar en memoria, crear, cambiar, borrar).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { fold, phoneDigits } from "../app/format";
import type { Db } from "./db";
import { parsePrivacy, type PatientPrivacy } from "./privacy";
import { newId, now } from "./ids";

export type Sex = "female" | "male" | "other";

export type PatientInput = {
  name: string;
  birthDate: string | null;
  sex: Sex | null;
  bodyMassKg: number | null;
  heightCm: number | null;
  legLengthCm: number | null;
  pushOffDistanceCm: number | null;
  notes: string;
  /** Contacto (vacío si no se sabe). */
  phone?: string;
  email?: string;
  address?: string;
  /** DNI o NIE (vacío si no se sabe): sale en justificantes y consentimientos. */
  dni?: string;
};

export type Patient = Required<PatientInput> & { id: string; createdAt: string; updatedAt: string; privacy: PatientPrivacy };

export type PatientSummary = {
  id: string;
  name: string;
  testCount: number;
  lastTestAt: string | null;
  lastTestType: string | null;
  /** La última vez que se le atendió o se le registró algo (sesión, medición, exploración, cuestionario…). */
  lastAt: string | null;
  /** Su próxima cita pendiente, si la hay. */
  nextAt: string | null;
  /** Lo que se puede buscar además del nombre: teléfono, email, motivos de consulta, diagnósticos y notas. */
  searchText: string;
  /** Para distinguir a dos con el mismo nombre al elegir. */
  phone: string;
};

/** ¿El paciente coincide con lo buscado? Sin tildes ni mayúsculas; un teléfono, con o sin espacios. */
export function matchesPatient(p: Pick<PatientSummary, "name" | "searchText">, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const text = fold(`${p.name} ${p.searchText}`);
  if (text.includes(q)) return true;
  const digits = phoneDigits(q);
  return digits !== null && text.replace(/\D/g, "").includes(digits);
}

type PatientRow = {
  id: string;
  name: string;
  birth_date: string | null;
  sex: Sex | null;
  body_mass_kg: number | null;
  height_cm: number | null;
  leg_length_cm: number | null;
  pushoff_distance_cm: number | null;
  notes: string;
  phone: string;
  email: string;
  address: string;
  dni: string;
  privacy: string;
  created_at: string;
  updated_at: string;
};

function toPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    name: r.name,
    birthDate: r.birth_date,
    sex: r.sex,
    bodyMassKg: r.body_mass_kg,
    heightCm: r.height_cm,
    legLengthCm: r.leg_length_cm,
    pushOffDistanceCm: r.pushoff_distance_cm,
    notes: r.notes,
    phone: r.phone,
    email: r.email,
    address: r.address,
    dni: r.dni ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    privacy: parsePrivacy(r.privacy),
  };
}

export async function listPatients(db: Db, search = "", now = new Date()): Promise<PatientSummary[]> {
  const rows = await db.query<PatientSummary>(
    `select p.id, p.name, coalesce(p.phone, '') as phone,
            (select count(*) from tests t where t.patient_id = p.id) as testCount,
            (select max(t.performed_at) from tests t where t.patient_id = p.id) as lastTestAt,
            (select t.type from tests t where t.patient_id = p.id order by t.performed_at desc limit 1) as lastTestType,
            (select max(at) from (
               select max(performed_at) as at from tests where patient_id = p.id
               union all select max(performed_at) from sessions where patient_id = p.id
               union all select max(performed_at) from findings where patient_id = p.id
               union all select max(performed_at) from questionnaires where patient_id = p.id
               union all select max(performed_at) from wellness where patient_id = p.id)) as lastAt,
            (select min(a.starts_at) from appointments a where a.patient_id = p.id and a.status = 'scheduled' and a.starts_at > ?) as nextAt,
            concat_ws(' ', p.phone, p.email, p.dni, p.notes,
              (select concat_ws(' ', a.answers ->> '$.motivo', a.answers ->> '$.diagnostico_funcional') from anamnesis a where a.patient_id = p.id),
              (select group_concat(concat_ws(' ', e.title, e.answers ->> '$.motivo', e.answers ->> '$.diagnostico_funcional'), ' ')
                 from episodes e where e.patient_id = p.id)) as searchText
       from patients p
      order by p.name collate nocase`,
    [now.toISOString()],
  );
  return rows.filter((r) => matchesPatient(r, search));
}

export async function getPatient(db: Db, id: string): Promise<Patient | null> {
  const rows = await db.query<PatientRow>("select * from patients where id = ?", [id]);
  return rows[0] ? toPatient(rows[0]) : null;
}

function patientBind(p: PatientInput) {
  return [
    p.name.trim(),
    p.birthDate,
    p.sex,
    p.bodyMassKg,
    p.heightCm,
    p.legLengthCm,
    p.pushOffDistanceCm,
    p.notes,
    (p.phone ?? "").trim(),
    (p.email ?? "").trim(),
    (p.address ?? "").trim(),
    (p.dni ?? "").trim().toUpperCase(),
  ];
}

export async function createPatient(db: Db, input: PatientInput): Promise<string> {
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into patients (name, birth_date, sex, body_mass_kg, height_cm, leg_length_cm, pushoff_distance_cm, notes, phone, email, address, dni, id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [...patientBind(input), id, t, t],
    },
  ]);
  return id;
}

export async function updatePatient(db: Db, id: string, input: PatientInput): Promise<void> {
  await db.transaction([
    {
      sql: `update patients set name = ?, birth_date = ?, sex = ?, body_mass_kg = ?, height_cm = ?, leg_length_cm = ?,
                   pushoff_distance_cm = ?, notes = ?, phone = ?, email = ?, address = ?, dni = ?, updated_at = ?
             where id = ?`,
      bind: [...patientBind(input), now(), id],
    },
  ]);
}

/** Borra el paciente y, en cascada, todos sus tests, marcas y resultados. */
export async function deletePatient(db: Db, id: string): Promise<void> {
  await db.transaction([
    // Sus archivos se borran con él (en cascada): se apuntan para borrarlos también del servidor (src/documents).
    { sql: "insert or ignore into document_trash (id, at) select id, ? from documents where patient_id = ?", bind: [new Date().toISOString(), id] },
    { sql: "delete from patients where id = ?", bind: [id] },
  ]);
}

/** Ficha donde van las mediciones hechas sin elegir paciente (pantalla Pacientes, «Medir ya»). */
export const QUICK_PATIENT = "Medición rápida";
