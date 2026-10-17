// Lee del contenedor MP4/MOV los fps reales, el número de fotogramas y la duración,
// sin decodificar el vídeo y leyendo el archivo por trozos (los vídeos a 240 fps pesan mucho).
import { createFile, MP4BoxBuffer } from "mp4box";

export type ContainerMeta = {
  fps: number;
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

/** Valores de cámara lenta habituales en móviles, para sugerir los fps de grabación. */
export const COMMON_CAPTURE_FPS = [30, 60, 120, 240];

/** Redondea fps medidos (239,76...) al valor nominal más cercano si está a menos del 2 %. */
export function nominalFps(measured: number): number {
  const candidates = [24, 25, 30, 50, 60, 100, 120, 240, 480, 960];
  const best = candidates.reduce((a, b) => (Math.abs(b - measured) < Math.abs(a - measured) ? b : a));
  return Math.abs(best - measured) / best < 0.02 ? best : Math.round(measured * 100) / 100;
}
