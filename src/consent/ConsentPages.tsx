// Consentimientos informados de un paciente (src/consent/README.md): los firmados, los que propone su anamnesis
// y los demás; prepararlos con lo que se va a hacer, firmarlos en la pantalla o en papel, imprimirlos y retirarlos.
import { FilePen, Printer, ShieldAlert, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getAnamnesis } from "../data/clinical";
import { getConsent, listConsents, revokeConsent, saveSignedConsent, type Signatures, type SignedConsent } from "../data/consents";
import { getDb } from "../data/db";
import { ADULT_CONSENT_AGE, getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { TopBar } from "../ui/AppBar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, RowLink } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";
import { SignaturePad } from "../ui/SignaturePad";
import { useToast } from "../ui/Toast";
import { ConsentDocumentView } from "./ConsentDocumentView";
import { consentContext } from "./context";
import { precautionLabel } from "./precautions";
import { buildSections, TEMPLATES, templateById } from "./templates";
import type { ConsentContext, ConsentDocument, ConsentTemplate } from "./types";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const base = (id: string) => `/pacientes/${id}/consentimientos`;

/** El paciente, su anamnesis (del motivo que se ve) y lo que importa para los consentimientos. */
async function loadAll(id: string) {
  const db = getDb();
  const [patient, anamnesis, consents, clinic] = await Promise.all([getPatient(db, id), getAnamnesis(db, id), listConsents(db, id), getClinic(db)]);
  const ctx = patient ? consentContext(patient, anamnesis?.answers ?? {}) : null;
  return { patient, hasAnamnesis: !!anamnesis, consents, clinic, ctx };
}

/** Vigente: firmado y no retirado. */
const active = (consents: SignedConsent[], template: string) => consents.find((c) => c.template === template && !c.revokedAt);

/** Avisos para el fisioterapeuta: lo que la anamnesis dice en texto y no está marcado. */
function DetectedWarning({ id, ctx }: { id: string; ctx: ConsentContext }) {
  if (!ctx.detected.length) return null;
  return (
    <Alert tone="warning" title="Revisa las precauciones de la anamnesis">
      <ul className="list-disc pl-5">
        {ctx.detected.map((d) => (
          <li key={d.precaution}>
            Pone «{d.word}»: ¿{precautionLabel(d.precaution).toLowerCase()}?
          </li>
        ))}
      </ul>
      Si es así, márcalo en{" "}
      <Link className="underline" to={`/pacientes/${id}/anamnesis`}>
        Anamnesis → Precauciones
      </Link>{" "}
      para que salga en los consentimientos.
    </Alert>
  );
}

// ---------- La lista ----------

export function ConsentListPage() {
  const { id = "" } = useParams();
  const data = useAsync(() => loadAll(id), [id]);
  if (!data.data) return <Page title="Consentimientos" backTo={`/pacientes/${id}`}>{data.error ? <LoadError error={data.error} /> : <Loading />}</Page>;
  const { patient, consents, ctx, hasAnamnesis } = data.data;
  if (!patient || !ctx) return <Page title="Consentimientos" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  const row = (t: ConsentTemplate, reason: string | null) => {
    const absolute = t.personal(ctx).filter((r) => r.absolute);
    return (
      <RowLink
        key={t.id}
        to={`${base(id)}/nuevo?tipo=${t.id}`}
        icon={absolute.length ? ShieldAlert : FilePen}
        tone={absolute.length ? "danger" : "accent"}
        title={t.title}
        subtitle={absolute.length ? "Contraindicado según la anamnesis" : [reason, t.written === "required" ? "por escrito obligatorio" : null].filter(Boolean).join(" · ") || t.summary}
        warn={!!absolute.length}
      />
    );
  };
  const proposed = TEMPLATES.map((t) => ({ t, reason: t.suggest(ctx) })).filter(({ t, reason }) => reason && !active(consents, t.id));
  const others = TEMPLATES.filter((t) => !proposed.some((p) => p.t.id === t.id) && !active(consents, t.id));

  return (
    // Un documento de la ficha, como el informe: se abre desde el Resumen y vuelve a él (sin las pestañas).
    <Page title="Consentimientos" backTo={`/pacientes/${id}`} backLabel={patient.name}>
      <p className="text-sm text-text-muted">
        Se preparan con su anamnesis{hasAnamnesis ? "" : " (aún sin rellenar)"}: sus riesgos personales salen solos. Se firman en la pantalla o en papel.
      </p>
      <DetectedWarning id={id} ctx={ctx} />
      {consents.length > 0 && (
        <Group title="Firmados">
          {consents.map((c) => (
            <RowLink
              key={c.id}
              to={`${base(id)}/${c.id}`}
              icon={FilePen}
              title={c.title}
              subtitle={c.revokedAt ? `Retirado el ${fmtDate(c.revokedAt)}` : `Firmado el ${fmtDate(c.signedAt)} ${c.method === "screen" ? "en la pantalla" : "en papel"}`}
              warn={!!c.revokedAt}
              tone={c.revokedAt ? "warning" : "accent"}
            />
          ))}
        </Group>
      )}
      {proposed.length > 0 && <Group title="Propuestos para este paciente">{proposed.map(({ t, reason }) => row(t, reason))}</Group>}
      {others.length > 0 && <Group title="Otros">{others.map((t) => row(t, null))}</Group>}
      <p className="text-sm text-text-muted">
        Modelos orientativos, no validados clínica ni legalmente: revísalos con tu colegio profesional o tu asesoría antes de usarlos.
      </p>
    </Page>
  );
}

// ---------- Preparar y firmar ----------

export function ConsentNewPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const t = templateById(params.get("tipo") ?? "");
  const data = useAsync(() => loadAll(id), [id]);
  const [techniques, setTechniques] = useState<string[] | null>(null);
  const [form, setForm] = useState({ professional: "", license: "", idDoc: "", place: "", date: today(), repName: "", repIdDoc: "", repRelation: "" });
  const [withRep, setWithRep] = useState<boolean | null>(null);
  const [step, setStep] = useState<"edit" | "sign">("edit");
  const [signatures, setSignatures] = useState<Signatures>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Valores de partida: el fisioterapeuta y la localidad de la clínica, y las técnicas que nombra el plan.
  useEffect(() => {
    if (!data.data || !t || techniques) return;
    const { clinic, ctx } = data.data;
    setForm((f) => ({ ...f, professional: clinic.professional, license: clinic.license, place: clinic.city, idDoc: f.idDoc || (data.data?.patient?.dni ?? "") }));
    // La primera palabra de cada técnica («punción», «ultrasonido»…) escrita en el plan.
    const first = (label: string) => label.toLowerCase().split(" ")[0]!.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const named = t.techniques.filter((tech) => ctx?.planText.includes(first(tech.label)));
    setTechniques((named.length ? named : t.id === "general" ? t.techniques : []).map((x) => x.id));
    const age = ctx?.age ?? null;
    setWithRep(age !== null && age < ADULT_CONSENT_AGE);
  }, [data.data, t, techniques]);

  const doc = useMemo<ConsentDocument | null>(() => {
    if (!data.data?.patient || !data.data.ctx || !t || !techniques) return null;
    const { patient, clinic, ctx } = data.data;
    return {
      templateId: t.id,
      version: t.version,
      title: t.title,
      clinic: { name: clinic.name, taxId: clinic.taxId, address: clinic.address },
      professional: { name: form.professional.trim(), license: form.license.trim() },
      patient: { name: patient.name, birthDate: patient.birthDate, idDoc: form.idDoc.trim() },
      representative: withRep ? { name: form.repName.trim(), idDoc: form.repIdDoc.trim(), relation: form.repRelation.trim() } : null,
      techniques: t.techniques.filter((x) => techniques.includes(x.id)).map((x) => x.label),
      sections: buildSections(t, ctx, techniques),
      date: form.date || today(),
      place: form.place.trim(),
    };
  }, [data.data, t, techniques, form, withRep]);

  const back = base(id);
  if (!t) return <Page title="Consentimiento" backTo={back} tabs={false}><LoadError error={new Error("Este consentimiento no existe.")} /></Page>;
  if (data.error) return <Page title={t.title} backTo={back} tabs={false}><LoadError error={data.error} /></Page>;
  if (!data.data || !doc || withRep === null || !techniques) return <Page title={t.title} backTo={back} tabs={false}><Loading /></Page>;
  const { ctx } = data.data;
  const absolute = ctx ? t.personal(ctx).filter((r) => r.absolute) : [];
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }) });

  const save = async (method: "screen" | "paper") => {
    setError(null);
    if (t.techniques.length && !techniques.length) return setError("Marca al menos una técnica de las que vas a usar.");
    setSaving(true);
    try {
      const cid = await saveSignedConsent(getDb(), id, doc, method, signatures);
      toast(method === "screen" ? "Consentimiento firmado" : "Consentimiento firmado en papel guardado", "success");
      navigate(`${back}/${cid}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      <div className="print:hidden">
        <TopBar title={t.title} backTo={back} backLabel="Consentimientos" />
      </div>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-4 print:hidden">
          {absolute.length > 0 && (
            <Alert tone="danger" title="Contraindicado según la anamnesis">
              <ul className="list-disc pl-5">
                {absolute.map((r) => (
                  <li key={r.text}>{r.text}</li>
                ))}
              </ul>
            </Alert>
          )}
          {ctx && <DetectedWarning id={id} ctx={ctx} />}
          {!data.data.clinic.name && (
            <Alert tone="warning" title="Faltan los datos de la clínica">
              El documento sale sin el nombre, el NIF ni la dirección del centro. Rellénalos en{" "}
              <Link className="underline" to="/ajustes/clinica">
                Ajustes → Clínica y protección de datos
              </Link>
              .
            </Alert>
          )}
          {step === "edit" ? (
            <Card className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                {t.written === "required" ? "Por escrito obligatorio (Ley 41/2002, art. 8): " : "Por escrito recomendado: "}
                {t.summary}
              </p>
              {t.techniques.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-semibold">Lo que se va a hacer</legend>
                  {t.techniques.map((x) => (
                    <label key={x.id} className="flex min-h-11 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-accent"
                        checked={techniques.includes(x.id)}
                        onChange={(e) => setTechniques(e.target.checked ? [...techniques, x.id] : techniques.filter((y) => y !== x.id))}
                      />
                      <span>{x.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Fisioterapeuta que informa" autoComplete="name" {...field("professional")} />
                <TextField label="Nº de colegiado" autoComplete="off" {...field("license")} />
                <TextField label="DNI/NIE del paciente" hint="Opcional." autoComplete="off" {...field("idDoc")} />
                <TextField label="Localidad" autoComplete="address-level2" {...field("place")} />
              </div>
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={withRep} onChange={(e) => setWithRep(e.target.checked)} />
                <span>
                  Firma un representante
                  <span className="block text-sm text-text-muted">
                    Menores de {ADULT_CONSENT_AGE} años (se le escucha según su madurez) o personas con medidas de apoyo. Desde los {ADULT_CONSENT_AGE} firma el
                    propio paciente.
                  </span>
                </span>
              </label>
              {withRep && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextField label="Nombre del representante" autoComplete="off" {...field("repName")} />
                  <TextField label="DNI/NIE" autoComplete="off" {...field("repIdDoc")} />
                  <TextField label="Relación" placeholder="Madre, padre, tutor…" autoComplete="off" {...field("repRelation")} />
                </div>
              )}
              {error && <Alert tone="danger" title={error} />}
              <Button size="lg" icon={<FilePen aria-hidden="true" className="size-5" />} onClick={() => (t.techniques.length && !techniques.length ? setError("Marca al menos una técnica de las que vas a usar.") : (setError(null), setStep("sign"), window.scrollTo({ top: 0 })))}>
                Firmar en la pantalla
              </Button>
              <Button variant="secondary" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
                Imprimir para firmar en papel
              </Button>
              <Button variant="ghost" loading={saving} onClick={() => void save("paper")}>
                Ya está firmado en papel: guardarlo
              </Button>
            </Card>
          ) : (
            <Card className="flex flex-col gap-4">
              <p>Que lo lea abajo y pregunte lo que necesite. Después, las dos firmas.</p>
              <SignaturePad
                label={withRep ? `Firma del representante (${form.repName || "nombre"})` : `Firma de ${data.data.patient?.name}`}
                onChange={(png) => setSignatures((s) => ({ ...s, patient: png ?? undefined }))}
              />
              <SignaturePad label={`Firma del fisioterapeuta (${form.professional || "nombre"})`} onChange={(png) => setSignatures((s) => ({ ...s, professional: png ?? undefined }))} />
              {error && <Alert tone="danger" title={error} />}
              <Button size="lg" loading={saving} onClick={() => void save("screen")}>
                Guardar el consentimiento firmado
              </Button>
              <Button variant="secondary" onClick={() => setStep("edit")}>
                Volver a los datos
              </Button>
            </Card>
          )}
        </div>
        <div className="theme-light rounded-lg border border-border bg-white p-6 text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <ConsentDocumentView doc={doc} signatures={signatures} />
        </div>
      </main>
    </div>
  );
}

// ---------- Uno firmado ----------

export function ConsentViewPage() {
  const { id = "", cid = "" } = useParams();
  const toast = useToast();
  const data = useAsync(() => getConsent(getDb(), cid), [cid]);
  const [revoking, setRevoking] = useState(false);
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = base(id);
  const c = data.data;

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      <div className="print:hidden">
        <TopBar title={c?.title ?? "Consentimiento"} backTo={back} backLabel="Consentimientos" />
      </div>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        {data.error && <LoadError error={data.error} />}
        {data.data === undefined && !data.error && <Loading />}
        {data.data === null && <LoadError error={new Error("Este consentimiento no existe.")} />}
        {c && (
          <>
            <div className="flex flex-col gap-3 print:hidden">
              {c.revokedAt ? (
                <Alert tone="warning" title={`Retirado el ${fmtDate(c.revokedAt)}`}>
                  {c.revokeNote || "El paciente retiró este consentimiento."}
                </Alert>
              ) : (
                <Alert tone="success" title={`Firmado el ${fmtDate(c.signedAt)} ${c.method === "screen" ? "en la pantalla" : "en papel"}`}>
                  {c.method === "paper" ? "Guarda la hoja firmada con su historia clínica." : "Las firmas se guardan con el documento, tal como se firmó."}
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
                  Imprimir
                </Button>
                {!c.revokedAt && (
                  <Button variant="ghost" className="text-danger" icon={<Undo2 aria-hidden="true" className="size-5" />} onClick={() => setRevoking(true)}>
                    Retirar el consentimiento
                  </Button>
                )}
              </div>
            </div>
            <div className="theme-light rounded-lg border border-border bg-white p-6 text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
              <ConsentDocumentView doc={c.document} signatures={c.signatures} revokedAt={c.revokedAt} revokeNote={c.revokeNote} />
            </div>
            <Sheet open={revoking} onClose={() => setRevoking(false)} title="¿Retirar el consentimiento?">
              <p>El paciente puede retirarlo en cualquier momento (Ley 41/2002, art. 8.5). Queda apuntado con la fecha de hoy; el documento firmado no se borra.</p>
              <TextField label="Motivo o lo que dice el paciente" hint="Opcional." value={note} onChange={(e) => setNote(e.target.value)} />
              <SignaturePad label="Firma del paciente (o su representante)" hint="Si está aquí; si no, imprime la hoja y que firme el recuadro de retirada." onChange={setSignature} />
              <Button
                variant="danger"
                block
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await revokeConsent(getDb(), c.id, note, signature ?? undefined);
                    toast("Consentimiento retirado");
                    setRevoking(false);
                    data.reload();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : String(e), "danger");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Retirar
              </Button>
              <Button variant="secondary" block onClick={() => setRevoking(false)}>
                Cancelar
              </Button>
            </Sheet>
          </>
        )}
      </main>
    </div>
  );
}
