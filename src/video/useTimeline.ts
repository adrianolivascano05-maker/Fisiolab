import { useEffect, useState, type RefObject } from "react";
import { readContainerMeta } from "./meta";
import type { Timeline } from "./timeline";

type FrameCallback = (now: number, meta: { mediaTime: number }) => void;
type VideoWithRvfc = HTMLVideoElement & { requestVideoFrameCallback?: (cb: FrameCallback) => number };

/**
 * Diferencia entre la hora del archivo y la del reproductor. Se pide el primer fotograma y se mira
 * qué hora dice el navegador que tiene (requestVideoFrameCallback). Así se absorben inicios retrasados,
 * listas de edición y el desfase de los fotogramas B. Si el navegador no lo permite, se supone que el
 * primer fotograma está en 0.
 */
function calibrate(v: VideoWithRvfc, times: number[]): Promise<number> {
  const fallback = -times[0]!;
  if (!v.requestVideoFrameCallback) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), 1500);
    v.requestVideoFrameCallback!((_now, meta) => {
      clearTimeout(timer);
      resolve(meta.mediaTime - times[0]!);
    });
    v.currentTime = v.currentTime === 0 ? 0.0005 : 0;
  });
}

/**
 * Línea de tiempo real del vídeo para moverse fotograma a fotograma.
 * `ready` es falso mientras se calibra: entonces no se debe mover el reproductor.
 */
export function useTimeline(file: File, video: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<{ timeline: Timeline | null; ready: boolean }>({ timeline: null, ready: false });
  useEffect(() => {
    let alive = true;
    setState({ timeline: null, ready: false });
    (async () => {
      let times: number[] = [];
      try {
        times = (await readContainerMeta(file)).frameTimes;
      } catch {
        /* sin índice legible: se usará el ritmo fijo */
      }
      const v = video.current as VideoWithRvfc | null;
      if (!times.length || !v) return alive && setState({ timeline: null, ready: true });
      if (v.readyState < 2) await new Promise((r) => v.addEventListener("loadeddata", r, { once: true }));
      const offset = await calibrate(v, times);
      if (alive) setState({ timeline: { times, offset }, ready: true });
    })();
    return () => {
      alive = false;
    };
  }, [file, video]);
  return state;
}
