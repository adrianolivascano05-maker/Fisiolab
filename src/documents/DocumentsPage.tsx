// Ficha → Archivos del paciente: sus informes y pruebas en PDF (o fotos, que se pasan a PDF). Se añaden aquí o los sube
// el propio paciente con un enlace (Formularios para el paciente). Van cifrados al servidor de la clínica; se abren
// desde aquí, se envían o se borran. Sin conexión se pueden añadir (se suben después) y abrir los que ya se abrieron.
import { Download, FilePlus2, FileText, Pencil, Send, Share2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { saveFile } from "../app/download";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import type { DocsUsage } from "../cloud/clinic";
import { getDb } from "../data/db";
import { deleteDocument, listDocuments, renameDocument, sizeText, type PatientDocument } from "../data/documents";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { addPatientFiles, readDocument, syncDocuments } from "./docSync";
import { useDocsServer, useDocsUsage } from "./DocSync";
import { prepareFiles } from "./prepare";

/** El nombre del archivo al guardarlo o enviarlo: el que se ve, sin lo que no admiten los sistemas de archivos. */
const fileName = (d: PatientDocument) => `${d.name.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100)}.pdf`;

/** Si este navegador puede compartir un archivo (móviles, sobre todo). */
function canShare(): boolean {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([new Uint8Array(1)], "a.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

export function DocumentsPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const version = useDataVersion();
  const { server, space } = useDocsServer();
  const { usage, refresh } = useDocsUsage();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, docs] = await Promise.all([getPatient(db, id), listDocuments(db, id)]);
    return { patient, docs };
  }, [id, version]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [open, setOpen] = useState<PatientDocument | null>(null);
  const back = `/pacientes/${id}`;
  const title = "Archivos del paciente";

  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const { patient, docs } = data.data;
  if (!patient) return <Page title={title} backTo={back}><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  // Sin clínica no hay dónde guardarlos; con un servidor sin almacén de documentos, tampoco (los ya añadidos se ven).
  const disabled = !server || !space || usage?.enabled === false;

  const add = async (files: File[]) => {
    if (!files.length || !space) return;
    setBusy(true);
    setProblems([]);
    try {
      const { ready, problems } = await prepareFiles(files, `Fotos del ${fmtDate(new Date().toISOString())}`);
      setProblems(problems);
      if (!ready.length) return;
      const r = await addPatientFiles(getDb(), space, server, id, ready);
      bumpData();
      const n = r.ids.length;
      const what = n === 1 ? "Archivo añadido" : `${n} archivos añadidos`;
      if (r.full) toast(`${what}, pero el almacén está lleno (10 GB): se queda en este dispositivo hasta que haya sitio`, "danger");
      else if (r.uploaded < n) toast(`${what}: se subirá${n === 1 ? "" : "n"} al servidor en cuanto haya conexión`, "success");
      else toast(what, "success");
      void refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">
        Informes y pruebas de {patient.name}: PDF o fotos (las fotos se pasan a PDF). Se guardan cifrados en el servidor de la clínica: solo los abre el equipo.
      </p>
      {!server ? (
        <Alert tone="info" title="Hace falta el servidor de la clínica">
          Para guardar archivos tienes que trabajar en una clínica con el servidor de Cénit:{" "}
          <Link to="/ajustes/cuenta" className="py-3 font-semibold underline underline-offset-2">
            Ajustes › Cuenta de Google
          </Link>
          .
        </Alert>
      ) : usage?.enabled === false ? (
        <Alert tone="info" title="El servidor aún no guarda archivos">
          Quien gestiona el servidor de la clínica tiene que activar el almacén de archivos (R2): se explica en la guía del servidor, en el apartado «Documentos».
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            multiple
            accept="application/pdf,.pdf,image/*"
            className="sr-only"
            aria-label="Elegir archivos (PDF o fotos)"
            tabIndex={-1}
            onChange={(e) => void add([...(e.target.files ?? [])])}
          />
          <Button loading={busy} icon={<FilePlus2 aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
            Añadir PDF o fotos
          </Button>
          <Link
            to={`/pacientes/${id}/formularios?enviar=documentos`}
            className="tap inline-flex min-h-11 items-center gap-2 rounded-md border border-border-input bg-bg px-4 font-semibold hover:bg-surface"
          >
            <Send aria-hidden="true" className="size-5" /> Pedírselos al paciente
          </Link>
        </div>
      )}
      {problems.length > 0 && (
        <Alert tone="warning" title={problems.length === 1 ? "Un archivo no se ha añadido" : "Algunos archivos no se han añadido"}>
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      {docs.length > 0 ? (
        <ul aria-label="Archivos" className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
          {docs.map((d) => (
            <li key={d.id}>
              <button type="button" className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface" onClick={() => setOpen(d)}>
                <FileText aria-hidden="true" className="size-6 shrink-0 text-accent" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold break-words">{d.name}</span>
                  <span className="text-sm text-text-muted">
                    {[fmtDate(d.createdAt), sizeText(d.size), d.source === "patient" ? "Lo envió el paciente" : null, d.uploadedAt ? null : "Pendiente de subir"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {!d.uploadedAt && <Upload aria-label="Pendiente de subir" className="size-5 shrink-0 text-warning" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted">{disabled ? "No tiene archivos." : "Aún no tiene archivos. Añade su informe o pídeselo: lo sube desde su móvil."}</p>
      )}
      <UsageLine usage={usage} />
      <DocSheet doc={open} space={space} server={server} onClose={() => setOpen(null)} />
    </Page>
  );
}

function UsageLine({ usage }: { usage: DocsUsage | null }) {
  if (!usage?.enabled) return null;
  const nearly = usage.total >= usage.warnAt;
  return (
    <p className={nearly ? "text-sm text-warning" : "text-sm text-text-muted"}>
      Archivos de la clínica: {sizeText(usage.used)} · Almacén: {sizeText(usage.total)} de {sizeText(usage.cap)}
      {nearly ? ". Casi lleno: al llegar al tope no se guardan más; borra los que ya no hagan falta." : ""}
    </p>
  );
}

function DocSheet({ doc, space, server, onClose }: { doc: PatientDocument | null; space: string | null; server: ReturnType<typeof useDocsServer>["server"]; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"open" | "share" | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setRenaming(null);
    setConfirm(false);
    onClose();
  };
  const get = async () => {
    if (!doc || !space) throw new Error("No se puede abrir ahora.");
    return readDocument(space, server, doc);
  };
  const run = async (kind: "open" | "share") => {
    if (!doc) return;
    setBusy(kind);
    try {
      const bytes = await get();
      if (kind === "share") {
        try {
          await navigator.share({ files: [new File([bytes as BlobPart], fileName(doc), { type: "application/pdf" })], title: doc.name });
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
        }
      } else saveFile(fileName(doc), bytes, "application/pdf");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={!!doc} onClose={close} title={doc?.name ?? ""}>
      {doc && renaming !== null ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await renameDocument(getDb(), doc.id, renaming);
            bumpData();
            toast("Nombre cambiado", "success");
            close();
          }}
        >
          <TextField label="Nombre del archivo" value={renaming} maxLength={120} onChange={(e) => setRenaming(e.target.value)} autoFocus />
          <Button type="submit" block>
            Guardar el nombre
          </Button>
          <Button variant="secondary" block onClick={() => setRenaming(null)}>
            Cancelar
          </Button>
        </form>
      ) : doc && confirm ? (
        <div className="flex flex-col gap-3">
          <p>Se borra de la ficha y del servidor de la clínica, para todo el equipo. Si es parte de su historia clínica, guarda antes una copia.</p>
          <Button
            variant="danger"
            block
            icon={<Trash2 aria-hidden="true" className="size-5" />}
            onClick={async () => {
              await deleteDocument(getDb(), doc.id);
              // Del servidor, ya (si no hay conexión, en la próxima vuelta: DocSync.tsx).
              if (space && server) void syncDocuments(getDb(), space, server).catch(() => {});
              bumpData();
              toast("Archivo borrado", "success");
              close();
            }}
          >
            Sí, borrar el archivo
          </Button>
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            No, dejarlo
          </Button>
        </div>
      ) : doc ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            {[`Añadido el ${fmtDate(doc.createdAt)}`, sizeText(doc.size), doc.source === "patient" ? "lo envió el paciente con su enlace" : null].filter(Boolean).join(" · ")}
            {doc.uploadedAt ? "" : ". Aún no está en el servidor: lo subirá el dispositivo donde se añadió en cuanto tenga conexión."}
          </p>
          <Button block loading={busy === "open"} icon={<Download aria-hidden="true" className="size-5" />} onClick={() => void run("open")}>
            Abrir (se guarda en el dispositivo)
          </Button>
          {canShare() && (
            <Button variant="secondary" block loading={busy === "share"} icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void run("share")}>
              Enviar (WhatsApp, correo…)
            </Button>
          )}
          <Button variant="secondary" block icon={<Pencil aria-hidden="true" className="size-5" />} onClick={() => setRenaming(doc.name)}>
            Cambiar el nombre
          </Button>
          <Button variant="ghost" block icon={<Trash2 aria-hidden="true" className="size-5" />} onClick={() => setConfirm(true)}>
            Borrar
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
