// El texto informativo de protección de datos (RGPD, art. 13, y LOPDGDD, art. 11) que se entrega al paciente
// en la primera visita, con los consentimientos opcionales y el sitio para firmar. El texto sale de privacyText.ts con
// los datos de la clínica (Ajustes → Clínica y protección de datos) o, si ya se firmó en la pantalla, tal como se firmó.
// Es una plantilla: la clínica debe revisarla con su delegado de protección de datos.
import type { ReactNode } from "react";
import { CONSENTS, type ClinicInfo, type PatientPrivacy, type PrivacySection, type SignedPrivacySheet } from "../data/privacy";
import { privacySections, type Storage } from "./privacyText";

export type { Storage } from "./privacyText";

/** Lo que lleva la hoja: el texto, los permisos con su respuesta, quién firma, el día y, si se firmó en la pantalla, la firma. */
export type NoticeData = Pick<SignedPrivacySheet, "sections" | "consents" | "patientName" | "signedBy"> & { date?: string; signature?: string };

/** La hoja de ahora: el texto con los datos de la clínica y las respuestas apuntadas (sin firmar). */
export function liveNotice(clinic: ClinicInfo, storage: Storage, patientName: string, privacy: PatientPrivacy): NoticeData {
  return {
    sections: privacySections(clinic, storage),
    consents: CONSENTS.map((c) => ({ id: c.id, text: c.text, answer: privacy.consents?.[c.id] ?? null })),
    patientName,
    signedBy: privacy.signedBy?.trim() || undefined,
    date: privacy.informedAt,
  };
}

/** Lo que falta de la clínica va entre corchetes: en gris. */
function Text({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\[[^\]]+\])/).map((part, i) =>
        /^\[.*\]$/.test(part) ? (
          <span key={i} className="text-text-muted">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Part({ section }: { section: PrivacySection }) {
  return (
    <section className="flex flex-col gap-1 break-inside-avoid">
      <h3 className="text-base font-semibold text-brand-ink">{section.title}</h3>
      {section.paragraphs.map((p) => (
        <p key={p}>
          <Text>{p}</Text>
        </p>
      ))}
    </section>
  );
}

const box = (checked: boolean | undefined) => (
  <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-text text-xs leading-none">
    {checked ? "✕" : ""}
  </span>
);

function Signer({ label, name, image }: { label: string; name: ReactNode; image?: string }) {
  return (
    <p className="flex flex-col gap-1">
      <span>
        {label}: <span className="font-semibold">{name}</span>
      </span>
      <span className="flex h-20 items-end justify-center">{image && <img src={image} alt={`Firma: ${typeof name === "string" ? name : label}`} className="max-h-20 max-w-full object-contain" />}</span>
      <span className="border-t border-text pt-1 text-sm text-text-muted">DNI y firma</span>
    </p>
  );
}

export function PrivacyNotice({ data }: { data: NoticeData }) {
  return (
    <article aria-label="Información sobre protección de datos" className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
      <header className="flex flex-col gap-0.5 border-b border-border pb-2">
        <h2 className="text-lg text-brand-ink">Información sobre protección de datos</h2>
        <p className="text-sm text-text-muted">Para pacientes de fisioterapia · Reglamento (UE) 2016/679 y Ley Orgánica 3/2018</p>
      </header>

      {data.sections.map((s) => (
        <Part key={s.title} section={s} />
      ))}

      <section className="flex flex-col gap-1 break-inside-avoid">
        <h3 className="text-base font-semibold text-brand-ink">Permisos opcionales</h3>
        <ul className="flex flex-col gap-1.5">
          {data.consents.map((c) => (
            <li key={c.id} className="grid grid-cols-[auto_auto_1fr] items-start gap-x-3">
              <span className="flex items-center gap-1 pt-1 text-sm">{box(c.answer === true)} Sí</span>
              <span className="flex items-center gap-1 pt-1 text-sm">{box(c.answer === false)} No</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-2 grid grid-cols-1 gap-x-6 gap-y-4 break-inside-avoid sm:grid-cols-2 print:grid-cols-2">
        <Signer label="Paciente" name={data.patientName} image={data.signedBy ? undefined : data.signature} />
        <Signer label="Representante legal (menores de 16 años o tutela)" name={data.signedBy ?? ""} image={data.signedBy ? data.signature : undefined} />
        <p className="flex flex-col gap-6">
          <span>He recibido y leído esta información.</span>
          <span className="border-t border-text pt-1 text-sm text-text-muted">Fecha{data.date ? `: ${data.date.split("-").reverse().join("/")}` : ""}</span>
        </p>
      </section>
    </article>
  );
}
