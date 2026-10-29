// La hoja de protección de datos para mandarla a firmar por enlace (src/patientForm): el mismo texto que se firma en la
// pantalla (liveNotice), con los datos de la clínica de ahora, y los permisos con su nombre y su texto.
import type { PrivacyToSign } from "../clinical/patientForms";
import { CONSENTS, type ClinicInfo, type PatientPrivacy } from "../data/privacy";
import { liveNotice } from "./PrivacyNotice";
import { PRIVACY_TEXT_VERSION, type Storage } from "./privacyText";

export function privacyToSign(clinic: ClinicInfo, storage: Storage, patient: { name: string; privacy: PatientPrivacy }): PrivacyToSign {
  const live = liveNotice(clinic, storage, patient.name, patient.privacy);
  return {
    version: PRIVACY_TEXT_VERSION,
    patientName: patient.name,
    ...(live.signedBy ? { signedBy: live.signedBy } : {}),
    sections: live.sections,
    consents: CONSENTS.map((c) => ({ id: c.id, label: c.label, text: c.text })),
  };
}
