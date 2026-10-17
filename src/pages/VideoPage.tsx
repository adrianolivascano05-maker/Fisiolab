import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import type { JumpType } from "../calc/results";
import { MIN_RECOMMENDED_FPS } from "../calc/video";
import { fmt, jumpLabels, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { videoStore } from "../app/videoStore";
import { getDb } from "../data/db";
import { createJumpTest, saveVideo } from "../data/repo";
import { COMMON_CAPTURE_FPS, nominalFps, readContainerMeta, type ContainerMeta } from "../video/meta";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { NumberField, SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";

/** Comprueba que el navegador sabe reproducir el vídeo (p. ej. HEVC en Chrome de Android puede fallar). */
function canPlay(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Este navegador no puede reproducir el vídeo."));
    };
    v.src = url;
  });
}

type Picked = { file: File; meta: ContainerMeta | null; durationS: number; metaError: string | null };

/** S06 Captura o subida de vídeo */
export function VideoPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const type = (params.get("tipo") ?? "cmj") as JumpType;
  const extraLoadKg = Number(params.get("carga") ?? 0);
  const dropHeightCm = params.get("caida") ? Number(params.get("caida")) : null;

  const [picked, setPicked] = useState<Picked | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureFps, setCaptureFps] = useState("");
  const [manualFps, setManualFps] = useState("");
  const [saving, setSaving] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPicked(null);
    setReading(true);
    try {
      const durationS = await canPlay(file);
      let meta: ContainerMeta | null = null;
      let metaError: string | null = null;
      try {
        meta = await readContainerMeta(file);
      } catch (e) {
        metaError = e instanceof Error ? e.message : String(e);
      }
      setPicked({ file, meta, durationS, metaError });
      setCaptureFps(meta ? String(nominalFps(meta.fps)) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }

  const containerFps = picked?.meta ? nominalFps(picked.meta.fps) : parseDecimal(manualFps);
  const capture = picked?.meta ? Number(captureFps) : containerFps;
  const valid = !!picked && !!containerFps && !Number.isNaN(containerFps) && !!capture && capture > 0;
  const fpsOptions = [...new Set([...(containerFps && picked?.meta ? [containerFps] : []), ...COMMON_CAPTURE_FPS])].sort((a, b) => a - b);

  async function next() {
    if (!picked || !valid || !containerFps || !capture) return;
    setSaving(true);
    try {
      const db = getDb();
      const testId = await createJumpTest(db, { patientId: id, type, extraLoadKg, dropHeightCm });
      await saveVideo(db, testId, {
        fileName: picked.file.name,
        captureFps: capture,
        containerFps,
        frameCount: picked.meta?.frameCount ?? Math.round(picked.durationS * containerFps),
        durationS: picked.meta?.durationS ?? picked.durationS,
        fpsSource: picked.meta && capture === containerFps ? "container" : "user",
      });
      videoStore.set(testId, picked.file);
      navigate(`/tests/${testId}/marcar`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear el test", "danger");
      setSaving(false);
    }
  }

  return (
    <Page title={`Vídeo · ${jumpLabels[type]?.short ?? type}`} backTo={`/pacientes/${id}/test/saltos`}>
      <p className="text-text-muted">
        Graba el salto con la cámara lenta del móvil y elígelo aquí. El vídeo no se guarda en la app: se queda en tu galería.
      </p>
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="sr-only"
        aria-label="Elegir vídeo"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button size="lg" block loading={reading} icon={<Upload aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
        {picked ? "Elegir otro vídeo" : "Grabar o elegir vídeo"}
      </Button>

      {error && (
        <Alert tone="danger" title="No se pudo abrir el vídeo">
          {error} Si es un vídeo del iPhone y usas Chrome en Android, prueba con Safari en el iPhone o exporta el vídeo como «Más compatible».
        </Alert>
      )}

      {picked && (
        <section aria-label="Datos del vídeo" className="flex flex-col gap-4">
          <p className="break-all text-sm text-text-muted">
            {picked.file.name} · {fmt(picked.file.size / 1e6, 1)} MB
            {picked.meta && ` · ${picked.meta.frameCount} fotogramas · ${fmt(picked.meta.durationS, 2)} s`}
          </p>

          {picked.meta ? (
            <>
              <SelectField
                label="Fotogramas por segundo de la grabación"
                value={captureFps}
                onChange={(e) => setCaptureFps(e.target.value)}
                hint={`El archivo va a ${fmt(containerFps, 0)} fps. Si grabaste a cámara lenta y el vídeo se guardó ralentizado, elige los fps con los que grabaste (por ejemplo 240).`}
              >
                {fpsOptions.map((f) => (
                  <option key={f} value={f}>
                    {f} fps{f === containerFps ? " (los del archivo)" : ""}
                  </option>
                ))}
              </SelectField>
              {capture !== null && capture < MIN_RECOMMENDED_FPS && (
                <Alert tone="warning" title={`Grabación a ${fmt(capture, 0)} fps`}>
                  Para saltos hace falta cámara lenta (120 o 240 fps). A {fmt(capture, 0)} fps, un fotograma de error mueve la altura varios centímetros.
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert tone="warning" title="No se pudieron leer los fps del archivo">
                {picked.metaError} Indica a cuántos fps está el vídeo para poder avanzar fotograma a fotograma.
              </Alert>
              <NumberField label="Fotogramas por segundo" unit="fps" value={manualFps} onChange={(e) => setManualFps(e.target.value)} />
            </>
          )}

          <Button size="lg" block disabled={!valid} loading={saving} onClick={next}>
            Marcar el salto
          </Button>
        </section>
      )}
    </Page>
  );
}
