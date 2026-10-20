// Protección de datos (src/privacy/README.md): los datos de la clínica para el texto informativo, lo que se
// registra de cada paciente (información entregada y consentimientos opcionales) y cuánto hay que conservar su
// historia clínica. Mismo estilo que repo.ts: las pantallas no escriben SQL.
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

/** Consentimientos opcionales: lo que no es la asistencia en sí. */
export type Consent = "images" | "contact" | "research";
export const CONSENTS: { id: Consent; label: string; text: string }[] = [
  {
    id: "images",
    label: "Fotos y vídeos",
    text: "Tomar fotos o vídeos durante las sesiones para valorar mi evolución. Se quedan en la clínica y no se publican.",
  },
  {
    id: "contact",
    label: "WhatsApp, SMS o correo",
    text: "Contactarme por WhatsApp, SMS o correo electrónico para mis citas y mi tratamiento.",
  },
  {
    id: "research",
    label: "Docencia y estudios",
    text: "Usar mis datos sin que se me pueda identificar (anónimos) en docencia o estudios de la clínica.",
  },
];

export type PatientPrivacy = {
  /** Día en que se le entregó la información (AAAA-MM-DD). */
  informedAt?: string;
  /** Quién firma por el paciente: su representante legal (menores de 16 años, tutela). */
  signedBy?: string;
  /** Sí o no de cada consentimiento; sin la clave, aún no se ha preguntado. */
  consents?: Partial<Record<Consent, boolean>>;
  /** Última vez que cambió algo de esto (ISO). */
  updatedAt?: string;
};

export function parsePrivacy(json: string | null | undefined): PatientPrivacy {
  try {
    return (JSON.parse(json ?? "{}") as PatientPrivacy) ?? {};
  } catch {
    return {};
  }
}

export async function savePatientPrivacy(db: Db, patientId: string, p: PatientPrivacy): Promise<void> {
  const t = new Date().toISOString();
  const clean: PatientPrivacy = { ...p, signedBy: p.signedBy?.trim() || undefined, updatedAt: t };
  await db.transaction([{ sql: "update patients set privacy = ?, updated_at = ? where id = ?", bind: [JSON.stringify(clean), t, patientId] }]);
}

// ---------- La clínica ----------

/** Datos del responsable del tratamiento para el texto informativo. Se guardan en la base (van a la nube). */
export type ClinicInfo = {
  name: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  /** Contacto del delegado de protección de datos (obligatorio en un centro sanitario). */
  dpo: string;
  /** Años que se conserva la historia clínica desde la última atención. */
  retentionYears: number;
  /** Con la copia en Google Drive: hay contrato de encargado del tratamiento con Google (Google Workspace). */
  googleDpa: boolean;
  /** Con el servidor de Cloudflare: se ha revisado su contrato de encargado (DPA) y se guarda una copia. */
  cloudflareDpa: boolean;
  /** Para los consentimientos: el fisioterapeuta que informa por defecto, su número de colegiado y la localidad. */
  professional: string;
  license: string;
  city: string;
};

/** Ley 41/2002, art. 17: como mínimo cinco años desde el alta de cada proceso asistencial. */
export const MIN_RETENTION_YEARS = 5;
const CLINIC_KEY = "clinic_privacy";
export const emptyClinic: ClinicInfo = {
  name: "",
  taxId: "",
  address: "",
  email: "",
  phone: "",
  dpo: "",
  retentionYears: MIN_RETENTION_YEARS,
  googleDpa: false,
  cloudflareDpa: false,
  professional: "",
  license: "",
  city: "",
};

export async function getClinic(db: Db): Promise<ClinicInfo> {
  return { ...emptyClinic, ...((await getSetting<Partial<ClinicInfo>>(db, CLINIC_KEY)) ?? {}) };
}

export async function saveClinic(db: Db, c: ClinicInfo): Promise<void> {
  const trim = (s: string) => s.trim();
  await setSetting(db, CLINIC_KEY, {
    ...c,
    name: trim(c.name),
    taxId: trim(c.taxId),
    address: trim(c.address),
    email: trim(c.email),
    phone: trim(c.phone),
    dpo: trim(c.dpo),
    professional: trim(c.professional),
    license: trim(c.license),
    city: trim(c.city),
    retentionYears: Math.max(MIN_RETENTION_YEARS, Math.round(c.retentionYears) || MIN_RETENTION_YEARS),
  });
}

/** Lo mínimo para que el texto informativo diga quién es el responsable y dónde ejercer los derechos. */
export const clinicComplete = (c: ClinicInfo) => !!(c.name && c.email);

// ---------- Conservación ----------

/**
 * Lo que hay que conservar de un paciente: cuántos registros clínicos tiene (sin ninguno, la ficha está vacía y
 * no hay historia que guardar) y la última vez que se le atendió o se le registró algo (ISO): desde ahí cuenta
 * el plazo.
 */
export async function clinicalRecord(db: Db, patientId: string): Promise<{ records: number; last: string | null }> {
  const [row] = await db.query<{ records: number; last: string | null }>(
    `select sum(n) as records, max(at) as last from (
       select count(*) as n, max(performed_at) as at from tests where patient_id = ?1
       union all select count(*), max(performed_at) from sessions where patient_id = ?1
       union all select count(*), max(performed_at) from findings where patient_id = ?1
       union all select count(*), max(performed_at) from questionnaires where patient_id = ?1
       union all select count(*), max(performed_at) from wellness where patient_id = ?1
       union all select count(*), max(updated_at) from anamnesis where patient_id = ?1
       union all select count(*), max(signed_at) from consents where patient_id = ?1
     )`,
    [patientId],
  );
  return { records: row?.records ?? 0, last: row?.last ?? null };
}

/** Hasta cuándo hay que conservarla: `years` años después de `last`. */
export function keepUntil(last: string, years: number): Date {
  const d = new Date(last);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/** Edad en años cumplidos en `on`, o null sin fecha de nacimiento. */
export function ageOn(birthDate: string | null, on = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  return on.getFullYear() - y - (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d) ? 1 : 0);
}

/** Por debajo de esta edad firma el representante legal (Ley 41/2002, art. 9). */
export const ADULT_CONSENT_AGE = 16;
