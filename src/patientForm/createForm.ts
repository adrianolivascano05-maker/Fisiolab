// Crear un formulario para el paciente (su parte de la anamnesis o un cuestionario): se cifra con una clave nueva,
// se sube al servidor de la clínica y se apunta en su ficha. Lo usan la ficha (SendFormsPage) y la bandeja de envíos.
import { ANAMNESIS_KIND, FORM_DAYS, formLink, newFormId, newFormKey, patientSections, seal, type FormRequest } from "../clinical/patientForms";
import type { Section } from "../clinical/anamnesis";
import { getToken } from "../cloud/auth";
import type { Cloud } from "../cloud/CloudGate";
import type { Db } from "../data/db";
import { currentEpisode } from "../data/episodes";
import { addSentForm, type SentForm } from "../data/patientForms";

export type CreatedForm = SentForm & { url: string };

export async function createPatientForm(
  db: Db,
  cloud: Cloud | null,
  p: { patientId: string; patientName: string; kind: string; clinicName: string; sections: Section[] },
): Promise<CreatedForm> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) throw new Error("Tu sesión de Google ha caducado: vuelve a entrar en Ajustes → Cuenta y prueba otra vez.");
  const id = newFormId();
  const key = newFormKey();
  const expiresAt = new Date(Date.now() + FORM_DAYS * 86_400_000).toISOString();
  const request: FormRequest = {
    v: 1,
    clinic: p.clinicName,
    name: p.patientName.trim().split(/\s+/)[0] ?? "",
    kind: p.kind,
    ...(p.kind === ANAMNESIS_KIND ? { sections: patientSections(p.sections) } : {}),
    expiresAt,
  };
  await cloud.clinics.forms.create(token, cloud.clinic.id, { id, request: await seal(request, key), expiresAt });
  const episodeId = await currentEpisode(db, p.patientId);
  await addSentForm(db, { id, patientId: p.patientId, episodeId, kind: p.kind, key, expiresAt });
  return {
    id,
    patientId: p.patientId,
    episodeId,
    kind: p.kind,
    key,
    expiresAt,
    sentAt: new Date().toISOString(),
    answeredAt: null,
    importedAt: null,
    cancelledAt: null,
    answers: null,
    skipped: [],
    url: formLink(id, key),
  };
}
