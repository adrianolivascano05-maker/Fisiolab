// Consentimientos informados firmados (migración 011, src/consent/README.md). Mismo estilo que repo.ts: las
// pantallas no escriben SQL. Un consentimiento firmado no se borra (es parte de la historia clínica): se retira.
import type { ConsentDocument } from "../consent/types";
import type { Db } from "./db";
import { inFocus } from "./episodes";

export type Signatures = { patient?: string; professional?: string; revocation?: string };
export type SignedConsent = {
  id: string;
  patientId: string;
  template: string;
  version: string;
  title: string;
  document: ConsentDocument;
  method: "screen" | "paper";
  signedAt: string;
  signatures: Signatures;
  revokedAt: string | null;
  revokeNote: string;
};

type Row = {
  id: string;
  patient_id: string;
  template: string;
  version: string;
  title: string;
  document: string;
  method: "screen" | "paper";
  signed_at: string;
  signatures: string;
  revoked_at: string | null;
  revoke_note: string;
};

const toConsent = (r: Row): SignedConsent => ({
  id: r.id,
  patientId: r.patient_id,
  template: r.template,
  version: r.version,
  title: r.title,
  document: JSON.parse(r.document) as ConsentDocument,
  method: r.method,
  signedAt: r.signed_at,
  signatures: JSON.parse(r.signatures) as Signatures,
  revokedAt: r.revoked_at,
  revokeNote: r.revoke_note,
});

/** Guarda un consentimiento firmado: en la pantalla (con las dos firmas) o en papel (la hoja firmada se guarda aparte). */
export async function saveSignedConsent(db: Db, patientId: string, doc: ConsentDocument, method: "screen" | "paper", signatures: Signatures): Promise<string> {
  if (method === "screen" && (!signatures.patient || !signatures.professional)) throw new RangeError("Faltan las firmas: la del paciente (o su representante) y la del fisioterapeuta.");
  if (!doc.professional.name.trim()) throw new RangeError("Escribe el nombre del fisioterapeuta que informa.");
  if (doc.representative && !doc.representative.name.trim()) throw new RangeError("Escribe el nombre del representante.");
  const id = crypto.randomUUID();
  const t = new Date().toISOString();
  await db.transaction([
    {
      sql: `insert into consents (id, patient_id, template, version, title, document, method, signed_at, signatures, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, doc.templateId, doc.version, doc.title, JSON.stringify(doc), method, t, JSON.stringify(method === "screen" ? signatures : {}), t, t],
    },
  ]);
  return id;
}

/** Los del motivo de consulta que se está viendo, el más reciente primero. */
export async function listConsents(db: Db, patientId: string): Promise<SignedConsent[]> {
  const rows = await db.query<Row>(`select * from consents c where patient_id = ? and ${inFocus("c")} order by signed_at desc`, [patientId]);
  return rows.map(toConsent);
}

export async function getConsent(db: Db, id: string): Promise<SignedConsent | null> {
  const [row] = await db.query<Row>("select * from consents where id = ?", [id]);
  return row ? toConsent(row) : null;
}

/** El paciente retira su consentimiento (Ley 41/2002, art. 8.5): por escrito, con fecha y, si se puede, su firma. */
export async function revokeConsent(db: Db, id: string, note: string, signature?: string): Promise<void> {
  const c = await getConsent(db, id);
  if (!c) throw new RangeError("Este consentimiento no existe.");
  if (c.revokedAt) throw new RangeError("Ya estaba retirado.");
  const t = new Date().toISOString();
  const signatures: Signatures = { ...c.signatures, ...(signature ? { revocation: signature } : {}) };
  await db.transaction([
    { sql: "update consents set revoked_at = ?, revoke_note = ?, signatures = ?, updated_at = ? where id = ?", bind: [t, note.trim(), JSON.stringify(signatures), t, id] },
  ]);
}
