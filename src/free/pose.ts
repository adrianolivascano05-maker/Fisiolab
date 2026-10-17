// Detección de pose con MediaPipe Pose Landmarker (Apache 2.0), en el propio navegador.
// El modelo y el motor van dentro de la app: no se envía nada a ningún servidor.
// Se carga solo al usarlo (≈ 19 MB la primera vez).
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
// El paquete no exporta sus archivos wasm: se toman de node_modules por ruta.
import wasmLoaderPath from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url";
import wasmBinaryPath from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url";
import modelAssetPath from "./assets/pose_landmarker_full.task?url";
import type { Landmark3D } from "./types";

export type Delegate = "GPU" | "CPU";
export type Detector = { landmarker: PoseLandmarker; delegate: Delegate };

const detectors: Partial<Record<Delegate, Promise<Detector>>> = {};

async function create(delegate: Delegate): Promise<Detector> {
  const { PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const landmarker = await PoseLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    },
  );
  return { landmarker, delegate };
}

/** Crea el detector una vez por tipo. Con "GPU", si la tarjeta gráfica falla, se queda con la CPU. */
export function loadPoseDetector(delegate: Delegate = "GPU"): Promise<Detector> {
  let p = detectors[delegate];
  if (!p) {
    p = delegate === "GPU" ? create("GPU").catch(() => loadPoseDetector("CPU")) : create("CPU");
    detectors[delegate] = p;
    p.catch(() => {
      delete detectors[delegate]; // Permite reintentar.
    });
  }
  return p;
}

/** Lado mayor de la imagen que se pasa al detector: el modelo trabaja a 256 px; más solo gasta tiempo. */
const MAX_SIDE = 960;

/**
 * Copia el fotograma visible del vídeo a un lienzo pequeño. Así el detector recibe la imagen ya
 * girada como se ve (los vídeos del móvil llevan el giro aparte) y trabaja más deprisa.
 */
export function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const k = Math.min(1, MAX_SIDE / Math.max(vw, vh));
  const w = Math.round(vw * k);
  const h = Math.round(vh * k);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return canvas;
}

/**
 * El detector en modo vídeo exige tiempos siempre crecientes durante toda la sesión (aunque se
 * cambie de vídeo): se lleva un reloj propio, compartido por todos los vídeos.
 */
let clock = 0;

/** Pose de una imagen, o null si no hay nadie. */
export function detectPose(d: Detector, image: HTMLCanvasElement): { image: Landmark3D[]; world: Landmark3D[] } | null {
  clock += 1000 / 30;
  const r = d.landmarker.detectForVideo(image, clock);
  const points = r.landmarks[0];
  const world = r.worldLandmarks[0];
  if (!points || !world) return null;
  const copy = (l: { x: number; y: number; z: number; visibility?: number }): Landmark3D => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility });
  return { image: points.map(copy), world: world.map(copy) };
}
