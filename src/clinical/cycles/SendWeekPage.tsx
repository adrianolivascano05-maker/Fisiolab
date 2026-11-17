// «Enviar la semana al paciente» (src/data/cyclesShare.ts): qué semana, qué se le enseña (los kilos, el esfuerzo y la
// línea de fases, solo si el fisio lo marca), cómo lo verá, y el enlace por WhatsApp, correo o copiado. Debajo, los
// enlaces ya mandados de este plan, para volver a copiarlos o anularlos.
import { Copy, Link2, Mail, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { bumpData } from "../../app/dataVersion";
import { dayOf } from "../../app/dates";
import { LoadError, Loading, Page } from "../../app/Page";
import { useAsync } from "../../app/useAsync";
import { formLink, WEEK_KIND, type FormRequest } from "../../clinical/patientForms";
import { getToken } from "../../cloud/auth";
import { useCloud } from "../../cloud/cloudContext";
import { shortDay, weekDays, weekIndexOf } from "../../data/cycles";
import { addSent, cancelSent, loadSent, sentAlive, weekEnd, weekShare, type SentWeek, type ShareOptions } from "../../data/cyclesShare";
import { getDb } from "../../data/db";
import { getClinic, mayMessage } from "../../data/privacy";
import { uploadWeekLink } from "../../patientForm/createForm";
import { WeekView } from "../../patientForm/WeekView";
import { ContactNote } from "../../privacy/ContactNote";
import { mailtoUrl, waPhone, whatsappUrl } from "../../schedule/reminders";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { useToast } from "../../ui/Toast";
import { Guard } from "../pageKit";
import { effortLabel, Segmented, usePlan, usePlanParams } from "./parts";

/** Como mucho, una semana que acabe dentro de los 14 días que deja el servidor. */
const MAX_AHEAD = 14 * 86_400_000;

export function SendWeekPage() {
  const { id = "" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const data = usePlan(id, motivo);
  if (!data.data) return <Guard state={data} title="Enviar la semana" back={volver} />;
  if (!data.data.loaded) return <Navigate replace to={`/pacientes/${id}/ciclos?motivo=${encodeURIComponent(data.data.episode)}&volver=${encodeURIComponent(volver)}`} />;
  return <SendWeek patientId={id} data={data.data} volver={volver} />;
}

function SendWeek({ patientId, data, volver }: { patientId: string; data: NonNullable<ReturnType<typeof usePlan>["data"]>; volver: string }) {
  const cloud = useCloud();
  const toast = useToast();
  const loaded = data.loaded!;
  const { plan } = loaded;
  const patient = data.patient;
  const extra = useAsync(async () => {
    const db = getDb();
    const [clinic, sent] = await Promise.all([getClinic(db), loadSent(db, patientId, data.episode)]);
    return { clinicName: clinic.name || cloud?.clinic?.name || "", sent, now: Date.now() };
  }, [patientId, data.episode], { tables: ["settings"] });
  const [week, setWeek] = useState<number | null>(null);
  const [opts, setOpts] = useState<ShareOptions>({ kg: false, effort: false, plan: false });
  const [made, setMade] = useState<{ url: string; sent: SentWeek } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;
  const back = `/pacientes/${patientId}/ciclos?${q}`;

  if (extra.error) return <Page title="Enviar la semana" backTo={back} backLabel="Plan" tabs={false}><LoadError error={extra.error} /></Page>;
  if (!extra.data || !patient) return <Page title="Enviar la semana" backTo={back} backLabel="Plan" tabs={false}><Loading /></Page>;
  const { clinicName, sent, now } = extra.data;
  const today = weekIndexOf(plan, dayOf(new Date(now)));
  // Las semanas que se pueden mandar: esta (o la primera, si aún no ha empezado) y la siguiente, si tienen ejercicios.
  const first = Math.max(0, today);
  const candidates = [first, first + 1].filter((w) => weekShare(loaded, w, { kg: false, effort: false, plan: false }) && Date.parse(weekEnd(weekDays(plan, w)[1])) - now <= MAX_AHEAD);
  const chosen = week !== null && candidates.includes(week) ? week : (candidates[0] ?? null);
  const online = !!(cloud?.clinic && cloud.clinics);
  const share = chosen === null ? null : weekShare(loaded, chosen, opts);
  const expiresAt = chosen === null ? "" : weekEnd(weekDays(plan, chosen)[1]);
  const name = patient.name.trim().split(/\s+/)[0] ?? "";
  // Cómo lo verá: la misma página que abrirá en su móvil (sin las citas, que se ponen al crear el enlace).
  const preview: FormRequest | null = share ? { v: 1, clinic: clinicName, name, kind: WEEK_KIND, expiresAt, week: share, controller: { name: clinicName, email: "" } } : null;
  const weekLabel = (w: number) => {
    const [from, to] = weekDays(plan, w);
    return `Semana ${w + 1} · ${shortDay(from)} – ${shortDay(to)}`;
  };

  async function create() {
    if (!share || chosen === null) return;
    setBusy(true);
    try {
      const link = await uploadWeekLink(getDb(), cloud, { patientId, patientName: patient!.name, clinicName, week: share, expiresAt });
      const record: SentWeek = { id: link.id, key: link.key, week: chosen, sentAt: new Date().toISOString(), expiresAt };
      await addSent(getDb(), patientId, data.episode, record);
      bumpData("settings");
      setMade({ url: link.url, sent: record });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(s: SentWeek) {
    setBusy(true);
    try {
      const token = getToken();
      if (!token || !cloud?.clinic || !cloud.clinics) throw new Error("Tu sesión de Google ha caducado: vuelve a entrar en Ajustes → Cuenta y prueba otra vez.");
      await cloud.clinics.forms.remove(token, cloud.clinic.id, s.id);
      await cancelSent(getDb(), patientId, data.episode, s.id);
      bumpData("settings");
      if (made?.sent.id === s.id) setMade(null);
      toast("Enlace anulado: ya no se abre", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
      setCancelling(null);
    }
  }

  const toggle = (k: keyof ShareOptions) => (
    <label key={k} className="flex min-h-11 items-center gap-3">
      <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
      {k === "kg" ? "Con los kilos" : k === "effort" ? `Con el esfuerzo (${effortLabel(plan.effort)})` : "Con las fases («estás aquí») y el objetivo general"}
    </label>
  );

  return (
    <Page title="Enviar la semana" backTo={back} backLabel="Plan" tabs={false}>
      <p className="-mt-2 text-sm text-text-muted">
        {patient.name}
        {data.episodeName ? ` · ${data.episodeName}` : ""}
      </p>
      <p>Le llega un enlace para ver sus ejercicios en el móvil, sin cuenta ni app. Solo se lee: no tiene que rellenar nada. Caduca al acabar esa semana.</p>
      {!online && (
        <Alert tone="info" title="Hace falta el servidor de la clínica">
          Para mandar el enlace tienes que trabajar en una clínica con el servidor de OmniClin:{" "}
          <Link to="/ajustes/cuenta" className="py-3 font-semibold underline underline-offset-2">
            Ajustes › Cuenta de Google
          </Link>
          .
        </Alert>
      )}
      {chosen === null ? (
        <Alert tone="info" title="No hay ejercicios que mandar">
          Esta semana{today >= 0 ? " y la siguiente no tienen" : " no tiene"} ejercicios en el plan, o el plan ya ha terminado.{" "}
          <Link to={back} className="py-3 font-semibold underline underline-offset-2">
            Volver al plan
          </Link>
        </Alert>
      ) : made ? (
        <ShareLink url={made.url} sent={made.sent} weekText={weekLabel(made.sent.week)} name={name} clinicName={clinicName} patient={patient} onDone={() => setMade(null)} />
      ) : (
        <>
          {candidates.length > 1 && (
            <Segmented label="Qué semana" options={candidates} value={chosen} onChange={setWeek} render={(w) => (w === first && today >= 0 ? "Esta semana" : w === first ? "La primera" : "La siguiente")} />
          )}
          <p className="font-semibold">{weekLabel(chosen)}</p>
          <fieldset className="flex flex-col">
            <legend className="font-semibold">Qué se le enseña</legend>
            <p className="text-sm text-text-muted">Siempre: los ejercicios, las series y repeticiones (o el tiempo), «Cómo se hace» si lo has escrito y sus próximas citas.</p>
            {toggle("kg")}
            {plan.effort !== "none" && toggle("effort")}
            {toggle("plan")}
          </fieldset>
          <Button block size="lg" disabled={!online} loading={busy} icon={<Link2 aria-hidden="true" className="size-5" />} onClick={() => void create()}>
            Crear el enlace
          </Button>
          {preview && (
            <section aria-label="Así lo verá" className="flex flex-col gap-2">
              <h2 className="text-lg">Así lo verá</h2>
              <div className="rounded-md border border-border bg-surface p-3">
                <WeekView request={preview} preview />
              </div>
            </section>
          )}
        </>
      )}

      {sent.length > 0 && (
        <section aria-labelledby="h-mandados" className="flex flex-col gap-2">
          <h2 id="h-mandados" className="text-lg">
            Enlaces mandados
          </h2>
          <ul className="flex flex-col gap-2">
            {sent.map((s) => {
              const alive = sentAlive(s, now);
              return (
                <li key={s.id}>
                  <Card className="flex flex-col gap-2">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{weekLabel(s.week)}</span>
                      <span className={cx("rounded-pill px-2 py-0.5 text-xs font-semibold", alive ? "bg-success-soft text-success" : "bg-surface text-text-muted")}>
                        {s.cancelledAt ? "Anulado" : alive ? "Se puede abrir" : "Caducado"}
                      </span>
                    </p>
                    <p className="text-sm text-text-muted">Creado el {shortDay(s.sentAt.slice(0, 10))}</p>
                    {alive && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" icon={<Copy aria-hidden="true" className="size-4" />} onClick={() => void copy(formLink(s.id, s.key), toast)}>
                          Copiar el enlace
                        </Button>
                        {cancelling === s.id ? (
                          <>
                            <Button size="sm" variant="danger" loading={busy} onClick={() => void cancel(s)}>
                              Sí, anularlo
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setCancelling(null)}>
                              No
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-danger" disabled={!online} icon={<X aria-hidden="true" className="size-4" />} onClick={() => setCancelling(s.id)}>
                            Anular<span className="sr-only"> el enlace de la {weekLabel(s.week).toLowerCase()}</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Page>
  );
}

async function copy(url: string, toast: ReturnType<typeof useToast>) {
  try {
    await navigator.clipboard.writeText(url);
    toast("Enlace copiado", "success");
  } catch {
    toast("No se ha podido copiar: mantén pulsado el enlace", "danger");
  }
}

/** El mensaje con el enlace y por dónde mandarlo: WhatsApp y correo solo con su permiso de contacto. */
function ShareLink({
  url,
  sent,
  weekText,
  name,
  clinicName,
  patient,
  onDone,
}: {
  url: string;
  sent: SentWeek;
  weekText: string;
  name: string;
  clinicName: string;
  patient: NonNullable<NonNullable<ReturnType<typeof usePlan>["data"]>["patient"]>;
  onDone: () => void;
}) {
  const toast = useToast();
  const phone = waPhone(patient.phone);
  const consent = patient.privacy.consents?.contact;
  const until = new Date(Date.parse(sent.expiresAt) - 60_000).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const text = `Hola, ${name}. Aquí tienes tus ejercicios de la semana${clinicName ? ` de ${clinicName}` : ""}: ${url}\nEl enlace vale hasta el ${until}.`;
  const subject = `Tus ejercicios de la semana${clinicName ? ` · ${clinicName}` : ""}`;
  const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Enlace creado · {weekText}</p>
      {!mayMessage(consent) && (
        <Alert tone="warning" title={consent === false ? "No acepta WhatsApp ni correo" : "Falta su permiso de contacto"}>
          <ContactNote contact={consent} patientId={patient.id} extra="Dale el enlace en persona: que lo abra con su móvil en la consulta" className="text-text" />
        </Alert>
      )}
      <pre aria-label="Mensaje" className="whitespace-pre-wrap rounded-md bg-surface p-3 font-sans text-sm break-words">
        {text}
      </pre>
      <div className="flex flex-wrap gap-2">
        {phone && mayMessage(consent) && (
          <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}>
            <MessageCircle aria-hidden="true" className="size-5" /> WhatsApp
          </a>
        )}
        {patient.email && mayMessage(consent) && (
          <a href={mailtoUrl(patient.email, subject, text)} className={cx(link, "border border-border bg-bg hover:bg-surface")}>
            <Mail aria-hidden="true" className="size-5" /> Correo
          </a>
        )}
        <Button variant="secondary" icon={<Copy aria-hidden="true" className="size-5" />} onClick={() => void copy(url, toast)}>
          Copiar el enlace
        </Button>
      </div>
      {!phone && !patient.email && <p className="text-sm text-text-muted">No tiene móvil ni correo en su ficha: copia el enlace y dáselo como prefieras.</p>}
      <Button variant="ghost" className="self-start" onClick={onDone}>
        Mandar otra semana
      </Button>
    </Card>
  );
}
