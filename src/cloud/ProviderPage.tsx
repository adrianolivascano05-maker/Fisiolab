// Ajustes → Proveedor: solo para quien gestiona el servidor (OPERATOR_EMAILS en cloudflare/worker.js). Sus clínicas
// con lo que sabe el servidor de cada una (nunca sus pacientes: van cifrados), dar de alta a quien puede crear
// clínicas sin entrar en Cloudflare, suspender o reactivar, las bajas con su declaración (y recuperarlas en sus 30
// días) y el borrador del contrato de encargado del tratamiento, que solo entrega el servidor a esta cuenta.
import { Download, FileText, PauseCircle, PlayCircle, RotateCcw, Trash, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { fmtDateTime } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { reportPdf } from "../clinical/reportPdf";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, Row, RowButton } from "../ui/Grouped";
import { useToast } from "../ui/Toast";
import { getToken } from "./auth";
import type { OperatorClinic } from "./clinic";
import { useCloud } from "./CloudGate";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [contract, setContract] = useState<string | null>(null);
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

  return (
    <Page title="Proveedor" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Solo lo ves tú, como quien gestiona el servidor. Lo que hay aquí es lo que sabe el servidor de cada clínica: nunca sus pacientes, que van cifrados con
        la contraseña de la clínica.
      </p>
      {data.error && <Alert tone="warning" title={data.error.message} />}

      <Group title="Resumen" footer={data.data ? undefined : "Cargando…"}>
        <Row title={`${active.length === 1 ? "1 clínica" : `${active.length} clínicas`}`} subtitle={`${people === 1 ? "1 persona" : `${people} personas`} en sus equipos`} />
      </Group>

      <Group title="Clínicas">
        {active.map((c) => (
          <ClinicRow key={c.id} c={c} busy={busy === c.id} onToggle={() => void run(c.id, (t) => api.suspend(t, c.id, !c.suspendedAt), c.suspendedAt ? `«${c.name}» reactivada` : `«${c.name}» suspendida`)} />
        ))}
        {data.data && !active.length && <Row title="Aún no hay clínicas" />}
      </Group>

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
                  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "Cenit-contrato-encargado-BORRADOR.pdf";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    c.lastSync ? `último uso ${fmtDateTime(c.lastSync)}` : null,
    `administra ${c.admins.join(", ") || c.createdBy}`,
  ].filter(Boolean);
  return (
    <RowButton
      icon={c.suspendedAt ? PlayCircle : PauseCircle}
      tone={c.suspendedAt ? "warning" : "accent"}
      title={`${c.name}${c.suspendedAt ? " · suspendida" : ""}`}
      subtitle={`${facts.join(" · ")} · tocar para ${c.suspendedAt ? "reactivar" : "suspender"}`}
      busy={busy}
      onClick={onToggle}
    />
  );
}
