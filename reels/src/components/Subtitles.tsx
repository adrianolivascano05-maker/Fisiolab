import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, FPS, Timings, flatSentences } from "../config";
import { LAYOUT, SAFE, fontFamily } from "../theme";

type Chunk = { words: string[]; start: number; end: number; keys: string[] };

const strip = (w: string) => w.replace(/[«»"“”¿?¡!,.:;()]/g, "");

/** Divide cada frase en trozos de subtítulo con tiempos proporcionales a sus caracteres. */
export const buildChunks = (t: Timings): Chunk[] => {
  const flat = flatSentences();
  const out: Chunk[] = [];
  flat.forEach(({ sentence }, i) => {
    const { start, end } = t.sentences[i];
    const parts = sentence.chunks ?? [sentence.text];
    const total = parts.reduce((a, p) => a + p.length, 0);
    let acc = 0;
    parts.forEach((p) => {
      const s0 = start + ((end - start) * acc) / total;
      acc += p.length;
      const s1 = start + ((end - start) * acc) / total;
      out.push({ words: p.split(" "), start: s0 * FPS, end: s1 * FPS, keys: sentence.keys ?? [] });
    });
  });
  return out;
};

/** Subtítulos grandes sincronizados con la voz, palabra a palabra, con la palabra clave en naranja. */
export const Subtitles: React.FC<{ timings: Timings }> = ({ timings }) => {
  const frame = useCurrentFrame();
  const chunks = buildChunks(timings);
  const i = chunks.findIndex((c, k) => frame >= c.start - 2 && (k + 1 >= chunks.length ? frame <= c.end + FPS * 1.2 : frame < chunks[k + 1].start - 2));
  if (i < 0) return null;
  const c = chunks[i];
  const chars = c.words.reduce((a, w) => a + w.length + 1, 0);
  let acc = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.side,
        right: SAFE.side,
        top: LAYOUT.subTop,
        height: LAYOUT.subBottom - LAYOUT.subTop,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        columnGap: 18,
        rowGap: 4,
        fontFamily,
        fontWeight: 900,
        fontSize: 64,
        lineHeight: 1.15,
        textAlign: "center",
        color: COLORS.white,
        textShadow: "0 4px 24px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
      }}
    >
      {c.words.map((w, k) => {
        const at = c.start + ((c.end - c.start) * 0.85 * acc) / chars;
        acc += w.length + 1;
        const key = c.keys.includes(strip(w));
        return (
          <span
            key={`${i}-${k}`}
            style={{
              display: "inline-block",
              color: key ? COLORS.orange : COLORS.white,
              textShadow: key ? `0 0 26px ${COLORS.orange}99` : undefined,
              opacity: interpolate(frame, [at, at + 3], [0, 1], CLAMP),
              scale: interpolate(frame, [at, at + 8], [1.35, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
