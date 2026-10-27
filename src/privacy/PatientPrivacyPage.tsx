// Protección de datos de un paciente: el texto informativo para firmar en la pantalla o imprimir y firmar en papel, y
// lo que se registra en la app (cuándo se le entregó, quién firmó y sus consentimientos opcionales: fotos y vídeos,
// WhatsApp, docencia). Lo firmado en la pantalla se guarda tal cual, con la firma; las hojas anteriores se conservan.
import { FilePen, Printer, ShieldCheck } from "lucide-react";
import { TopBar } from "../ui/AppBar";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import {
  ADULT_CONSENT_AGE,
  ageOn,
  changedSinceSigned,
  clinicComplete,
  CONSENTS,
  getClinic,
  savePatientPrivacy,
  signPrivacySheet,
  type PatientPrivacy,
  type SignedPrivacySheet,
} from "../data/privacy";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, RowButton } from "../ui/Grouped";
import { SignaturePad } from "../ui/SignaturePad";
import { useToast } from "../ui/Toast";
import { cx } from "../ui/cx";
import { liveNotice, PrivacyNotice, type NoticeData, type Storage } from "./PrivacyNotice";
import { PRIVACY_TEXT_VERSION } from "./privacyText";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

export function PatientPrivacyPage() {
  const { id = "" } = useParams();
  const cloud = useCloud();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, clinic] = await Promise.all([getPatient(db, id), getClinic(db)]);
    return { patient, clinic };
  }, [id]);
  const [form, setForm] = useState<PatientPrivacy | null>(null);
  const [saving, setSaving] = useState(false);
  // Firmar en la pantalla: la firma que se va dibujando; y una hoja ya firmada que se está viendo.
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SignedPrivacySheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (data.data?.patient) setForm({ informedAt: today(), ...data.data.patient.privacy });
  }, [data.data]);

  const back = `/pacientes/${id}`;
  const bar = (
    <div className="print:hidden">
      <TopBar title="Protección de datos" backTo={back} />
    </div>
  );
  if (data.error) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={data.error} /></main></>;
  if (!data.data || !form) return <>{bar}<main className="mx-auto max-w-3xl p-4"><Loading /></main></>;
  const { patient, clinic } = data.data;
  if (!patient) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={new Error("Este paciente no existe.")} /></main></>;

  const storage: Storage = !cloud ? "local" : cloud.sync.store.kind === "server" ? "server" : "cloud";
  const years = ageOn(patient.birthDate);
  const minor = years !== null && years < ADULT_CONSENT_AGE;
  const saved = patient.privacy;
  const sheets = saved.sheets ?? [];
  const last = sheets.at(-1);
  const live = liveNotice(clinic, storage, patient.name, signing ? { ...form, informedAt: today() } : form);
  const shown: NoticeData = viewing ?? { ...live, signature: signing ? (signature ?? undefined) : undefined };
  const signer = form.signedBy?.trim() || patient.name;

  const saveSigned = async () => {
    setError(null);
    if (!signature) return setError(`Falta la firma de ${signer}.`);
    setSaving(true);
    try {
      const date = today();
      await signPrivacySheet(getDb(), id, form, {
        version: PRIVACY_TEXT_VERSION,
        date,
        at: new Date().toISOString(),
        method: "screen",
        patientName: patient.name,
        signedBy: live.signedBy,
        sections: live.sections,
        consents: live.consents,
        signature,
      });
      toast("Hoja de protección de datos firmada", "success");
      setSigning(false);
      setSignature(null);
      data.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-4 print:hidden">
          {last && last.date === saved.informedAt ? (
            changedSinceSigned(saved) ? (
              <Alert tone="warning" title={`Firmada en la pantalla el ${fmtDate(`${last.date}T12:00:00`)}, pero sus permisos han cambiado`}>
                Que firme otra vez la hoja con lo de ahora: la anterior se conserva.
              </Alert>
            ) : (
              <Alert tone="success" title={`Firmada en la pantalla el ${fmtDate(`${last.date}T12:00:00`)}`}>
                La hoja firmada se guarda en su ficha, tal como se firmó.
              </Alert>
            )
          ) : saved.informedAt ? (
            <Alert tone="success" title={`Información entregada el ${fmtDate(`${saved.informedAt}T12:00:00`)}`}>
              Guarda la hoja firmada con su historia clínica.
            </Alert>
          ) : (
            <Alert tone="warning" title="Aún no consta que se le haya dado esta información">
              Apunta abajo sus respuestas y que la firme en la pantalla. O imprímela, que la firme en papel, y guarda la fecha.
            </Alert>
          )}
          {!clinicComplete(clinic) && (
            <Alert tone="warning" title="Faltan los datos de la clínica">
              <p>
                El texto necesita al menos el nombre y el correo del responsable. Rellénalos en{" "}
                <Link className="underline" to="/ajustes/clinica">
                  Ajustes → Clínica y protección de datos
                </Link>
                .
              </p>
            </Alert>
          )}
          {cloud && cloud.sync.store.kind === "drive" && !clinic.googleDpa && (
            <Alert tone="warning" title="Falta el contrato con Google">
              Para guardar historias clínicas en Google Drive hace falta un contrato de encargado del tratamiento con Google (cuentas de Google Workspace de la
              clínica). Con una cuenta de Gmail normal no lo hay.
            </Alert>
          )}

          {viewing ? (
            <Card className="flex flex-col gap-3">
              <p>
                Hoja firmada en la pantalla el {fmtDate(`${viewing.date}T12:00:00`)}
                {viewing.signedBy ? ` por ${viewing.signedBy}` : ""}, tal como se firmó.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
                  Imprimir
                </Button>
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  Volver a la hoja de ahora
                </Button>
              </div>
            </Card>
          ) : signing ? (
            <Card className="flex flex-col gap-4">
              <p>Que lea la hoja de abajo, con sus respuestas, y pregunte lo que necesite. Después, su firma.</p>
              <SignaturePad label={form.signedBy?.trim() ? `Firma del representante (${form.signedBy.trim()})` : `Firma de ${patient.name}`} onChange={setSignature} />
              {error && <Alert tone="danger" title={error} />}
              <Button size="lg" loading={saving} onClick={() => void saveSigned()}>
                Guardar la hoja firmada
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSigning(false);
                  setSignature(null);
                  setError(null);
                }}
              >
                Volver a las respuestas
              </Button>
            </Card>
          ) : (
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
              icon={<FilePen aria-hidden="true" className="size-5" />}
              onClick={() => {
                setError(null);
                setSigning(true);
                window.scrollTo({ top: 0 });
              }}
            >
              Firmar en la pantalla
            </Button>
            <Button variant="secondary" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
              Imprimir para firmar en papel
            </Button>
            <Button
              variant="secondary"
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
            <p className="text-sm text-text-muted">
              «Guardar» apunta la fecha y las respuestas sin firmar aquí: cuando la ha firmado en papel (sale la hoja de abajo, con sus respuestas
              marcadas), o si cambia un permiso de palabra.
            </p>
          </Card>
          )}

          {sheets.length > 0 && (
            <Group title="Hojas firmadas en la pantalla">
              {[...sheets].reverse().map((sh) => (
                <RowButton
                  key={sh.at}
                  icon={ShieldCheck}
                  title={`Firmada el ${fmtDate(`${sh.date}T12:00:00`)}`}
                  subtitle={[
                    sh.signedBy ? `por ${sh.signedBy}` : null,
                    ...sh.consents.filter((c) => c.answer !== null).map((c) => `${CONSENTS.find((x) => x.id === c.id)?.label ?? c.id}: ${c.answer ? "sí" : "no"}`),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onClick={() => {
                    setSigning(false);
                    setViewing(sh);
                    window.scrollTo({ top: 0 });
                  }}
                />
              ))}
            </Group>
          )}
        </div>

        <div className="theme-light rounded-lg border border-border bg-white p-6 text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <PrivacyNotice data={shown} />
        </div>
        <p className="text-sm text-text-muted print:hidden">
          Es una plantilla basada en el RGPD, la LOPDGDD y la Ley 41/2002, no asesoramiento legal: revísala con el delegado de protección de datos de la
          clínica.
        </p>
      </main>
    </div>
  );
}
