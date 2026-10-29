// Ficha → Formularios para el paciente: mandarle su parte de la anamnesis o un cuestionario para que lo rellene desde
// su móvil, ver en qué está cada uno y volver a mandar el enlace. Las respuestas llegan solas (FormInbox.tsx); aquí
// también se pueden buscar a mano. ?enviar=anamnesis (o el id de un cuestionario) abre la hoja con eso elegido;
// ?compartir=<id> abre «Mandar el enlace» de uno ya creado (la hoja de protección de datos o un consentimiento para
// firmar, que se crean desde sus pantallas). Solo con el permiso de contacto firmado se manda por WhatsApp o correo; la
// hoja de protección de datos, que es la que lo pide, también por WhatsApp si aún no lo ha firmado.
import { Copy, Mail, MessageCircle, RefreshCw, Send, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { answerText } from "../clinical/anamnesis";
import {
  ANAMNESIS_KIND,
  DOCS_KIND,
  DOCS_PER_LINK,
  FORM_DAYS,
  formLink,
  formMessage,
  formTitle,
  formWhat,
  isSignKind,
  patientSections,
  PRIVACY_KIND,
  SENDABLE,
} from "../clinical/patientForms";
import { privacyToSign } from "../privacy/toSign";
import { useAnamnesisSections } from "../clinical/useAnamnesis";
import { getToken } from "../cloud/auth";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { cancelSentForm, formStatus, listSentForms, type SentForm } from "../data/patientForms";
import { clinicComplete, getClinic, mayMessage } from "../data/privacy";
import { ContactNote } from "../privacy/ContactNote";
import { getPatient, type Patient } from "../data/repo";
import { loadMessages, messageSubject, type MessageSettings } from "../messages/templates";
import { mailtoUrl, waPhone, whatsappUrl } from "../schedule/reminders";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { useDocsUsage } from "../documents/DocSync";
import { createPatientForm } from "./createForm";
import { useCollectForms } from "./FormInbox";

const firstName = (p: Patient) => p.name.trim().split(/\s+/)[0] ?? "";
const STATUS: Record<ReturnType<typeof formStatus>, { label: string; tone: string }> = {
  pending: { label: "Esperando respuesta", tone: "bg-warning-soft" },
  done: { label: "Rellenado", tone: "bg-success-soft text-success" },
  expired: { label: "Caducado sin responder", tone: "bg-surface text-text-muted" },
  cancelled: { label: "Anulado", tone: "bg-surface text-text-muted" },
};

export function SendFormsPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const cloud = useCloud();
  const toast = useToast();
  const version = useDataVersion();
  const sections = useAnamnesisSections();
  const collect = useCollectForms();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, forms, clinic, messages] = await Promise.all([getPatient(db, id), listSentForms(db, id), getClinic(db), loadMessages(db)]);
    return { patient, forms, clinic, clinicName: clinic.name || cloud?.clinic?.name || "", clinicReady: clinicComplete(clinic), messages };
  }, [id, version]);
  const [choosing, setChoosing] = useState<string | null>(params.get("enviar"));
  const [sharing, setSharing] = useState<SentForm | null>(null);
  const [cancelling, setCancelling] = useState<SentForm | null>(null);
  const [looking, setLooking] = useState(false);
  const back = `/pacientes/${id}`;
  // ?compartir=<id>: viene de crear un enlace para firmar en su pantalla (protección de datos o un consentimiento).
  const toShare = params.get("compartir");
  useEffect(() => {
    if (!toShare || !data.data) return;
    const f = data.data.forms.find((x) => x.id === toShare);
    if (f) setSharing(f);
    setParams({}, { replace: true });
  }, [toShare, data.data, setParams]);

  if (data.error) return <Page title="Formularios para el paciente" backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Formularios para el paciente" backTo={back}><Loading /></Page>;
  const { patient, forms, clinic, clinicName, clinicReady, messages } = data.data;
  if (!patient) return <Page title="Formularios para el paciente" backTo={back}><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const online = !!(cloud?.clinic && cloud.clinics);
  const closeChooser = () => {
    setChoosing(null);
    if (params.has("enviar")) setParams({}, { replace: true });
  };

  return (
    <Page title="Formularios para el paciente" backTo={back}>
      <p className="text-text-muted">
        Mándale a {patient.name} su parte de la anamnesis o un cuestionario para que lo rellene desde su móvil, sin cuenta ni app. Lo que conteste se pone solo en
        su ficha: en la anamnesis, solo donde no hayas escrito nada.
      </p>
      {online && !clinicReady && (
        <Alert tone="warning" title="Faltan los datos de la clínica">
          El formulario empieza diciendo al paciente quién es el responsable de sus datos y a qué correo escribir. Rellena el nombre y el correo en{" "}
          <Link to="/ajustes/clinica" className="py-3 font-semibold underline underline-offset-2">
            Ajustes › Clínica y protección de datos
          </Link>
          .
        </Alert>
      )}
      {!online ? (
        <Alert tone="info" title="Hace falta el servidor de la clínica">
          Para mandar formularios tienes que trabajar en una clínica con el servidor de OmniClin:{" "}
          <Link to="/ajustes/cuenta" className="py-3 font-semibold underline underline-offset-2">
            Ajustes › Cuenta de Google
          </Link>
          .
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button icon={<Send aria-hidden="true" className="size-5" />} onClick={() => setChoosing(ANAMNESIS_KIND)}>
            Enviar un formulario
          </Button>
          <Button
            variant="secondary"
            loading={looking}
            icon={<RefreshCw aria-hidden="true" className="size-5" />}
            onClick={async () => {
              setLooking(true);
              const n = await collect();
              setLooking(false);
              if (n === 0) toast("No hay respuestas nuevas");
              else if (n === null) toast("No se ha podido mirar: comprueba la conexión o vuelve a entrar con Google (Ajustes → Cuenta)", "danger");
            }}
          >
            Buscar respuestas
          </Button>
        </div>
      )}

      {forms.length > 0 ? (
        <ul aria-label="Formularios enviados" className="flex flex-col gap-2">
          {forms.map((f) => (
            <SentRow key={f.id} f={f} patientId={id} sectionsTemplate={sections} onShare={() => setSharing(f)} onCancel={() => setCancelling(f)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">Todavía no le has mandado ninguno.</p>
      )}

      <Sheet open={choosing !== null && online} onClose={closeChooser} title="Enviar un formulario">
        {choosing !== null && (
          <ChooseForm
            initial={choosing}
            onCreate={async (kind) => {
              const created = await createPatientForm(getDb(), cloud, {
                patientId: id,
                patientName: patient.name,
                kind,
                clinicName,
                sections,
                ...(kind === PRIVACY_KIND ? { privacy: privacyToSign(clinic, "server", patient) } : {}),
              });
              bumpData();
              closeChooser();
              setSharing(created);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!sharing} onClose={() => setSharing(null)} title="Mandar el enlace">
        {sharing && <ShareForm f={sharing} patient={patient} clinicName={clinicName} messages={messages} />}
      </Sheet>

      <Sheet open={!!cancelling} onClose={() => setCancelling(null)} title="¿Anular el enlace?">
        <p>El enlace dejará de valer: si {firstName(patient)} lo abre, verá que ya no vale. Puedes mandarle otro cuando quieras.</p>
        <Button
          variant="danger"
          block
          onClick={async () => {
            const f = cancelling!;
            const token = getToken();
            try {
              if (token && cloud?.clinic && cloud.clinics) await cloud.clinics.forms.remove(token, cloud.clinic.id, f.id);
            } catch {
              /* sin conexión: caduca solo; aquí queda anulado */
            }
            await cancelSentForm(getDb(), f.id);
            bumpData();
            setCancelling(null);
            toast("Enlace anulado");
          }}
        >
          Sí, anular
        </Button>
        <Button variant="secondary" block onClick={() => setCancelling(null)}>
          No
        </Button>
      </Sheet>
    </Page>
  );
}

function ChooseForm({ initial, onCreate }: { initial: string; onCreate: (kind: string) => Promise<void> }) {
  // Los pendientes del permiso de su titular, solo si la clínica ha marcado que lo tiene.
  const sendable = SENDABLE;
  // Pedirle archivos, solo si el servidor de la clínica los guarda.
  const docs = useDocsUsage().usage?.enabled === true;
  const [kind, setKind] = useState(initial === ANAMNESIS_KIND || initial === DOCS_KIND || initial === PRIVACY_KIND || SENDABLE.some((k) => k.id === initial) ? initial : ANAMNESIS_KIND);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onCreate(kind);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <SelectField label="Qué le mandas" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value={ANAMNESIS_KIND}>Su parte de la anamnesis</option>
        <option value={PRIVACY_KIND}>La hoja de protección de datos, para firmar</option>
        {(docs || kind === DOCS_KIND) && <option value={DOCS_KIND}>Sus informes y pruebas (PDF o fotos)</option>}
        <optgroup label="Cuestionarios">
          {sendable.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </optgroup>
      </SelectField>
      <p className="text-sm text-text-muted">
        {kind === PRIVACY_KIND
          ? "La lee entera en su móvil, contesta a cada permiso (fotos, WhatsApp, docencia) y la firma con el dedo. Vuelve firmada a su ficha, tal cual, como si la firmara aquí. Es lo único que se le puede mandar por WhatsApp antes de que firme el permiso de contacto."
          : kind === DOCS_KIND
          ? `Sube desde su móvil hasta ${DOCS_PER_LINK} informes o pruebas, en PDF o en foto (las fotos se pasan a PDF), de 5 MB como mucho cada uno. Llegan cifrados a sus archivos.`
          : kind === ANAMNESIS_KIND
            ? "Sus datos, lo que le pasa, su salud, su familia y su día a día, con preguntas dichas para el paciente (y las propias de tu clínica). La zona, el lado, las banderas rojas, las precauciones, la exploración y el plan son tuyos."
            : "El cuestionario entero, con sus instrucciones. Al recibirlo, se guarda en sus cuestionarios con la nota calculada."}{" "}
        El enlace vale {FORM_DAYS} días.
      </p>
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy} icon={<Send aria-hidden="true" className="size-5" />}>
        Crear el enlace
      </Button>
    </form>
  );
}

/** El mensaje con el enlace y por dónde mandarlo. */
function ShareForm({ f, patient, clinicName, messages }: { f: SentForm; patient: Patient; clinicName: string; messages: MessageSettings }) {
  const toast = useToast();
  const url = formLink(f.id, f.key);
  const text = formMessage({ name: firstName(patient), clinic: clinicName, kind: f.kind, url, expiresAt: f.expiresAt }, messages);
  const phone = waPhone(patient.phone);
  const consent = patient.privacy.consents?.contact;
  // La única excepción: la hoja de protección de datos (la que pide el permiso) va por WhatsApp aunque aún no lo haya
  // firmado. Si ya dijo que no, tampoco.
  const askingPermission = f.kind === PRIVACY_KIND && consent === undefined;
  const byWhatsApp = mayMessage(consent) || askingPermission;
  const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  return (
    <div className="flex flex-col gap-3">
      {askingPermission ? (
        <Alert tone="info" title="Aún no ha firmado el permiso de contacto">
          Esta hoja es la que lo pide: se le puede mandar por WhatsApp. El correo y los demás mensajes, cuando lo firme.
        </Alert>
      ) : !mayMessage(consent) && (
        <Alert tone="warning" title={consent === false ? "No acepta WhatsApp ni correo" : "Falta su permiso de contacto"}>
          <ContactNote contact={consent} patientId={patient.id} extra="Dale el enlace en persona: que lo abra con su móvil en la consulta" className="text-text" />
        </Alert>
      )}
      <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 font-sans text-sm break-words">{text}</pre>
      <div className="flex flex-wrap gap-2">
        {phone && byWhatsApp && (
          <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}>
            <MessageCircle aria-hidden="true" className="size-5" /> WhatsApp
          </a>
        )}
        {patient.email && mayMessage(consent) && (
          <a href={mailtoUrl(patient.email, messageSubject(f.kind === DOCS_KIND ? "archivos" : isSignKind(f.kind) ? "firma" : "formulario", messages, { clinica: clinicName, formulario: formWhat(f.kind) }), text)} className={cx(link, "border border-border bg-bg hover:bg-surface")}>
            <Mail aria-hidden="true" className="size-5" /> Correo
          </a>
        )}
        {canShare && mayMessage(consent) && (
          <Button variant="secondary" icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void navigator.share({ text }).catch(() => {})}>
            Compartir
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<Copy aria-hidden="true" className="size-5" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast("Enlace copiado", "success");
            } catch {
              toast("No se ha podido copiar: mantén pulsado el enlace de arriba", "danger");
            }
          }}
        >
          Copiar el enlace
        </Button>
      </div>
      {!phone && !patient.email && <p className="text-sm text-text-muted">No tiene móvil ni correo en su ficha: copia el enlace y dáselo como prefieras.</p>}
    </div>
  );
}

function SentRow({
  f,
  patientId,
  sectionsTemplate,
  onShare,
  onCancel,
}: {
  f: SentForm;
  patientId: string;
  sectionsTemplate: ReturnType<typeof useAnamnesisSections>;
  onShare: () => void;
  onCancel: () => void;
}) {
  const status = formStatus(f);
  const s = STATUS[status];
  const fields = f.kind === ANAMNESIS_KIND ? patientSections(sectionsTemplate).flatMap((x) => x.fields) : [];
  const answered = fields.filter((fl) => answerText(fl, (f.answers?.[fl.id] ?? null) as never) !== "");
  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-semibold">{formTitle(f.kind)}</p>
          <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", s.tone)}>
            {status === "done" && isSignKind(f.kind) ? "Firmado" : s.label}
            {status === "done" && f.answeredAt ? ` el ${fmtDate(f.answeredAt)}` : ""}
          </span>
        </div>
        <p className="text-sm text-text-muted">
          Enviado el {fmtDate(f.sentAt)}
          {status === "pending" && ` · vale hasta el ${fmtDate(f.expiresAt)}`}
        </p>
        {status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Send aria-hidden="true" className="size-4" />} onClick={onShare}>
              Volver a mandar el enlace
            </Button>
            <Button size="sm" variant="ghost" icon={<X aria-hidden="true" className="size-4" />} onClick={onCancel}>
              Anular
            </Button>
          </div>
        )}
        {status === "done" && f.kind === DOCS_KIND && (
          <Link to={`/pacientes/${patientId}/archivos`} className="self-start text-sm font-semibold text-accent">
            {Array.isArray(f.answers?.docs) ? `Envió ${f.answers.docs.length === 1 ? "1 archivo" : `${f.answers.docs.length} archivos`}: ver sus archivos` : "Ver sus archivos"}
          </Link>
        )}
        {status === "done" && isSignKind(f.kind) && (
          <Link to={`/pacientes/${patientId}/${f.kind === PRIVACY_KIND ? "proteccion-datos" : "consentimientos"}`} className="self-start text-sm font-semibold text-accent">
            {f.kind === PRIVACY_KIND ? "Ver la hoja firmada" : "Ver sus consentimientos"}
          </Link>
        )}
        {status === "done" && f.kind !== ANAMNESIS_KIND && f.kind !== DOCS_KIND && !isSignKind(f.kind) && (
          <Link to={`/pacientes/${patientId}/cuestionarios`} className="self-start text-sm font-semibold text-accent">
            Ver en sus cuestionarios
          </Link>
        )}
        {status === "done" && f.kind === ANAMNESIS_KIND && (
          <>
            {f.skipped.length > 0 && (
              <p className="text-sm">
                {f.skipped.length === 1 ? "1 respuesta no se ha puesto" : `${f.skipped.length} respuestas no se han puesto`} en la anamnesis porque ya tenías algo escrito:
                míralas abajo.
              </p>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-accent">Ver lo que contestó</summary>
              <dl className="mt-2 flex flex-col gap-2">
                {answered.map((fl) => (
                  <div key={fl.id} className="flex flex-col">
                    <dt className="text-sm text-text-muted">
                      {fl.label}
                      {f.skipped.includes(fl.id) && <span className="font-semibold text-warning"> · no se puso (ya había algo escrito)</span>}
                    </dt>
                    <dd className="whitespace-pre-line">{answerText(fl, (f.answers?.[fl.id] ?? null) as never)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </Card>
    </li>
  );
}
