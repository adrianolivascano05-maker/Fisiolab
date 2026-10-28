// Ajustes › Clínica › Tu firma: la firma dibujada de quien usa la app (src/brand/signature.ts), que sale en sus
// informes, altas, derivaciones, justificantes y recibos. Se dibuja con el mismo recuadro que los consentimientos.
import { Eraser, PenLine } from "lucide-react";
import { useState } from "react";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SignaturePad } from "../ui/SignaturePad";
import { useToast } from "../ui/Toast";
import { getSignature, saveSignature } from "./signature";

export function SignatureSettings({ team }: { team: boolean }) {
  const toast = useToast();
  const saved = useAsync(() => getSignature(getDb()), []);
  const [drawing, setDrawing] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string | null) {
    setBusy(true);
    setError(null);
    try {
      await saveSignature(getDb(), value);
      toast(value ? "Firma guardada: saldrá en tus documentos" : "Firma quitada", "success");
      setDrawing(false);
      setPng(null);
      saved.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar la firma.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-firma">
      <h2 id="h-firma" className="text-lg">
        Tu firma
      </h2>
      <p className="text-sm text-text-muted">
        Dibújala una vez y saldrá sobre la línea de firma de tus informes, altas, derivaciones, justificantes y recibos, también en el PDF.
        {team ? " Cada persona del equipo dibuja la suya." : ""} Los consentimientos se siguen firmando en el momento.
      </p>
      <Card className="flex flex-col gap-3">
        {saved.data && !drawing && (
          <div className="flex flex-wrap items-center gap-3">
            <img src={saved.data} alt="Tu firma dibujada" className="h-20 w-auto max-w-full rounded-md border border-border bg-white" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" icon={<PenLine aria-hidden="true" className="size-5" />} onClick={() => setDrawing(true)}>
                Dibujar otra
              </Button>
              <Button type="button" variant="ghost" icon={<Eraser aria-hidden="true" className="size-5" />} loading={busy} onClick={() => void save(null)}>
                Quitar la firma
              </Button>
            </div>
          </div>
        )}
        {!saved.data && !drawing && saved.data !== undefined && (
          <Button type="button" variant="secondary" className="self-start" icon={<PenLine aria-hidden="true" className="size-5" />} onClick={() => setDrawing(true)}>
            Dibujar mi firma
          </Button>
        )}
        {drawing && (
          <>
            <SignaturePad label="Tu firma" hint="Con el dedo, el lápiz o el ratón. Se guarda cifrada con tus ajustes." onChange={setPng} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" loading={busy} disabled={!png} onClick={() => void save(png)}>
                Guardar la firma
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDrawing(false)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
        {error && <Alert tone="danger" title={error} />}
      </Card>
    </section>
  );
}
