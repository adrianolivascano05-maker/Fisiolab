// Lee del contenedor MP4/MOV los fps reales, el número de fotogramas y la duración,
// sin decodificar el vídeo y leyendo el archivo por trozos (los vídeos a 240 fps pesan mucho).
import { createFile, MP4BoxBuffer } from "mp4box";

export type ContainerMeta = {
  /** fps del archivo (los del reproductor). */
  fps: number;
  /**
   * fps de grabación declarados por el móvil, si los escribe. Android guarda
   * «com.android.capture.fps» (p. ej. 120 en un vídeo a cámara lenta guardado a 30).
   */
  captureFps: number | null;
  device: string | null;
  /** Hora de presentación de cada fotograma (s), ordenadas. Ver src/video/timeline.ts. */
  frameTimes: number[];
  frameCount: number;
  durationS: number;
  width: number;
  height: number;
  codec: string;
};

const CHUNK = 1024 * 1024;

export async function readContainerMeta(file: Blob): Promise<ContainerMeta> {
  const mp4 = createFile();
  let meta: ContainerMeta | null = null;
  let failure: string | null = null;
  mp4.onReady = (info) => {
    const track = info.videoTracks[0];
    if (!track) {
      failure = "El archivo no tiene pista de vídeo.";
      return;
    }
    const seconds = track.samples_duration / track.timescale || track.duration / track.timescale;
    meta = {
      fps: track.nb_samples / seconds,
      frameCount: track.nb_samples,
      durationS: seconds,
      width: track.video?.width ?? track.track_width,
      height: track.video?.height ?? track.track_height,
      codec: track.codec,
      ...deviceTags(mp4),
      frameTimes: sampleTimes(mp4, track.id),
    };
  };
  mp4.onError = (_module, message) => {
    failure = message;
  };

  // mp4box dice en cada paso por dónde seguir leyendo: así se salta el bloque de datos
  // y va directo al índice ("moov"), que en los vídeos del iPhone está al final.
  let offset = 0;
  while (!meta && !failure && offset < file.size) {
    const buf = MP4BoxBuffer.fromArrayBuffer(await file.slice(offset, offset + CHUNK).arrayBuffer(), offset);
    const next = mp4.appendBuffer(buf, offset + CHUNK >= file.size);
    offset = next > offset ? next : offset + CHUNK;
  }
  mp4.flush();
  if (meta) return meta;
  throw new Error(failure ?? "No se pudo leer el vídeo. ¿Es un MP4 o MOV?");
}

type Sample = { cts: number; timescale: number };

/** Horas de presentación de los fotogramas, del índice del archivo (no hace falta decodificar). */
function sampleTimes(mp4: unknown, trackId: number): number[] {
  const trak = (mp4 as { getTrackById?: (id: number) => { samples?: Sample[] } | undefined }).getTrackById?.(trackId);
  return (trak?.samples ?? []).map((s) => s.cts / s.timescale).sort((a, b) => a - b);
}

type MetaEntry = { value?: unknown };
type QtMeta = { type?: string; keys?: { keys: Record<number, string> }; ilst?: { list: Record<number, MetaEntry> } };
type Moov = { meta?: QtMeta; udta?: { meta?: QtMeta; boxes?: QtMeta[] } };

/**
 * Etiquetas de metadatos estilo QuickTime ("mdta") que escriben los móviles Android.
 * El Pixel las pone en moov/meta; otras herramientas, en moov/udta/meta: se leen las dos.
 */
function deviceTags(mp4: unknown): { captureFps: number | null; device: string | null } {
  const moov = (mp4 as { moov?: Moov }).moov;
  const metas = [moov?.meta, moov?.udta?.meta, ...(moov?.udta?.boxes ?? []).filter((b) => b.type === "meta")];
  const tags: Record<string, unknown> = {};
  for (const meta of metas) {
    for (const [index, key] of Object.entries(meta?.keys?.keys ?? {})) {
      tags[key.replace(/^mdta/, "")] ??= meta?.ilst?.list[Number(index)]?.value;
    }
  }
  const fps = Number(tags["com.android.capture.fps"]);
  const model = tags["com.android.model"];
  return {
    captureFps: Number.isFinite(fps) && fps > 0 ? fps : null,
    device: typeof model === "string" && model ? model : null,
  };
}

/** Valores de cámara lenta habituales en móviles, para sugerir los fps de grabación. */
export const COMMON_CAPTURE_FPS = [30, 60, 120, 240];

/** Redondea fps medidos (239,76...) al valor nominal más cercano si está a menos del 2 %. */
export function nominalFps(measured: number): number {
  const candidates = [24, 25, 30, 50, 60, 100, 120, 240, 480, 960];
  const best = candidates.reduce((a, b) => (Math.abs(b - measured) < Math.abs(a - measured) ? b : a));
  return Math.abs(best - measured) / best < 0.02 ? best : Math.round(measured * 100) / 100;
}
