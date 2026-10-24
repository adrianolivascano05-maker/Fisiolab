// Enviar o descargar un documento en PDF (informe, justificante…): en el móvil, «Enviar» abre la hoja de compartir
// del sistema (WhatsApp, correo, Drive…) con el PDF adjunto; donde no se puede compartir un archivo, lo descarga.
import { Download, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { saveFile } from "../app/download";

/** Si este navegador puede compartir un PDF (móviles, sobre todo). */
function canShareFile(fileName: string): boolean {
  try {
    const file = new File([new Uint8Array(1)], fileName, { type: "application/pdf" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function SharePdf({ make, fileName, title }: { make: () => Promise<Uint8Array>; fileName: string; title: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const shareable = canShareFile(fileName);
  const run = async (kind: "share" | "download") => {
    setBusy(kind);
    try {
      const bytes = await make();
      if (kind === "share") {
        const file = new File([bytes as BlobPart], fileName, { type: "application/pdf" });
        try {
          await navigator.share({ files: [file], title });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return; // lo cerró sin enviar
          throw e;
        }
      } else saveFile(fileName, bytes, "application/pdf");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {shareable && (
        <Button variant="secondary" loading={busy === "share"} icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void run("share")}>
          Enviar (WhatsApp, correo…)
        </Button>
      )}
      <Button variant="secondary" loading={busy === "download"} icon={<Download aria-hidden="true" className="size-5" />} onClick={() => void run("download")}>
        Guardar en PDF
      </Button>
    </>
  );
}
