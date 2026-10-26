// Compartir → Cénit (Android): lo que se ha compartido desde WhatsApp, el correo o la galería llega aquí
// (public/compartir-sw.js lo deja en la caché del navegador; aquí se lee y se borra de ella). Se elige el paciente y se
// guarda en sus archivos, como con «Añadir PDF o fotos». Lo que no se guarda se pierde al salir de la pantalla.
import { FilePlus2, FileText, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { bumpData } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { sizeText } from "../data/documents";
import { listPatients } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { addPatientFiles } from "./docSync";
import { useDocsServer, useDocsUsage } from "./DocSync";
import { prepareFiles } from "./prepare";

const SHARED = "cenit-compartidos";

/** Lo compartido, como archivos (en el orden en que llegó). Se lee una vez y se borra de la caché: queda en memoria
 * hasta que se guarda o se sale de la pantalla. */
async function sharedFiles(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(SHARED);
  const keys = [...(await cache.keys())].sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }));
  const out: File[] = [];
  for (const k of keys) {
    const res = await cache.match(k);
    if (!res) continue;
    const name = decodeURIComponent(res.headers.get("X-Nombre") ?? "Documento");
    out.push(new File([await res.blob()], name, { type: res.headers.get("Content-Type") ?? "" }));
  }
  await caches.delete(SHARED);
  return out;
}

export function SharedFilesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { server, space } = useDocsServer();
  const { usage } = useDocsUsage();
  const files = useAsync(sharedFiles, []);
  const [search, setSearch] = useState("");
  const patients = useAsync(() => listPatients(getDb(), search), [search]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const save = async (patientId: string, name: string) => {
    if (!space || !files.data?.length) return;
    setBusy(patientId);
    try {
      const { ready, problems } = await prepareFiles(files.data, `Fotos del ${fmtDate(new Date().toISOString())}`);
      setProblems(problems);
      if (!ready.length) return;
      const r = await addPatientFiles(getDb(), space, server, patientId, ready);
      bumpData();
      toast(`${r.ids.length === 1 ? "Archivo guardado" : `${r.ids.length} archivos guardados`} en la ficha de ${name}`, "success");
      navigate(`/pacientes/${patientId}/archivos`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(null);
    }
  };

  const title = "Guardar en la ficha";
  if (!server || !space || usage?.enabled === false)
    return (
      <Page title={title} backTo="/">
        <Alert tone="info" title="Aquí no se pueden guardar archivos">
          Para guardar archivos de pacientes hace falta trabajar en una clínica con el servidor de Cénit y que ese servidor tenga el almacén de archivos.
        </Alert>
      </Page>
    );
  return (
    <Page title={title} backTo="/">
      {files.data && files.data.length === 0 && <Alert tone="info" title="No ha llegado ningún archivo. Vuelve a compartirlo desde la otra app." />}
      {files.data && files.data.length > 0 && (
        <>
          <ul aria-label="Lo que has compartido" className="flex flex-col gap-1">
            {files.data.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <FileText aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 break-words">
                  {f.name} · {sizeText(f.size)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-text-muted">¿De qué paciente es? Se guarda cifrado en sus archivos (las fotos, en un PDF).</p>
          <TextField label="Buscar paciente" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, teléfono…" />
          {problems.length > 0 && (
            <Alert tone="warning" title="Algo no se ha podido guardar">
              <ul className="list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          )}
          <ul aria-label="Pacientes" className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
            {(patients.data ?? []).slice(0, 30).map((p) => (
              <li key={p.id}>
                <Button variant="ghost" block loading={busy === p.id} disabled={busy !== null} icon={<FilePlus2 aria-hidden="true" className="size-5" />} onClick={() => void save(p.id, p.name)}>
                  {p.name}
                </Button>
              </li>
            ))}
          </ul>
          {patients.data && patients.data.length === 0 && (
            <p className="flex items-center gap-2 text-text-muted">
              <Search aria-hidden="true" className="size-4" /> Ningún paciente se llama así.
            </p>
          )}
        </>
      )}
    </Page>
  );
}
