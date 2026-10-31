// Protección de datos (src/privacy/README.md): los datos de la clínica para el texto informativo, lo que se
// registra de cada paciente (información entregada y consentimientos opcionales) y cuánto hay que conservar su
// historia clínica. Mismo estilo que repo.ts: las pantallas no escriben SQL.
import type { Db } from "./db";
import { member, memberKey } from "./member";
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

/** Un apartado del texto informativo (src/privacy/privacyText.ts). */
export type PrivacySection = { title: string; paragraphs: string[] };

/**
 * La hoja de protección de datos tal como se firmó en la pantalla: el texto entero, las respuestas, quién firmó y su
 * firma. Si después cambian el texto, los datos de la clínica o sus respuestas, esta no cambia.
 */
export type SignedPrivacySheet = {
  /** Versión del texto (PRIVACY_TEXT_VERSION). */
  version: string;
  /** Día de la firma (AAAA-MM-DD) y momento exacto (ISO). */
  date: string;
  at: string;
  /** En la pantalla de la clínica o en su móvil, por un enlace (src/patientForm). */
  method: "screen" | "link";
  patientName: string;
  /** Firma su representante legal (menores de 16 años, tutela): su nombre. */
  signedBy?: string;
  sections: PrivacySection[];
  /** Cada permiso opcional con su texto y la respuesta (null: sin preguntar). */
  consents: { id: Consent; text: string; answer: boolean | null }[];
  /** La firma: imagen PNG (data URL). */
  signature: string;
};

export type ContactChannel = "whatsapp" | "email";
/**
 * Paciente nuevo que ha pedido cita y ha dado este teléfono o correo para gestionarla (lo marca el fisio al mandarle la
 * anamnesis): la única excepción para escribirle sin el permiso de contacto firmado (mayMessage). Quién y cuándo.
 */
export type BookingContact = { at: string; by: string; channels: ContactChannel[] };
/**
 * Lo que pidió en el formulario online de paciente nuevo: que le escriban por WhatsApp, SMS o correo. Con el texto
 * exacto que vio, su versión y la hora del servidor. No es el permiso hasta que alguien de la clínica lo confirma.
 */
export type ContactRequest = { at: string; formId: string; text: string; version: string; confirmedAt?: string; confirmedBy?: string; dismissedAt?: string };
/** Que leyó la información de protección de datos en el formulario online (acuse, no consentimiento). */
export type IntakeAck = { at: string; formId: string; version: string };

export type PatientPrivacy = {
  /** Día en que se le entregó la información (AAAA-MM-DD). */
  informedAt?: string;
  /** Quién firma por el paciente: su representante legal (menores de 16 años, tutela). */
  signedBy?: string;
  /** Sí o no de cada consentimiento; sin la clave, aún no se ha preguntado. */
  consents?: Partial<Record<Consent, boolean>>;
  /** Las hojas firmadas en la pantalla, de la primera a la última (si cambian sus permisos, se firma otra). */
  sheets?: SignedPrivacySheet[];
  /** Paciente nuevo: ha pedido cita y ha dado este contacto para gestionarla (excepción de mayMessage). */
  bookingContact?: BookingContact;
  /** Lo que pidió en el formulario online sobre el contacto, del primero al último. */
  contactRequests?: ContactRequest[];
  /** Acuses de «He leído la información» del formulario online. */
  intakeAcks?: IntakeAck[];
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

/**
 * Guarda la hoja firmada en la pantalla: queda entregada ese día, con sus respuestas, y la hoja se añade a las firmadas
 * (las de antes se conservan).
 */
export async function signPrivacySheet(db: Db, patientId: string, privacy: PatientPrivacy, sheet: SignedPrivacySheet): Promise<void> {
  if (!sheet.signature.startsWith("data:image/")) throw new RangeError("Falta la firma.");
  const [row] = await db.query<{ privacy: string | null }>("select privacy from patients where id = ?", [patientId]);
  if (!row) throw new RangeError("Este paciente no existe.");
  const before = parsePrivacy(row.privacy).sheets ?? [];
  // La misma firma que llega dos veces (dos dispositivos recogiendo el mismo enlace a la vez) no se repite.
  if (before.some((s) => s.at === sheet.at && s.signature === sheet.signature)) return;
  await savePatientPrivacy(db, patientId, { ...privacy, informedAt: sheet.date, sheets: [...before, sheet] });
}

/**
 * Si los permisos de ahora no son los de la última hoja firmada (habría que firmar otra). El permiso de contacto que
 * pidió en el formulario online y la clínica confirmó después de esa hoja no cuenta como cambio.
 */
export function changedSinceSigned(p: PatientPrivacy): boolean {
  const last = p.sheets?.at(-1);
  if (!last) return false;
  const confirmedLater = (p.contactRequests ?? []).some((r) => r.confirmedAt && r.confirmedAt > last.at);
  return (
    CONSENTS.some((c) => !(c.id === "contact" && confirmedLater && p.consents?.contact === true) && (p.consents?.[c.id] ?? null) !== (last.consents.find((x) => x.id === c.id)?.answer ?? null)) ||
    (p.signedBy?.trim() || undefined) !== last.signedBy
  );
}

/** Para qué se le quiere escribir, cuando no es lo de siempre: la anamnesis inicial a un paciente nuevo. */
export type MessagePurpose = { kind: "anamnesis-inicial"; isNew: boolean; booking?: BookingContact | null; channel: ContactChannel };

/**
 * Solo con el permiso de contacto firmado como «Sí» (la hoja de protección de datos, en la pantalla o en papel) se
 * le escribe por WhatsApp, SMS o correo. Sin preguntar, tampoco: se le llama o se le da en persona. Única excepción:
 * la anamnesis inicial de un paciente nuevo que ha pedido cita y ha dado ese teléfono o correo para gestionarla (lo
 * marca el fisio: bookingContact; art. 6.1.b RGPD, medidas a petición del interesado). Con un «No», nunca.
 */
export const mayMessage = (contact: boolean | null | undefined, purpose?: MessagePurpose) =>
  contact === true || (contact !== false && purpose?.kind === "anamnesis-inicial" && purpose.isNew && !!purpose.booking?.channels.includes(purpose.channel));

/** Lo que pidió en el formulario y nadie ha confirmado ni descartado aún. */
export const pendingContactRequest = (p: PatientPrivacy): ContactRequest | null =>
  [...(p.contactRequests ?? [])].reverse().find((r) => !r.confirmedAt && !r.dismissedAt) ?? null;

async function updatePrivacy(db: Db, patientId: string, change: (p: PatientPrivacy) => PatientPrivacy): Promise<void> {
  const [row] = await db.query<{ privacy: string | null }>("select privacy from patients where id = ?", [patientId]);
  if (!row) throw new RangeError("Este paciente no existe.");
  await savePatientPrivacy(db, patientId, change(parsePrivacy(row.privacy)));
}

/** Marca (o quita, con null) que ha pedido cita y ha dado estos canales para gestionarla. */
export async function setBookingContact(db: Db, patientId: string, channels: ContactChannel[] | null, by: string): Promise<void> {
  await updatePrivacy(db, patientId, (p) => {
    const { bookingContact: _, ...rest } = p;
    return channels?.length ? { ...rest, bookingContact: { at: new Date().toISOString(), by, channels } } : rest;
  });
}

/**
 * Lo que llega del formulario online de paciente nuevo: el acuse de la información y, si la marcó, la petición de que
 * le escriban. Cada uno se apunta una vez por envío (recoger dos veces no lo repite). No toca el permiso de contacto.
 */
export async function recordIntake(db: Db, patientId: string, input: { ack?: IntakeAck; request?: ContactRequest }): Promise<void> {
  if (!input.ack && !input.request) return;
  await updatePrivacy(db, patientId, (p) => ({
    ...p,
    ...(input.ack && !(p.intakeAcks ?? []).some((a) => a.formId === input.ack!.formId) ? { intakeAcks: [...(p.intakeAcks ?? []), input.ack] } : {}),
    ...(input.request && !(p.contactRequests ?? []).some((r) => r.formId === input.request!.formId) ? { contactRequests: [...(p.contactRequests ?? []), input.request] } : {}),
  }));
}

/** «Confirmar» (pone el permiso de contacto en «Sí») o «No apuntarlo» lo que pidió en el formulario. */
export async function answerContactRequest(db: Db, patientId: string, formId: string, confirm: boolean, by: string): Promise<void> {
  const t = new Date().toISOString();
  await updatePrivacy(db, patientId, (p) => ({
    ...p,
    ...(confirm ? { consents: { ...p.consents, contact: true } } : {}),
    contactRequests: (p.contactRequests ?? []).map((r) => (r.formId !== formId ? r : confirm ? { ...r, confirmedAt: t, confirmedBy: by } : { ...r, dismissedAt: t })),
  }));
}
export const MISSING_CONTACT = "Falta su permiso de contacto: que firme la hoja de protección de datos";
export const REFUSED_CONTACT = "No acepta WhatsApp ni correo";
/** Por qué no se le puede escribir (null si sí se puede). */
export const contactBlock = (contact: boolean | null | undefined) => (mayMessage(contact) ? null : contact === false ? REFUSED_CONTACT : MISSING_CONTACT);

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
  /** El fisioterapeuta que firma los informes y, por defecto, los consentimientos; su nº de colegiado y la localidad. */
  professional: string;
  license: string;
  city: string;
};

/** Ley 41/2002, art. 17: como mínimo cinco años desde el alta de cada proceso asistencial. */
export const MIN_RETENTION_YEARS = 5;
const CLINIC_KEY = "clinic_privacy";
/** En una clínica con equipo, el nombre y el nº de colegiado son de cada fisioterapeuta (memberKey). */
const PROFESSIONAL_KEY = "professional";
type Professional = Pick<ClinicInfo, "professional" | "license">;
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
  const clinic = { ...emptyClinic, ...(await getSetting<Partial<ClinicInfo>>(db, CLINIC_KEY)) };
  if (!member()) return clinic;
  const mine = await getSetting<Partial<Professional>>(db, memberKey(PROFESSIONAL_KEY));
  return { ...clinic, professional: mine?.professional ?? "", license: mine?.license ?? "" };
}

export async function saveClinic(db: Db, c: ClinicInfo): Promise<void> {
  const trim = (s: string) => s.trim();
  if (member()) {
    await setSetting(db, memberKey(PROFESSIONAL_KEY), { professional: trim(c.professional), license: trim(c.license) } satisfies Professional);
    c = { ...c, professional: "", license: "" };
  }
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
