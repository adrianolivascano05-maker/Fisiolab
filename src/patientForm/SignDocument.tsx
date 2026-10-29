// Firmar por enlace, en el móvil del paciente (PublicFormPage.tsx): la hoja de protección de datos, con su respuesta a
// cada permiso, o un consentimiento informado, ya firmado por el fisioterapeuta que informa. Se lee entero, como en la
// pantalla de la clínica, y se firma con el dedo. Lo que vuelve (SignedAnswers) lleva el documento tal como lo leyó.
import type { ConsentToSign, PrivacyToSign } from "../clinical/patientForms";
import { ConsentDocumentView } from "../consent/ConsentDocumentView";
import type { Consent } from "../data/privacy";
import { PrivacyNotice } from "../privacy/PrivacyNotice";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SignaturePad } from "../ui/SignaturePad";

type Answers = Record<string, unknown>;
const consentsOf = (a: Answers) => (typeof a.consents === "object" && a.consents !== null ? (a.consents as Partial<Record<Consent, boolean>>) : {});
const signatureOf = (a: Answers) => (typeof a.signature === "string" ? a.signature : undefined);

/** Lo que falta para poder enviar (o null): cada permiso contestado y la firma. */
export function signMissing(kind: "privacy" | "consent", toSign: PrivacyToSign | ConsentToSign, a: Answers): string | null {
  if (kind === "privacy") {
    const missing = (toSign as PrivacyToSign).consents.filter((c) => typeof consentsOf(a)[c.id] !== "boolean");
    if (missing.length) return `Contesta sí o no a: ${missing.map((c) => c.label).join(", ")}.`;
  }
  return signatureOf(a) ? null : "Falta tu firma: firma con el dedo en el recuadro.";
}

/** Lo que se manda: la firma, el documento tal como lo leyó y, en la hoja de protección de datos, sus permisos. */
export function signedResponse(kind: "privacy" | "consent", toSign: PrivacyToSign | ConsentToSign, a: Answers): Answers {
  return kind === "privacy"
    ? { privacy: toSign, consents: consentsOf(a), signature: signatureOf(a) }
    : { consent: toSign, signature: signatureOf(a) };
}

export function SignPrivacy({ toSign, answers, onChange }: { toSign: PrivacyToSign; answers: Answers; onChange: (a: Answers) => void }) {
  const consents = consentsOf(answers);
  const signer = toSign.signedBy?.trim() || toSign.patientName;
  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg">Tus permisos</h2>
        <p className="text-sm text-text-muted">Son opcionales: puedes decir que no y te atienden igual. Puedes cambiarlos cuando quieras.</p>
        {toSign.consents.map((c) => (
          <fieldset key={c.id} className="flex flex-col gap-2">
            <legend className="font-semibold">{c.label}</legend>
            <p className="text-sm">{c.text}</p>
            <div className="flex flex-wrap gap-2">
              {([
                [true, "Sí"],
                [false, "No"],
              ] as const).map(([value, label]) => (
                <label key={label} className="relative">
                  <input
                    type="radio"
                    name={`permiso-${c.id}`}
                    checked={consents[c.id] === value}
                    onChange={() => onChange({ ...answers, consents: { ...consents, [c.id]: value } })}
                    className="peer sr-only"
                  />
                  <span
                    className={cx(
                      "tap inline-flex items-center rounded-md border px-5 font-semibold",
                      "border-border-input bg-bg peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                    )}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Card>
      <div className="theme-light rounded-lg border border-border bg-white p-4 text-text">
        <PrivacyNotice
          data={{
            sections: toSign.sections,
            consents: toSign.consents.map((c) => ({ id: c.id, text: c.text, answer: typeof consents[c.id] === "boolean" ? consents[c.id]! : null })),
            patientName: toSign.patientName,
            signedBy: toSign.signedBy,
            signature: signatureOf(answers),
          }}
        />
      </div>
      <Card className="flex flex-col gap-3">
        <SignaturePad
          label={toSign.signedBy?.trim() ? `Firma del representante (${signer})` : `Tu firma (${signer})`}
          hint="Con el dedo, dentro del recuadro."
          onChange={(png) => onChange({ ...answers, signature: png ?? undefined })}
        />
      </Card>
    </>
  );
}

export function SignConsent({ toSign, answers, onChange }: { toSign: ConsentToSign; answers: Answers; onChange: (a: Answers) => void }) {
  const doc = toSign.document;
  const signer = doc.representative ? `${doc.representative.name} (${doc.representative.relation || "representante legal"})` : doc.patient.name;
  return (
    <>
      <div className="theme-light rounded-lg border border-border bg-white p-4 text-text">
        <ConsentDocumentView doc={doc} signatures={{ professional: toSign.professionalSignature, patient: signatureOf(answers) }} />
      </div>
      <Card className="flex flex-col gap-3">
        <p className="text-sm">Si tienes dudas, no firmes: pregúntalas en la clínica antes. Firmarlo no te obliga: puedes retirarlo cuando quieras.</p>
        <SignaturePad label={`Firma de ${signer}`} hint="Con el dedo, dentro del recuadro." onChange={(png) => onChange({ ...answers, signature: png ?? undefined })} />
      </Card>
    </>
  );
}
