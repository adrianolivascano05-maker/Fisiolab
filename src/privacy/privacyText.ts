// El texto informativo de protección de datos (RGPD, art. 13, y LOPDGDD, art. 11), como datos: lo pinta
// PrivacyNotice.tsx y, al firmarlo en la pantalla, se guarda tal cual en la ficha del paciente (src/data/privacy.ts,
// SignedPrivacySheet), igual que los consentimientos guardan su texto. Lo que falta de la clínica sale entre corchetes.
// Es una plantilla: la clínica debe revisarla con su delegado de protección de datos. Al cambiar el texto, sube
// PRIVACY_TEXT_VERSION (las hojas ya firmadas conservan el suyo).
import type { ClinicInfo, PrivacySection } from "../data/privacy";

export const PRIVACY_TEXT_VERSION = "2026-10-27";

/** Dónde se guardan los datos: solo en los dispositivos, también en Google Drive (cifrados o no) o, cifrados, en el servidor de la clínica en Cloudflare. */
export type Storage = "local" | "cloud" | "server";

const or = (value: string, placeholder: string) => value || `[${placeholder}]`;

export function privacySections(clinic: ClinicInfo, storage: Storage): PrivacySection[] {
  const contact = [clinic.email, clinic.phone].filter(Boolean).join(" · ");
  return [
    {
      title: "Quién trata sus datos",
      paragraphs: [
        `${or(clinic.name, "nombre de la clínica")}${clinic.taxId ? `, NIF ${clinic.taxId}` : ""}${clinic.address ? `, ${clinic.address}` : ""}. Contacto: ${or(contact, "correo y teléfono")}.${
          clinic.dpo ? ` Delegado de protección de datos: ${clinic.dpo}.` : ""
        }`,
      ],
    },
    {
      title: "Para qué",
      paragraphs: ["Para atenderle como fisioterapeuta: valoración, tratamiento y seguimiento; llevar su historia clínica y gestionar sus citas."],
    },
    {
      title: "Por qué podemos hacerlo",
      paragraphs: [
        "Porque es necesario para su asistencia sanitaria y lo exige la ley de la historia clínica (art. 9.2.h del Reglamento General de Protección de Datos y Ley 41/2002). Lo que se marca abajo como opcional solo se hace con su consentimiento, que puede retirar cuando quiera sin que afecte a su atención.",
      ],
    },
    {
      title: "Quién más los ve",
      paragraphs: [
        `Nadie fuera de la clínica, salvo obligación legal o que usted lo pida (por ejemplo, un informe para su médico o su mutua). ${
          storage === "local"
            ? "Se guardan en los dispositivos de la clínica."
            : storage === "server"
              ? "Se guardan en los dispositivos de la clínica y en una copia cifrada, con una contraseña que solo tiene la clínica, en un servidor de Cloudflare (encargado del tratamiento), con la base de datos en la Unión Europea: ni Cloudflare ni quien gestiona el servidor pueden leerlos. Solo acceden los profesionales de la clínica, que entran en la app con su cuenta de Google, que no guarda su historia. Si la clínica apunta sus citas en Google Calendar, figuran el día, la hora y sus iniciales."
              : "Se guardan en los dispositivos de la clínica y en una copia en Google Drive, cifrada con una contraseña que solo tiene la clínica. El día y la hora de sus citas, con sus iniciales, se apuntan en el calendario de Google del fisioterapeuta. Google es el proveedor de ese almacenamiento y puede tratar datos fuera del Espacio Económico Europeo con las garantías del Marco de Privacidad de Datos UE-EE. UU. y de las cláusulas contractuales tipo de la Comisión Europea."
        }`,
      ],
    },
    {
      title: "Cuánto tiempo",
      paragraphs: [
        `Mientras dure su tratamiento y, después, al menos ${clinic.retentionYears} años desde el alta de cada proceso, como exige la Ley 41/2002 (o el plazo mayor que fije su comunidad autónoma). Lo opcional, hasta que retire su consentimiento.`,
      ],
    },
    {
      title: "Sus derechos",
      paragraphs: [
        `Puede pedir acceso a sus datos y a una copia de su historia clínica, corregirlos, suprimirlos (salvo lo que la ley obliga a conservar), oponerse, limitar su uso y llevárselos a otro profesional, escribiendo a ${or(clinic.email, "correo de la clínica")} o en la propia clínica. Si cree que no se respetan, puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
      ],
    },
  ];
}
