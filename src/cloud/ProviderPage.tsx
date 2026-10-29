// Ajustes → Proveedor: solo para quien gestiona el servidor (OPERATOR_EMAILS en cloudflare/worker.js). Las
// solicitudes de quien quiere dar de alta su clínica (aceptar o rechazar), sus clínicas
// con lo que sabe el servidor de cada una (nunca sus pacientes: van cifrados), dar de alta a quien puede crear
// clínicas sin entrar en Cloudflare, suspender o reactivar, las bajas con su declaración (y recuperarlas en sus 30
// días) y el borrador del contrato de encargado del tratamiento, que solo entrega el servidor a esta cuenta.
import { Check, Download, FileText, PauseCircle, PlayCircle, RotateCcw, Trash, UserPlus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { fmtDateTime } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { reportPdf } from "../clinical/reportPdf";
import { sizeText } from "../data/documents";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/Field";
import { Group, Row, RowButton } from "../ui/Grouped";
import { useToast } from "../ui/Toast";
import { getToken } from "./auth";
import type { OperatorClinic } from "./clinic";
import { errText, useCloud } from "./cloudContext";
import { limitWarnings, requestsText } from "./limits";
import { cloudflarePending } from "./serverStatus";
import { saveFile } from "../app/download";

const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
const day = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

export function ProviderPage() {
  const cloud = useCloud();
  const toast = useToast();
  const api = cloud?.clinics?.operator;
  const data = useAsync(async () => {
    const token = getToken();
    if (!api) return null;
    if (!token) throw new Error("Vuelve a entrar con Google para ver el panel.");
    return api.overview(token);
  }, [!!api]);
  // Las peticiones de hoy, aparte: preguntarlas a Cloudflare tarda y no debe retrasar el resto del panel.
  const usage = useAsync(async () => {
    const token = getToken();
    if (!api || !token) return null;
    return api.requests(token).catch(() => null);
  }, [!!api]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [contract, setContract] = useState<string | null>(null);
  // Suspender o reactivar pasa por una hoja de confirmación: un toque en la fila nunca suspende una clínica.
  const [toggling, setToggling] = useState<OperatorClinic | null>(null);
  const [sure, setSure] = useState(false);
  const contractRef = useRef<HTMLElement>(null);
  if (!cloud?.operator || !api) return <Navigate to="/ajustes" replace />;

  async function run(key: string, work: (t: NonNullable<ReturnType<typeof getToken>>) => Promise<unknown>, done: string) {
    const token = getToken();
    if (!token) return cloud!.reconnect();
    setBusy(key);
    try {
      await work(token);
      toast(done, "success");
      data.reload();
    } catch (e) {
      toast(errText(e), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return toast("Escribe un correo de Google válido.", "danger");
    await run("add", (t) => api!.addCreator(t, clean), `${clean} ya puede crear su clínica`);
    setEmail("");
  }

  const clinics = data.data?.clinics ?? [];
  const active = clinics.filter((c) => !c.deletedAt);
  const deleted = clinics.filter((c) => c.deletedAt);
  const people = active.reduce((n, c) => n + c.members, 0);
  const requests = data.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const rejected = requests.filter((r) => r.status === "rejected");

  return (
    <Page title="Proveedor" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Solo lo ves tú, como quien gestiona el servidor. Lo que hay aquí es lo que sabe el servidor de cada clínica: nunca sus pacientes, que van cifrados con
        la contraseña de la clínica.
      </p>
      {data.error && <Alert tone="warning" title={data.error.message} />}
      {/* Lo que falta hacer en Cloudflare tras actualizar la app: pegar el servidor nuevo, activar R2. */}
      {data.data &&
        cloudflarePending(data.data.version ? { version: data.data.version, docs: !!data.data.documents?.enabled } : undefined).map((p) => (
          <Alert key={p.title} tone="warning" title={p.title}>
            {p.detail}
          </Alert>
        ))}

      <section aria-labelledby="h-solicitudes" className="flex flex-col gap-2">
        <h2 id="h-solicitudes" className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
          Solicitudes de acceso
        </h2>
        {data.data && !pending.length && <p className="px-1 text-sm text-text-muted">No hay solicitudes pendientes.</p>}
        {pending.map((r) => (
          <Card key={r.email} className="flex flex-col gap-2">
            <p className="font-semibold">{r.clinic}</p>
            <p className="text-sm">
              {r.email} · lo pidió el {day(r.createdAt)}
            </p>
            {r.note && <blockquote className="border-l-4 border-border pl-3 text-sm text-text-muted">{r.note}</blockquote>}
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy === `ok:${r.email}`}
                icon={<Check aria-hidden="true" className="size-5" />}
                onClick={() => void run(`ok:${r.email}`, (t) => api.answer(t, r.email, true), `${r.email} ya puede dar de alta «${r.clinic}»`)}
              >
                Aceptar
              </Button>
              <Button
                variant="secondary"
                loading={busy === `no:${r.email}`}
                icon={<X aria-hidden="true" className="size-5" />}
                onClick={() => void run(`no:${r.email}`, (t) => api.answer(t, r.email, false), `Solicitud de ${r.email} rechazada`)}
              >
                Rechazar
              </Button>
            </div>
          </Card>
        ))}
        {rejected.length > 0 && (
          <Group title="Rechazadas" footer="No pueden volver a pedirlo. Toca una para borrarla y que pueda pedirlo otra vez.">
            {rejected.map((r) => (
              <RowButton
                key={r.email}
                icon={Trash}
                tone="danger"
                title={`${r.email} · ${r.clinic}`}
                subtitle={`Rechazada${r.answeredAt ? ` el ${day(r.answeredAt)}` : ""} · tocar para borrarla`}
                busy={busy === `rm:${r.email}`}
                onClick={() => void run(`rm:${r.email}`, (t) => api.dropRequest(t, r.email), `${r.email} puede volver a pedirlo`)}
              />
            ))}
          </Group>
        )}
      </section>

      {/* Al 70 % de cada límite: qué pasa al llegar y qué hacer antes. */}
      {data.data &&
        limitWarnings({ ...data.data, requests: usage.data }).map((w) => (
          <Alert key={w.title} tone="warning" title={w.title}>
            {w.detail}
          </Alert>
        ))}
      <Group title="Resumen" footer={data.data ? undefined : "Cargando…"}>
        <Row title={`${active.length === 1 ? "1 clínica" : `${active.length} clínicas`}`} subtitle={`${people === 1 ? "1 persona" : `${people} personas`} en sus equipos`} />
        {data.data?.documents && (
          <Row
            title="Almacén R2 (archivos y copias)"
            subtitle={
              data.data.documents.enabled
                ? `${sizeText(data.data.documents.total)} de ${sizeText(data.data.documents.cap)}${data.data.documents.copies ? ` · las copias de las clínicas, ${sizeText(data.data.documents.copies)}` : ""}`
                : "Sin activar: falta el enlace DOCS del Worker (cloudflare/README.md, «Documentos»). Sin él, cada copia va en la base y puede ocupar 50 MB como mucho"
            }
          />
        )}
        {data.data?.database && data.data.database.bytes !== null && (
          <Row title="Base de datos (D1)" subtitle={`${sizeText(data.data.database.bytes)} de ${sizeText(data.data.database.cap)}`} />
        )}
        <Row title="Peticiones de hoy (toda la cuenta)" subtitle={usage.loading ? "Cargando…" : requestsText(usage.data ?? null)} />
      </Group>

      <Group title="Clínicas">
        {active.map((c) => (
          <ClinicRow
            key={c.id}
            c={c}
            busy={busy === c.id}
            onToggle={() => {
              setSure(false);
              setToggling(c);
            }}
          />
        ))}
        {data.data && !active.length && <Row title="Aún no hay clínicas" />}
      </Group>

      <Sheet open={toggling !== null} onClose={() => setToggling(null)} title={toggling ? `${toggling.suspendedAt ? "¿Reactivar" : "¿Suspender"} «${toggling.name}»?` : ""}>
        {toggling &&
          (toggling.suspendedAt ? (
            <p>Su equipo vuelve a poder guardar cambios en el servidor y a recibir formularios.</p>
          ) : (
            <>
              <p>
                Mientras esté suspendida, su equipo ({toggling.members === 1 ? "1 persona" : `${toggling.members} personas`}) no podrá guardar cambios en el
                servidor ni recibir formularios de sus pacientes. Sí podrá descargar su copia. No se borra nada y se reactiva desde aquí cuando quieras.
              </p>
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                <span className="text-sm">Sí, quiero suspender «{toggling.name}», administrada por {toggling.admins.join(", ") || toggling.createdBy}.</span>
              </label>
            </>
          ))}
        {toggling && (
          <Button
            block
            variant={toggling.suspendedAt ? "primary" : "danger"}
            disabled={!toggling.suspendedAt && !sure}
            loading={busy === toggling.id}
            onClick={() => {
              const c = toggling;
              setToggling(null);
              void run(c.id, (t) => api.suspend(t, c.id, !c.suspendedAt), c.suspendedAt ? `«${c.name}» reactivada` : `«${c.name}» suspendida`);
            }}
          >
            {toggling.suspendedAt ? `Reactivar «${toggling.name}»` : `Suspender «${toggling.name}»`}
          </Button>
        )}
        <Button variant="secondary" block onClick={() => setToggling(null)}>
          Cancelar
        </Button>
      </Sheet>

      <Card>
        <form className="flex flex-col gap-3" noValidate onSubmit={add}>
          <h2 className="font-semibold">Dar de alta una clínica</h2>
          <p className="text-sm text-text-muted">
            El correo de Google de su responsable: podrá entrar, crear su clínica y añadir a su equipo. No hace falta tocar Cloudflare.
          </p>
          <TextField label="Correo del responsable" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy === "add"} icon={<UserPlus aria-hidden="true" className="size-5" />}>
            Dar de alta
          </Button>
        </form>
      </Card>

      <Group title="Pueden crear clínicas" footer="Los de la variable ALLOWED_EMAILS se cambian en Cloudflare; los demás, aquí.">
        {(data.data?.creators ?? []).map((c) =>
          c.source === "panel" ? (
            <RowButton
              key={c.email}
              icon={Trash}
              tone="danger"
              title={c.email}
              subtitle={`Dado de alta aquí${c.addedAt ? ` el ${day(c.addedAt)}` : ""} · tocar para quitar el alta`}
              busy={busy === c.email}
              onClick={() => void run(c.email, (t) => api.removeCreator(t, c.email), `${c.email} ya no puede crear clínicas nuevas`)}
            />
          ) : (
            <Row key={c.email} title={c.email} subtitle="En la variable ALLOWED_EMAILS" />
          ),
        )}
      </Group>

      {deleted.length > 0 && (
        <section aria-labelledby="h-bajas" className="flex flex-col gap-2">
          <h2 id="h-bajas" className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Bajas (en la papelera)
          </h2>
          {deleted.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm">
                Borrada el {day(c.deletedAt!)} por {c.deletedBy}. Se borra para siempre el {day(c.purgeAfter!)}.
              </p>
              {c.declaration && <blockquote className="border-l-4 border-border pl-3 text-sm text-text-muted">{c.declaration}</blockquote>}
              <Button
                variant="secondary"
                loading={busy === c.id}
                icon={<RotateCcw aria-hidden="true" className="size-5" />}
                onClick={() => void run(c.id, (t) => api.restore(t, c.id), `«${c.name}» recuperada`)}
              >
                Recuperar «{c.name}»
              </Button>
            </Card>
          ))}
        </section>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Contrato de encargado del tratamiento</h2>
        <p className="text-sm text-text-muted">
          Un borrador para firmar con cada clínica que no sea la tuya. Revísalo con un abogado o un delegado de protección de datos antes de usarlo.
        </p>
        {contract === null ? (
          <Button
            variant="secondary"
            loading={busy === "contract"}
            icon={<FileText aria-hidden="true" className="size-5" />}
            onClick={async () => {
              const token = getToken();
              if (!token) return cloud.reconnect();
              setBusy("contract");
              try {
                setContract(await api.contract(token));
              } catch (e) {
                toast(errText(e), "danger");
              } finally {
                setBusy(null);
              }
            }}
          >
            Ver el borrador del contrato
          </Button>
        ) : (
          <>
            <article
              ref={contractRef}
              aria-label="Borrador del contrato"
              className="prose-sm flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-md border border-border bg-bg p-4 text-sm [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              // Lo escribe el propio servidor (cloudflare/worker.js); no lleva nada de nadie más.
              dangerouslySetInnerHTML={{ __html: contract }}
            />
            <Button
              loading={busy === "pdf"}
              icon={<Download aria-hidden="true" className="size-5" />}
              onClick={async () => {
                if (!contractRef.current) return;
                setBusy("pdf");
                const el = contractRef.current;
                const max = el.style.maxHeight;
                el.style.maxHeight = "none";
                try {
                  const bytes = await reportPdf(el);
                  saveFile("OmniClin-contrato-encargado-BORRADOR.pdf", bytes, "application/pdf");
                } catch (e) {
                  toast(errText(e), "danger");
                } finally {
                  el.style.maxHeight = max;
                  setBusy(null);
                }
              }}
            >
              Descargar en PDF
            </Button>
          </>
        )}
      </Card>
    </Page>
  );
}

function ClinicRow({ c, busy, onToggle }: { c: OperatorClinic; busy: boolean; onToggle: () => void }) {
  const facts = [
    `${c.members === 1 ? "1 persona" : `${c.members} personas`}`,
    c.size ? mb(c.size) : "sin copia aún",
    c.docs ? `archivos ${sizeText(c.docs)}` : null,
    c.lastSync ? `último uso ${fmtDateTime(c.lastSync)}` : null,
    `administra ${c.admins.join(", ") || c.createdBy}`,
  ].filter(Boolean);
  return (
    <RowButton
      icon={c.suspendedAt ? PlayCircle : PauseCircle}
      tone={c.suspendedAt ? "warning" : "accent"}
      title={`${c.name}${c.suspendedAt ? " · suspendida" : ""}`}
      subtitle={`${facts.join(" · ")} · tocar para ${c.suspendedAt ? "reactivar" : "suspender (pide confirmación)"}`}
      busy={busy}
      onClick={onToggle}
    />
  );
}
