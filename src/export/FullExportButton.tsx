// Descargar todo (fullExport.ts): la historia clínica legible de cada paciente, un Excel con todo, los datos para otro
// programa y la copia de Cénit, en un .zip. Se usa en Ajustes → Copias y exportar y al borrar una clínica.
import { Archive } from "lucide-react";
import { useState } from "react";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

const stamp = () => new Date().toISOString().slice(0, 10);

export function FullExportButton({
  name,
  label = "Descargar todo (historias, Excel y copia)",
  doneLabel,
  variant = "primary",
  onDone,
}: {
  /** Para el nombre del archivo: la clínica («Cenit-Fisiolab-Centro-2026-10-21.zip»). */
  name: string;
  label?: string;
  /** Lo que dice el botón después de descargar. */
  doneLabel?: string;
  variant?: "primary" | "secondary";
  onDone?: () => void;
}) {
  const toast = useToast();
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    setProgress("Preparando…");
    try {
      const { buildPackage } = await import("./fullExport");
      const { bytes, patients } = await buildPackage(getDb(), { progress: (d, total) => setProgress(`Preparando ${d} de ${total} pacientes…`) });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cenit-${name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "datos"}-${stamp()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDone(true);
      toast(`Descargado: ${patients === 1 ? "1 paciente" : `${patients} pacientes`} con toda su historia. Guárdalo fuera de este dispositivo.`, "success");
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
