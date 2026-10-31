// La información de protección de datos (capa 1) y las casillas que ve un paciente NUEVO al abrir el enlace de su
// anamnesis antes de la primera cita (src/patientForm/PublicFormPage.tsx), cuando aún no ha firmado la hoja de
// protección de datos. Textos del paquete de revisión del 30-10-2026 (documento 05, apartado 6.1), con los datos de
// Ajustes › Clínica y protección de datos. Son textos de trabajo, no revisados por un abogado ni por el DPD: al
// cambiarlos, sube INTAKE_TEXT_VERSION (se guarda con cada acuse y cada petición de contacto).
import type { ClinicInfo, PrivacySection } from "../data/privacy";

export const INTAKE_TEXT_VERSION = "2026-10-31";

/** La casilla obligatoria: solo confirma que la ha leído; no es un consentimiento. */
export const INTAKE_ACK_TEXT = "He leído esta información.";

/** Lo que falta en los datos de la clínica sale así (la clínica lo ve antes de mandar: SendFormsPage avisa). */
const or = (v: string, missing: string) => v.trim() || missing;

/** La información en una capa, con los datos de la clínica. */
export function intakeNotice(clinic: ClinicInfo, clinicName: string): PrivacySection[] {
  const name = or(clinic.name, clinicName || "la clínica");
  const email = clinic.email.trim();
  const contact = [email, clinic.phone.trim()].filter(Boolean).join(" · ");
  const who = [name, clinic.taxId.trim() && `NIF ${clinic.taxId.trim()}`, clinic.address.trim()].filter(Boolean).join(", ");
  return [
    {
      title: "Antes de empezar: cómo tratamos tus datos",
      paragraphs: [
        `Responsable: ${who}.${contact ? ` Contacto: ${contact}.` : ""}${clinic.dpo.trim() ? ` Delegado de protección de datos: ${clinic.dpo.trim()}.` : ""}`,
        "Para qué: preparar tu primera consulta y abrir tu historia clínica. Lo que contestes pasa a formar parte de ella.",
        "Por qué: es necesario para tu asistencia sanitaria y lo exige la ley de la historia clínica (Reglamento (UE) 2016/679, arts. 6.1.b, 6.1.c y 9.2.h, y Ley 41/2002). No te pedimos consentimiento para esto.",
        "Es voluntario contestar. Si dejas algo en blanco, lo hablaremos en la consulta; sin los datos necesarios puede que no podamos atenderte con seguridad.",
        "Quién lo ve: el equipo sanitario de la clínica. Va cifrado desde tu móvil hasta la clínica y solo se abre con la clave que va en tu enlace, que es personal: no lo reenvíes. No se cede a nadie, salvo obligación legal.",
        `Cuánto tiempo: al menos ${clinic.retentionYears} años desde tu alta (Ley 41/2002, art. 17).`,
        `Tus derechos: acceder, corregir, suprimir (salvo lo que la ley obliga a conservar), oponerte, limitar el uso y llevarte tus datos, ${email ? `escribiendo a ${email} o ` : ""}en la clínica. Si no estás conforme, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
      ],
    },
  ];
}

/** La casilla opcional, sin marcar: el único modo en que este formulario puede dar un permiso (art. 7.1 RGPD). */
export function intakeContactText(clinic: ClinicInfo, clinicName: string): string {
  const name = or(clinic.name, clinicName || "la clínica");
  const email = clinic.email.trim();
  return `Opcional. Sí, quiero que ${name} me escriba por WhatsApp, SMS o correo para recordarme o cambiar mis citas y enviarme formularios. No incluirá datos de salud ni publicidad. Si no lo marco, me atenderán igual y me avisarán por teléfono o en la consulta. Puedo retirarlo cuando quiera, diciéndolo en la clínica${email ? ` o escribiendo a ${email}` : ""}. Lo confirmaremos contigo en la consulta.`;
}
