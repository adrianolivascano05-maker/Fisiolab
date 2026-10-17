// Recorre el vídeo, detecta la pose y propone las marcas de un salto o de una serie de fuerza.
// Dos pasadas: una rápida por todo el vídeo (≈ 30 imágenes por segundo real en saltos, 12 en fuerza)
// y otra fotograma a fotograma alrededor de cada marca, para dejarla en el fotograma exacto.
import type { JumpType, MarkInput } from "../calc/results";
import { barSample, detectReps, type BarSample } from "./barDetect";
import { detectJump, jumpSample, refineFrames, type Detection, type JumpSample } from "./jumpDetect";
import { detectPose, grabFrame, loadPoseDetector, type Detector } from "./pose";

export type AutoTarget = { kind: "jump"; type: JumpType } | { kind: "bar"; exercise: string };

export type AutoOptions = {
  video: HTMLVideoElement;
  /** Tiempo del reproductor en el que se ve cada fotograma del archivo. */
  timeOf: (frame: number) => number;
  lastFrame: number;
  /** fps de grabación: un fotograma del archivo es 1/captureFps s de tiempo real. */
  captureFps: number;
  onProgress: (label: string, done: number, total: number) => void;
  cancelled: () => boolean;
};

/** Lleva el vídeo a un tiempo y espera a que se vea ese fotograma, con límite (si el móvil no avisa, se sigue). */
export async function seekVideo(v: HTMLVideoElement, t: number) {
  if (Math.abs(v.currentTime - t) < 1e-4 && !v.seeking) return;
  const painted = new Promise<void>((resolve) => {
    if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(() => resolve());
    else resolve();
  });
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      v.removeEventListener("seeked", done);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
  await Promise.race([painted, new Promise((r) => setTimeout(r, 200))]);
}

const MAX_COARSE = 400;

/** Propone las marcas. Lanza un Error con un mensaje para el usuario si no se puede. */
export async function autoMark(target: AutoTarget, o: AutoOptions): Promise<{ marks: MarkInput[]; warnings: string[] }> {
  const hz = target.kind === "jump" ? 30 : 12;
  const step = Math.max(1, Math.round(o.captureFps / hz), Math.ceil((o.lastFrame + 1) / MAX_COARSE));
  const canvas = document.createElement("canvas");
  o.onProgress("Cargando la IA…", 0, 0);
  let detector: Detector = await loadPoseDetector();
  const exercise = target.kind === "bar" ? target.exercise : "";
  const jumpSamples = new Map<number, JumpSample>();
  const barSamples = new Map<number, BarSample>();

  async function run(frames: number[], label: string, d: Detector) {
    let found = 0;
    for (const [i, f] of frames.entries()) {
      if (o.cancelled()) throw new Error("Cancelado.");
      o.onProgress(label, i, frames.length);
      await seekVideo(o.video, o.timeOf(f));
      const img = grabFrame(o.video, canvas);
      const pose = img ? detectPose(d, img) : null;
      if (pose) found++;
      if (target.kind === "jump") jumpSamples.set(f, jumpSample(f, pose?.image ?? null));
      else barSamples.set(f, barSample(f, pose?.image ?? null, exercise));
    }
    return found;
  }
  const detect = (): Detection =>
    target.kind === "jump" ? detectJump(target.type, [...jumpSamples.values()], o.captureFps) : detectReps([...barSamples.values()]);

  const coarse: number[] = [];
  for (let f = 0; f <= o.lastFrame; f += step) coarse.push(f);
  let found = await run(coarse, "Buscando el movimiento…", detector);
  // Si la tarjeta gráfica no ve a nadie, se prueba con la CPU (algunos móviles fallan sin avisar).
  if (found === 0 && detector.delegate === "GPU") {
    const cpu = await loadPoseDetector("CPU");
    const probe = coarse.filter((_, i) => i % Math.ceil(coarse.length / 4) === 0);
    if ((await run(probe, "Probando sin la tarjeta gráfica…", cpu)) > 0) {
      detector = cpu;
      found = await run(coarse, "Repitiendo con la CPU…", detector);
    }
  }
  if (found === 0) throw new Error("No se detecta a ninguna persona. Comprueba que se ve el cuerpo entero y con buena luz.");

  let result = detect();
  // Afinado: fotograma a fotograma alrededor de cada marca, hasta que no cambie (máximo 3 vueltas).
  for (let pass = 0; pass < 3 && "marks" in result; pass++) {
    const sampled = new Set(target.kind === "jump" ? jumpSamples.keys() : barSamples.keys());
    const extra = refineFrames(result.marks, sampled, step, o.lastFrame);
    if (!extra.length) break;
    await run(extra, "Afinando cada marca…", detector);
    result = detect();
  }
  if ("error" in result) throw new Error(result.error);
  return result;
}
