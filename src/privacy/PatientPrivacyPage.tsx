// Protección de datos de un paciente: el texto informativo para imprimir y firmar, y lo que se registra en la app
// (cuándo se le entregó, quién firmó y sus consentimientos opcionales).
import { ChevronLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { ADULT_CONSENT_AGE, ageOn, clinicComplete, CONSENTS, getClinic, savePatientPrivacy, type PatientPrivacy } from "../data/privacy";
import { getPatient, getSetting } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { cx } from "../ui/cx";
import { PrivacyNotice, type Storage } from "./PrivacyNotice";
import { ENCRYPTION_KEY } from "../cloud/crypt";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

export function PatientPrivacyPage() {
  const { id = "" } = useParams();
  const cloud = useCloud();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, clinic, encrypted] = await Promise.all([getPatient(db, id), getClinic(db), getSetting(db, ENCRYPTION_KEY)]);
    return { patient, clinic, encrypted: !!encrypted };
  }, [id]);
  const [form, setForm] = useState<PatientPrivacy | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data.data?.patient) setForm({ informedAt: today(), ...data.data.patient.privacy });
  }, [data.data]);

  const back = `/pacientes/${id}`;
  const bar = (
    <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-[var(--layout-header)] max-w-3xl items-center gap-1 px-2">
        <Link to={back} aria-label="Volver" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>
        <h1 className="flex-1 truncate text-lg">Protección de datos</h1>
      </div>
    </div>
  );
  if (data.error) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={data.error} /></main></>;
  if (!data.data || !form) return <>{bar}<main className="mx-auto max-w-3xl p-4"><Loading /></main></>;
  const { patient, clinic, encrypted } = data.data;
  if (!patient) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={new Error("Este paciente no existe.")} /></main></>;

  const storage: Storage = !cloud ? "local" : encrypted ? "cloud-encrypted" : "cloud";
  const years = ageOn(patient.birthDate);
  const minor = years !== null && years < ADULT_CONSENT_AGE;
  const saved = patient.privacy;

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-4 print:hidden">
          {saved.informedAt ? (
            <Alert tone="success" title={`Información entregada el ${fmtDate(`${saved.informedAt}T12:00:00`)}`}>
              Guarda la hoja firmada con su historia clínica.
            </Alert>
          ) : (
            <Alert tone="warning" title="Aún no consta que se le haya dado esta información">
              Imprímela, que la lea y la firme, y apunta abajo la fecha y sus respuestas.
            </Alert>
          )}
          {!clinicComplete(clinic) && (
            <Alert tone="warning" title="Faltan los datos de la clínica">
              El texto necesita al menos el nombre y el correo del responsable. Rellénalos en{" "}
              <Link className="underline" to="/ajustes#proteccion-datos">
                Ajustes → Protección de datos
              </Link>
              .
            </Alert>
          )}
          {cloud && !clinic.googleDpa && (
            <Alert tone="warning" title="Falta el contrato con Google">
              Para guardar historias clínicas en Google Drive hace falta un contrato de encargado del tratamiento con Google (cuentas de Google Workspace de la
              clínica). Con una cuenta de Gmail normal no lo hay.
            </Alert>
          )}

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg">Lo que consta en la app</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Fecha de entrega" type="date" value={form.informedAt ?? ""} onChange={(e) => setForm({ ...form, informedAt: e.target.value || undefined })} />
              <TextField
                label="Firma el representante legal"
                autoComplete="off"
                value={form.signedBy ?? ""}
                placeholder="Nombre del padre, madre o tutor"
                hint={minor ? `Tiene ${years} años: firma su representante legal.` : "Solo si es menor de 16 años o está bajo tutela."}
                onChange={(e) => setForm({ ...form, signedBy: e.target.value })}
              />
            </div>
            {CONSENTS.map((c) => {
              const v = form.consents?.[c.id];
              const set = (value: boolean | undefined) => {
                const consents = { ...form.consents };
                if (value === undefined) delete consents[c.id];
                else consents[c.id] = value;
                setForm({ ...form, consents });
              };
              return (
                <fieldset key={c.id} className="flex flex-col gap-2">
                  <legend className="text-sm font-semibold">{c.label}</legend>
                  <p className="text-sm text-text-muted">{c.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      [true, "Sí"],
                      [false, "No"],
                      [undefined, "Sin preguntar"],
                    ] as const).map(([value, label]) => (
                      <label key={label} className="relative">
                        <input type="radio" name={`consent-${c.id}`} checked={v === value} onChange={() => set(value)} className="peer sr-only" />
                        <span
                          className={cx(
                            "tap inline-flex items-center rounded-md border px-4 font-semibold",
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
              );
            })}
            <Button
              size="lg"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await savePatientPrivacy(getDb(), id, form);
                  toast("Protección de datos guardada", "success");
                  data.reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "No se pudo guardar", "danger");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Guardar
            </Button>
          </Card>

          <Button variant="secondary" size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir para firmar
          </Button>
          <p className="text-sm text-text-muted">
            Sale la hoja de abajo, con sus respuestas marcadas si ya las has apuntado. También puedes guardarla en PDF desde el diálogo de impresión.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-white p-6 text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <PrivacyNotice clinic={clinic} storage={storage} patientName={patient.name} privacy={form} />
        </div>
        <p className="text-sm text-text-muted print:hidden">
          Es una plantilla basada en el RGPD, la LOPDGDD y la Ley 41/2002, no asesoramiento legal: revísala con el delegado de protección de datos de la
          clínica.
        </p>
      </main>
    </div>
  );
}
