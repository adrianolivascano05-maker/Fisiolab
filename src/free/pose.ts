// Detección de pose con MediaPipe Pose Landmarker (Apache 2.0), en el propio navegador.
// El modelo y el motor van dentro de la app: no se envía nada a ningún servidor.
// Se carga solo al usarlo (≈ 19 MB la primera vez).
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
// El paquete no exporta sus archivos wasm: se toman de node_modules por ruta.
import wasmLoaderPath from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url";
import wasmBinaryPath from "../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url";
import modelAssetPath from "./assets/pose_landmarker_full.task?url";
import type { Landmark3D } from "./types";

let detector: Promise<PoseLandmarker> | null = null;

/** Crea el detector una vez. Prueba con la GPU y, si falla, con la CPU. */
export function loadPoseDetector(): Promise<PoseLandmarker> {
  detector ??= (async () => {
    const { PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = { wasmLoaderPath, wasmBinaryPath };
    const make = (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return await make("GPU");
    } catch {
      return await make("CPU");
    }
  })();
  detector.catch(() => {
    detector = null; // Permite reintentar.
  });
  return detector;
}

/** Pose del fotograma que muestra ahora el vídeo, o null si no hay nadie. */
export function detectPose(d: PoseLandmarker, video: HTMLVideoElement, timestampMs: number): { image: Landmark3D[]; world: Landmark3D[] } | null {
  const r = d.detectForVideo(video, timestampMs);
  const image = r.landmarks[0];
  const world = r.worldLandmarks[0];
  if (!image || !world) return null;
  const copy = (l: { x: number; y: number; z: number; visibility?: number }): Landmark3D => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility });
  return { image: image.map(copy), world: world.map(copy) };
}
