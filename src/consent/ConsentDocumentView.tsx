// Un consentimiento tal como se lee y se imprime: la clínica, el paciente (y su representante), quién informa, lo
// que se va a hacer, sus riesgos, la declaración, las firmas y el recuadro para retirarlo.
import { fmtDate } from "../app/format";
import { docVars, MADE_WITH, Watermark } from "../brand/docs";
import type { Signatures } from "../data/consents";
import { LogoMark } from "../ui/Logo";
import type { ConsentDocument } from "./types";

const day = (iso: string) => fmtDate(iso.length === 10 ? `${iso}T12:00:00` : iso);

function SignatureBox({ label, name, image }: { label: string; name: string; image?: string }) {
  return (
    <div className="flex flex-col gap-1 break-inside-avoid">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex h-24 items-end justify-center border-b border-text">
        {image && <img src={image} alt={`Firma: ${name}`} className="max-h-24 max-w-full object-contain" />}
      </div>
      <span className="text-sm">{name || "Nombre:"}</span>
    </div>
  );
}

export function ConsentDocumentView({
  doc,
  signatures = {},
  revokedAt,
  revokeNote,
}: {
  doc: ConsentDocument;
  signatures?: Signatures;
  revokedAt?: string | null;
  revokeNote?: string;
}) {
  const signer = doc.representative ? `${doc.representative.name} (${doc.representative.relation || "representante legal"})` : doc.patient.name;
  return (
    // Con los colores de la marca con la que se firmó (o los de OmniClin): aunque la clínica cambie de marca, este no cambia.
    <article className="relative flex flex-col gap-4 text-[15px] leading-relaxed print:text-[11pt]" style={docVars(doc.brand)}>
      <Watermark brand={doc.brand} />
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        {doc.brand && (
          <p className="flex items-center gap-2 pb-1">
            <LogoMark size={32} brand={doc.brand} />
            <span className="flex flex-col">
              <span className="text-lg leading-tight font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
                {doc.brand.name}
              </span>
              {doc.brand.slogan && <span className="text-sm font-semibold text-brand-ink">{doc.brand.slogan}</span>}
            </span>
          </p>
        )}
        <p className="text-sm text-text-muted">{[doc.clinic.name, doc.clinic.taxId && `NIF ${doc.clinic.taxId}`, doc.clinic.address].filter(Boolean).join(" · ") || "[Datos de la clínica]"}</p>
        <h2 className="text-xl text-brand-ink">Consentimiento informado: {doc.title}</h2>
        <p className="text-sm text-text-muted">Documento de información y consentimiento por escrito (Ley 41/2002, arts. 8 y 10) · versión {doc.version}</p>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 print:grid-cols-2">
        <div>
          <dt className="inline font-semibold">Paciente: </dt>
          <dd className="inline">
            {doc.patient.name}
            {doc.patient.birthDate && ` · nacido/a el ${day(doc.patient.birthDate)}`}
            {doc.patient.idDoc && ` · DNI/NIE ${doc.patient.idDoc}`}
          </dd>
        </div>
        {doc.representative && (
          <div>
            <dt className="inline font-semibold">Representante: </dt>
            <dd className="inline">
              {doc.representative.name}
              {doc.representative.relation && ` (${doc.representative.relation})`}
              {doc.representative.idDoc && ` · DNI/NIE ${doc.representative.idDoc}`}
            </dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Fisioterapeuta que informa: </dt>
          <dd className="inline">
            {doc.professional.name || "—"}
            {doc.professional.license && ` · nº de colegiado ${doc.professional.license}`}
          </dd>
        </div>
      </dl>

      {doc.sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-1 break-inside-avoid">
          <h3 className="text-base font-semibold text-brand-ink">{s.title}</h3>
          {s.items.length === 1 ? (
            <p>{s.items[0]}</p>
          ) : (
            <ul className="list-disc pl-5">
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-2 break-inside-avoid">
        <h3 className="text-base font-semibold text-brand-ink">Declaración</h3>
        <p>
          Yo, {signer}, declaro que he leído (o me han leído) este documento, que lo he entendido, que he podido preguntar todo lo que he querido y
          que me han respondido. Sé que el resultado no se puede garantizar, que puedo retirar este consentimiento por escrito en cualquier
          momento y que recibo una copia. Por eso, <b>doy mi consentimiento</b> para que se me
          {doc.representative ? " (o a la persona a la que represento) " : " "}
          aplique {doc.techniques.length ? doc.techniques.join(", ").toLowerCase() : doc.title.toLowerCase()}.
        </p>
        <p>
          En {doc.place || "________________"}, a {day(doc.date)}.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
          <SignatureBox label={doc.representative ? "Firma del representante" : "Firma del paciente"} name={doc.representative?.name ?? doc.patient.name} image={signatures.patient} />
          <SignatureBox label="Firma del fisioterapeuta" name={doc.professional.name} image={signatures.professional} />
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border p-3 break-inside-avoid">
        <h3 className="text-base font-semibold text-brand-ink">Retirada del consentimiento</h3>
        <p>
          Retiro el consentimiento que di en este documento y asumo las consecuencias que me han explicado.{" "}
          {revokedAt ? (
            <b>Retirado el {day(revokedAt)}{revokeNote ? `: ${revokeNote}` : "."}</b>
          ) : (
            "Fecha: ____ / ____ / ________"
          )}
        </p>
        <SignatureBox label={doc.representative ? "Firma del representante" : "Firma del paciente"} name={doc.representative?.name ?? doc.patient.name} image={signatures.revocation} />
      </section>
      <p className="text-xs text-text-muted">{MADE_WITH}</p>
    </article>
  );
}
