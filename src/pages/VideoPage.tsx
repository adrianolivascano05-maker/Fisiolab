import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import type { JumpType } from "../calc/results";
import { getExercise, type ExerciseId } from "../calc/strength";
import { MIN_RECOMMENDED_FPS } from "../calc/video";
import { fmt, jumpLabels, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { videoStore } from "../app/videoStore";
import { getDb } from "../data/db";
import { createJumpTest, createNordicTest, createRunningTest, createTimedTest, createVbtTest, saveVideo } from "../data/repo";
import { getCodTest, isCodType, type CodType } from "../calc/cod";
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
  const tipo = params.get("tipo") ?? "cmj";
  const strength = tipo === "vbt";
  const nordic = tipo === "nordic";
  const running = tipo === "running";
  const timed = tipo === "sprint_linear" || isCodType(tipo);
  const speedLabel = tipo === "sprint_linear" ? "Sprint" : isCodType(tipo) ? (getCodTest(tipo)?.label ?? "Cambio de dirección") : "Carrera";
  const gates = (params.get("pasos") ?? "").split("-").map(Number).filter((n) => n > 0);
  const type = (strength ? "cmj" : tipo) as JumpType;
  const exercise = getExercise(params.get("ejercicio") ?? "");
  const romCm = params.get("recorrido") ? Number(params.get("recorrido")) : null;
  const extraLoadKg = Number(params.get("carga") ?? 0);
  const dropHeightCm = params.get("caida") ? Number(params.get("caida")) : null;
  const sideParam = params.get("lado");
  const side = sideParam === "left" || sideParam === "right" ? sideParam : null;

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
      // Si el móvil dejó escrito a cuántos fps grabó (Android), eso manda; si no, los del archivo.
      setCaptureFps(meta ? String(nominalFps(meta.captureFps ?? meta.fps)) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }

  const containerFps = picked?.meta ? nominalFps(picked.meta.fps) : parseDecimal(manualFps);
  const capture = picked?.meta ? Number(captureFps) : containerFps;
  const valid = !!picked && !!containerFps && !Number.isNaN(containerFps) && !!capture && capture > 0;
  const declaredFps = picked?.meta?.captureFps ? nominalFps(picked.meta.captureFps) : null;
  const fpsOptions = [
    ...new Set([...(containerFps && picked?.meta ? [containerFps] : []), ...(declaredFps ? [declaredFps] : []), ...COMMON_CAPTURE_FPS]),
  ].sort((a, b) => a - b);

  async function next() {
    if (!picked || !valid || !containerFps || !capture) return;
    setSaving(true);
    try {
      const db = getDb();
      const testId = running
        ? await createRunningTest(db, id, params.get("pie") === "right" ? "right" : "left", params.get("velocidad") ? Number(params.get("velocidad")) : null)
        : timed
        ? await createTimedTest(db, { patientId: id, type: tipo as "sprint_linear" | CodType, side, gates, method: "video" })
        : nordic
        ? await createNordicTest(db, id, "video")
        : strength
        ? await createVbtTest(db, { patientId: id, exercise: (exercise?.id ?? "squat") as ExerciseId, loadKg: extraLoadKg, romCm, method: "video" })
        : await createJumpTest(db, { patientId: id, type, extraLoadKg, dropHeightCm, side });
      await saveVideo(db, testId, {
        fileName: picked.file.name,
        captureFps: capture,
        containerFps,
        frameCount: picked.meta?.frameCount ?? Math.round(picked.durationS * containerFps),
        durationS: picked.meta?.durationS ?? picked.durationS,
        fpsSource: picked.meta && (capture === containerFps || capture === declaredFps) ? "container" : "user",
      });
      videoStore.set(testId, picked.file);
      navigate(`/tests/${testId}/marcar`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear la medición", "danger");
      setSaving(false);
    }
  }

  return (
    <Page
      title={
        running || timed
          ? `Vídeo · ${speedLabel}${side ? ` ${side === "left" ? "izq." : "dcha."}` : ""}`
          : nordic
          ? "Vídeo · Nórdico"
          : strength
          ? `Vídeo · ${exercise?.label ?? "Fuerza"} ${fmt(extraLoadKg, 0)} kg`
          : `Vídeo · ${jumpLabels[type]?.short ?? type}${side ? ` ${side === "left" ? "izq." : "dcha."}` : ""}`
      }
      backTo={running ? `/pacientes/${id}/test/carrera` : timed ? `/pacientes/${id}/test/sprint?tipo=${tipo}` : nordic ? `/pacientes/${id}/test/isquios` : strength ? `/pacientes/${id}/test/fuerza?${new URLSearchParams({ ejercicio: exercise?.id ?? "squat", carga: String(extraLoadKg) })}` : `/pacientes/${id}/test/saltos`}
    >
      <p className="text-text-muted">
        {running ? "Graba la carrera en cinta a cámara lenta y elígela aquí." : timed ? "Graba el recorrido de lado y elígelo aquí." : nordic ? "Graba el nórdico de lado y elígelo aquí." : `Graba ${strength ? "la serie" : "el salto"} a cámara lenta y elígelo aquí.`} El vídeo no sale de tu galería: OmniClin solo guarda las marcas y el resultado.
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
          {error} Si el móvil graba en formato de alta eficiencia (HEVC/H.265), desactívalo en los ajustes de la cámara
          (en Samsung: Ajustes de cámara → Opciones de vídeo avanzadas → «Vídeos de alta eficiencia») y graba de nuevo.
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
                hint={
                  declaredFps && declaredFps !== containerFps
                    ? `${picked.meta.device ?? "El móvil"} indica que grabó a ${fmt(declaredFps, 0)} fps; el archivo va a ${fmt(containerFps, 0)} fps porque la cámara lenta se guardó ralentizada. No hace falta cambiar nada.`
                    : `El archivo va a ${fmt(containerFps, 0)} fps. Si grabaste a cámara lenta y el vídeo se guardó ralentizado, elige los fps con los que grabaste (por ejemplo 240).`
                }
              >
                {fpsOptions.map((f) => (
                  <option key={f} value={f}>
                    {f} fps{f === declaredFps && f !== containerFps ? " (según el móvil)" : f === containerFps ? " (los del archivo)" : ""}
                  </option>
                ))}
              </SelectField>
              {capture !== null && capture < MIN_RECOMMENDED_FPS && !nordic && !timed && (
                <Alert tone="warning" title={`Grabación a ${fmt(capture, 0)} fps`}>
                  {strength
                    ? `Mejor a cámara lenta (120 fps o más). A ${fmt(capture, 0)} fps, un fotograma de error cambia la velocidad varios puntos.`
                    : `Para saltos hace falta cámara lenta (120 o 240 fps). A ${fmt(capture, 0)} fps, un fotograma de error mueve la altura varios centímetros.`}
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
            {running ? "Marcar los apoyos" : timed ? "Marcar los tiempos" : nordic ? "Marcar la rotura" : strength ? "Marcar las repeticiones" : "Marcar el salto"}
          </Button>
        </section>
      )}
    </Page>
  );
}
