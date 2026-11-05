// Crear un formulario para el paciente (su parte de la anamnesis o un cuestionario): se cifra con una clave nueva,
// se sube al servidor de la clínica y se apunta en su ficha. Lo usan la ficha (SendFormsPage) y la bandeja de envíos.
import { ANAMNESIS_KIND, DOCS_KIND, DOCS_PER_LINK, FORM_DAYS, formLink, isSignKind, newFormId, newFormKey, patientSections, seal, type FormRequest } from "../clinical/patientForms";
import type { Section } from "../clinical/anamnesis";
import { currentTemplate, markTemplateUsed, type ResolvedTemplate } from "../data/anamnesisTemplates";
import { ageOn } from "../data/privacy";
import { isOwnKind } from "../clinical/forms/own";
import { ownSpec } from "../clinical/ownCatalog";
import { getOwnForm } from "../data/ownForms";
import { currentBrand } from "../brand/brand";
import { formBrand } from "../brand/form";
import { getToken } from "../cloud/auth";
import type { Cloud } from "../cloud/cloudContext";
import type { Db } from "../data/db";
import { currentEpisode } from "../data/episodes";
import { getClinic } from "../data/privacy";
import { addSentForm, type FormMeta, type SentForm } from "../data/patientForms";
import { getPatient, isNewPatient } from "../data/patients";
import { INTAKE_ACK_TEXT, INTAKE_TEXT_VERSION, intakeContactText, intakeNotice } from "../privacy/intakeText";

export type CreatedForm = SentForm & { url: string };
/** Un formulario ya subido al servidor que aún no se ha apuntado en la ficha (hasta que se manda de verdad). */
export type UploadedForm = { record: Pick<SentForm, "id" | "patientId" | "episodeId" | "kind" | "key" | "expiresAt" | "meta">; url: string };

/**
 * Sube un formulario al servidor (cifrado con una clave nueva) sin apuntarlo aún en la ficha: la bandeja lo apunta
 * solo cuando se envía. Si al final no se manda, el del servidor caduca solo y no lo tiene nadie.
 */
/** Qué se manda: la anamnesis, un cuestionario o archivos (con `sections`). */
export type FormToCreate = {
  patientId: string;
  patientName: string;
  kind: string;
  clinicName: string;
  /** Ya no se usa para la anamnesis (se manda con la plantilla de la clínica); se queda por compatibilidad. */
  sections?: Section[];
  /** La plantilla de la clínica, resuelta: va su huella en el enlace y se guarda su instantánea. */
  template?: ResolvedTemplate | null;
};

export async function uploadPatientForm(
  db: Db,
  cloud: Cloud | null,
  p: FormToCreate,
): Promise<UploadedForm> {
  // La hoja de protección de datos y los consentimientos ya no se firman por enlace (30-10-2026).
  if (isSignKind(p.kind)) throw new Error("Los documentos para firmar se firman en la clínica.");
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) throw new Error("Tu sesión de Google ha caducado: vuelve a entrar en Ajustes → Cuenta y prueba otra vez.");
  const id = newFormId();
  const key = newFormKey();
  const expiresAt = new Date(Date.now() + FORM_DAYS * 86_400_000).toISOString();
  const clinic = await getClinic(db).catch(() => null);
  const brand = await formBrand(currentBrand(), clinic ?? {});
  const anamnesis = p.kind === ANAMNESIS_KIND;
  // La plantilla con la que se manda (la de ahora, si no viene): su instantánea queda guardada (y se sincroniza) para
  // recogerlo con ella aunque la clínica la cambie después.
  const template = anamnesis ? (p.template ?? (await currentTemplate(db))) : null;
  const sections = template ? patientSections(template.sections) : null;
  const tpl = template ? await markTemplateUsed(db, template) : undefined;
  // A un paciente nuevo que aún no ha dicho «Sí» al contacto, la anamnesis empieza con la información de protección de
  // datos, el «He leído» y la casilla opcional de contacto (src/privacy/intakeText.ts).
  const patient = sections ? await getPatient(db, p.patientId) : null;
  const age = patient ? ageOn(patient.birthDate) : null;
  const minor = age !== null && age < 18;
  const intake =
    sections && clinic && patient && patient.privacy.consents?.contact !== true && (await isNewPatient(db, p.patientId))
      ? { version: INTAKE_TEXT_VERSION, notice: intakeNotice(clinic, p.clinicName), ackText: INTAKE_ACK_TEXT, contactText: intakeContactText(clinic, p.clinicName) }
      : null;
  // Un cuestionario propio: va la versión de ahora entera, y su huella se apunta para recogerlo con ella.
  const ownForm = isOwnKind(p.kind) ? (ownSpec(p.kind) ?? (await getOwnForm(db, p.kind))?.spec) : undefined;
  if (isOwnKind(p.kind) && !ownForm?.hash) throw new Error("Ese cuestionario de la clínica ya no está.");
  const meta: FormMeta | null = ownForm
    ? { hash: ownForm.hash }
    : sections
    ? {
        fields: sections.flatMap((s) => s.fields.map((f) => f.id)),
        ...(intake ? { intake: { version: intake.version, contactText: intake.contactText } } : {}),
        ...(tpl ? { tpl } : {}),
        ...(minor ? { minor } : {}),
      }
    : null;
  const request: FormRequest = {
    v: tpl ? 2 : 1,
    clinic: p.clinicName,
    name: p.patientName.trim().split(/\s+/)[0] ?? "",
    kind: p.kind,
    ...(sections ? { sections } : {}),
    ...(ownForm ? { form: ownForm } : {}),
    ...(tpl ? { tpl } : {}),
    ...(minor ? { minor } : {}),
    ...(intake ? { intake } : {}),
    expiresAt,
    ...(brand ? { brand } : {}),
    ...(p.kind === DOCS_KIND ? { maxDocs: DOCS_PER_LINK } : {}),
    controller: { name: clinic?.name || p.clinicName, email: clinic?.email ?? "" },
  };
  await cloud.clinics.forms.create(token, cloud.clinic.id, { id, request: await seal(request, key), expiresAt, ...(p.kind === DOCS_KIND ? { maxDocs: DOCS_PER_LINK } : {}) });
  const episodeId = await currentEpisode(db, p.patientId);
  return { record: { id, patientId: p.patientId, episodeId, kind: p.kind, key, expiresAt, meta }, url: formLink(id, key) };
}

/** Apunta en la ficha los formularios que se acaban de mandar (para recoger sus respuestas). */
export async function recordSentForms(db: Db, forms: UploadedForm[]): Promise<void> {
  for (const f of forms) await addSentForm(db, f.record);
}

/** Sube el formulario y lo apunta ya en la ficha (cuando se crea para mandarlo en ese momento). */
export async function createPatientForm(
  db: Db,
  cloud: Cloud | null,
  p: FormToCreate,
): Promise<CreatedForm> {
  const f = await uploadPatientForm(db, cloud, p);
  await addSentForm(db, f.record);
  return { ...f.record, sentAt: new Date().toISOString(), answeredAt: null, importedAt: null, cancelledAt: null, answers: null, skipped: [], url: f.url };
}
