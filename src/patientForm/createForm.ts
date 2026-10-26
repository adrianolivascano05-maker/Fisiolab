// Crear un formulario para el paciente (su parte de la anamnesis o un cuestionario): se cifra con una clave nueva,
// se sube al servidor de la clínica y se apunta en su ficha. Lo usan la ficha (SendFormsPage) y la bandeja de envíos.
import { ANAMNESIS_KIND, DOCS_KIND, DOCS_PER_LINK, FORM_DAYS, formLink, newFormId, newFormKey, patientSections, seal, type FormRequest } from "../clinical/patientForms";
import type { Section } from "../clinical/anamnesis";
import { currentBrand } from "../brand/brand";
import { formBrand } from "../brand/form";
import { getToken } from "../cloud/auth";
import type { Cloud } from "../cloud/CloudGate";
import type { Db } from "../data/db";
import { currentEpisode } from "../data/episodes";
import { addSentForm, type SentForm } from "../data/patientForms";

export type CreatedForm = SentForm & { url: string };
/** Un formulario ya subido al servidor que aún no se ha apuntado en la ficha (hasta que se manda de verdad). */
export type UploadedForm = { record: Pick<SentForm, "id" | "patientId" | "episodeId" | "kind" | "key" | "expiresAt">; url: string };

/**
 * Sube un formulario al servidor (cifrado con una clave nueva) sin apuntarlo aún en la ficha: la bandeja lo apunta
 * solo cuando se envía. Si al final no se manda, el del servidor caduca solo y no lo tiene nadie.
 */
export async function uploadPatientForm(
  db: Db,
  cloud: Cloud | null,
  p: { patientId: string; patientName: string; kind: string; clinicName: string; sections: Section[] },
): Promise<UploadedForm> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) throw new Error("Tu sesión de Google ha caducado: vuelve a entrar en Ajustes → Cuenta y prueba otra vez.");
  const id = newFormId();
  const key = newFormKey();
  const expiresAt = new Date(Date.now() + FORM_DAYS * 86_400_000).toISOString();
  const brand = await formBrand(currentBrand());
  const request: FormRequest = {
    v: 1,
    clinic: p.clinicName,
    name: p.patientName.trim().split(/\s+/)[0] ?? "",
    kind: p.kind,
    ...(p.kind === ANAMNESIS_KIND ? { sections: patientSections(p.sections) } : {}),
    expiresAt,
    ...(brand ? { brand } : {}),
    ...(p.kind === DOCS_KIND ? { maxDocs: DOCS_PER_LINK } : {}),
  };
  await cloud.clinics.forms.create(token, cloud.clinic.id, { id, request: await seal(request, key), expiresAt, ...(p.kind === DOCS_KIND ? { maxDocs: DOCS_PER_LINK } : {}) });
  const episodeId = await currentEpisode(db, p.patientId);
  return { record: { id, patientId: p.patientId, episodeId, kind: p.kind, key, expiresAt }, url: formLink(id, key) };
}

/** Apunta en la ficha los formularios que se acaban de mandar (para recoger sus respuestas). */
export async function recordSentForms(db: Db, forms: UploadedForm[]): Promise<void> {
  for (const f of forms) await addSentForm(db, f.record);
}

/** Sube el formulario y lo apunta ya en la ficha (cuando se crea para mandarlo en ese momento). */
export async function createPatientForm(
  db: Db,
  cloud: Cloud | null,
  p: { patientId: string; patientName: string; kind: string; clinicName: string; sections: Section[] },
): Promise<CreatedForm> {
  const f = await uploadPatientForm(db, cloud, p);
  await addSentForm(db, f.record);
  return { ...f.record, sentAt: new Date().toISOString(), answeredAt: null, importedAt: null, cancelledAt: null, answers: null, skipped: [], url: f.url };
}
