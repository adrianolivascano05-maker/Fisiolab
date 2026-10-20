// El texto informativo de protección de datos (RGPD, art. 13, y LOPDGDD, art. 11) que se entrega al paciente
// en la primera visita, con los consentimientos opcionales y el sitio para firmar. Lo rellena la app con los
// datos de la clínica (Ajustes → Clínica y protección de datos). Es una plantilla: la clínica debe revisarla con su
// delegado de protección de datos.
import type { ReactNode } from "react";
import { CONSENTS, type ClinicInfo, type PatientPrivacy } from "../data/privacy";

/** Dónde se guardan los datos: solo en los dispositivos, también en Google Drive (cifrados o no) o, cifrados, en el servidor de la clínica en Cloudflare. */
export type Storage = "local" | "cloud" | "cloud-encrypted" | "server";

const blank = (text: string) => <span className="text-text-muted">[{text}]</span>;
const or = (value: string, placeholder: string): ReactNode => value || blank(placeholder);

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 break-inside-avoid">
      <h3 className="text-base font-semibold text-brand">{title}</h3>
      {children}
    </section>
  );
}

const box = (checked: boolean | undefined) => (
  <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-text text-xs leading-none">
    {checked ? "✕" : ""}
  </span>
);

export function PrivacyNotice({ clinic, storage, patientName, privacy }: { clinic: ClinicInfo; storage: Storage; patientName: string; privacy: PatientPrivacy }) {
  const contact = [clinic.email, clinic.phone].filter(Boolean).join(" · ");
  return (
    <article aria-label="Información sobre protección de datos" className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
      <header className="flex flex-col gap-0.5 border-b border-border pb-2">
        <h2 className="text-lg text-brand">Información sobre protección de datos</h2>
        <p className="text-sm text-text-muted">Para pacientes de fisioterapia · Reglamento (UE) 2016/679 y Ley Orgánica 3/2018</p>
      </header>

      <Part title="Quién trata sus datos">
        <p>
          {or(clinic.name, "nombre de la clínica")}
          {clinic.taxId && `, NIF ${clinic.taxId}`}
          {clinic.address && `, ${clinic.address}`}. Contacto: {or(contact, "correo y teléfono")}.
          {clinic.dpo && ` Delegado de protección de datos: ${clinic.dpo}.`}
        </p>
      </Part>

      <Part title="Para qué">
        <p>Para atenderle como fisioterapeuta: valoración, tratamiento y seguimiento; llevar su historia clínica y gestionar sus citas.</p>
      </Part>

      <Part title="Por qué podemos hacerlo">
        <p>
          Porque es necesario para su asistencia sanitaria y lo exige la ley de la historia clínica (art. 9.2.h del Reglamento General de Protección de
          Datos y Ley 41/2002). Lo que se marca abajo como opcional solo se hace con su consentimiento, que puede retirar cuando quiera sin que afecte a su
          atención.
        </p>
      </Part>

      <Part title="Quién más los ve">
        <p>
          Nadie fuera de la clínica, salvo obligación legal o que usted lo pida (por ejemplo, un informe para su médico o su mutua).{" "}
          {storage === "local"
            ? "Se guardan en los dispositivos de la clínica."
            : storage === "server"
              ? "Se guardan en los dispositivos de la clínica y en una copia cifrada, con una contraseña que solo tiene la clínica, en un servidor contratado a Cloudflare (encargado del tratamiento), con la base de datos en la Unión Europea: Cloudflare no puede leerlos. Los fisioterapeutas entran en la app con su cuenta de Google, que no guarda su historia. Si la clínica apunta sus citas en Google Calendar, figuran el día, la hora y sus iniciales."
              : `Se guardan en los dispositivos de la clínica y en una copia en Google Drive${storage === "cloud-encrypted" ? ", cifrada con una contraseña que solo tiene la clínica" : ""}. El día y la hora de sus citas, con su nombre o sus iniciales, se apuntan en el calendario de Google del fisioterapeuta. Google es el proveedor de ese almacenamiento y puede tratar datos fuera del Espacio Económico Europeo con las garantías del Marco de Privacidad de Datos UE-EE. UU. y de las cláusulas contractuales tipo de la Comisión Europea.`}
        </p>
      </Part>

      <Part title="Cuánto tiempo">
        <p>
          Mientras dure su tratamiento y, después, al menos {clinic.retentionYears} años desde el alta de cada proceso, como exige la Ley 41/2002 (o el
          plazo mayor que fije su comunidad autónoma). Lo opcional, hasta que retire su consentimiento.
        </p>
      </Part>

      <Part title="Sus derechos">
        <p>
          Puede pedir acceso a sus datos y a una copia de su historia clínica, corregirlos, suprimirlos (salvo lo que la ley obliga a conservar), oponerse,
          limitar su uso y llevárselos a otro profesional, escribiendo a {or(clinic.email, "correo de la clínica")} o en la propia clínica. Si cree que no
          se respetan, puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).
        </p>
      </Part>

      <Part title="Consentimientos opcionales">
        <ul className="flex flex-col gap-1.5">
          {CONSENTS.map((c) => (
            <li key={c.id} className="grid grid-cols-[auto_auto_1fr] items-start gap-x-3">
              <span className="flex items-center gap-1 pt-1 text-sm">{box(privacy.consents?.[c.id] === true)} Sí</span>
              <span className="flex items-center gap-1 pt-1 text-sm">{box(privacy.consents?.[c.id] === false)} No</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      </Part>

      <section className="mt-2 grid grid-cols-1 gap-x-6 gap-y-4 break-inside-avoid sm:grid-cols-2 print:grid-cols-2">
        <p className="flex flex-col gap-6">
          <span>
            Paciente: <span className="font-semibold">{patientName}</span>
          </span>
          <span className="border-t border-text pt-1 text-sm text-text-muted">DNI y firma</span>
        </p>
        <p className="flex flex-col gap-6">
          <span>
            Representante legal (menores de 16 años o tutela): <span className="font-semibold">{privacy.signedBy ?? ""}</span>
          </span>
          <span className="border-t border-text pt-1 text-sm text-text-muted">DNI y firma</span>
        </p>
        <p className="flex flex-col gap-6">
          <span>He recibido y leído esta información.</span>
          <span className="border-t border-text pt-1 text-sm text-text-muted">
            Fecha{privacy.informedAt ? `: ${privacy.informedAt.split("-").reverse().join("/")}` : ""}
          </span>
        </p>
      </section>
    </article>
  );
}
