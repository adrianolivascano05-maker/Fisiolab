// Descargar todo (fullExport.ts): la historia clínica legible de cada paciente, sus archivos (informes y pruebas en
// PDF), un Excel con todo, los datos para otro programa y la copia de OmniClin, en un .zip. Se usa en Ajustes → Copias y exportar y al borrar una clínica.
import { todayDay } from "../app/dates";
import { Archive } from "lucide-react";
import { useState } from "react";
import { getDb } from "../data/db";
import { getDocument } from "../data/documents";
import { readDocument } from "../documents/docSync";
import { useDocsServer } from "../documents/DocsAutoSync";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { saveFile } from "../app/download";

const stamp = () => todayDay();

export function FullExportButton({
  name,
  label = "Descargar todo (historias, Excel y copia)",
  doneLabel,
  variant = "primary",
  onDone,
}: {
  /** Para el nombre del archivo: la clínica («OmniClin-Fisiolab-Centro-2026-10-21.zip»). */
  name: string;
  label?: string;
  /** Lo que dice el botón después de descargar. */
  doneLabel?: string;
  variant?: "primary" | "secondary";
  onDone?: () => void;
}) {
  const toast = useToast();
  const { server, space } = useDocsServer();
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    setProgress("Preparando…");
    try {
      const { buildPackage } = await import("./fullExport");
      // Los archivos de los pacientes, abiertos: de este dispositivo o del servidor de la clínica.
      const files = space
        ? async (id: string) => {
            const doc = await getDocument(getDb(), id);
            return doc ? readDocument(space, server, doc) : null;
          }
        : undefined;
      const { bytes, patients, missing } = await buildPackage(getDb(), { progress: (d, total) => setProgress(`Preparando ${d} de ${total} pacientes…`), files });
      saveFile(`OmniClin-${name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "datos"}-${stamp()}.zip`, bytes, "application/zip");
      setDone(true);
      toast(`Descargado: ${patients === 1 ? "1 paciente" : `${patients} pacientes`} con toda su historia. Guárdalo fuera de este dispositivo.`, "success");
      if (missing) toast(`${missing === 1 ? "1 archivo de paciente no se ha podido incluir" : `${missing} archivos de pacientes no se han podido incluir`} (sin conexión o aún sin subir): vuelve a descargar con conexión.`, "danger");
      onDone?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Button variant={done ? "secondary" : variant} loading={progress !== null} icon={<Archive aria-hidden="true" className="size-5" />} onClick={() => void run()}>
      {progress ?? (done && doneLabel ? doneLabel : label)}
    </Button>
  );
}
