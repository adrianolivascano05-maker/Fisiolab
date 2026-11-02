import { interpolate, useCurrentFrame } from "remotion";
import { springAt } from "../motion";
import { CLAMP, COLORS, FPS, SceneDef, Timings, flatSentences, norm, STICKER_SM } from "../config";
import { LAYOUT, SAFE, fontFamily } from "../theme";

type Tok = { text: string; start: number; end: number; key: boolean };
type Chunk = { toks: Tok[]; start: number; end: number };

/** Convierte frases + tiempos de palabra en líneas de subtítulo, fusionando grupos con `display` (p. ej. «setenta y cinco» → «75»). */
export const buildChunks = (scenes: SceneDef[], t: Timings): Chunk[] => {
  const out: Chunk[] = [];
  flatSentences(scenes).forEach(({ sentence }, i) => {
    const st = t.sentences[i];
    const words = st.words ?? [];
    const parts = sentence.chunks ?? [sentence.text];
    const keys = (sentence.keys ?? []).map(norm);
    const display = Object.entries(sentence.display ?? {}).map(([k, v]) => ({ spoken: k.split(/\s+/).map(norm), show: v }));
    let wi = 0;
    parts.forEach((p) => {
      const raw = p.split(/\s+/).filter(Boolean);
      const toks: Tok[] = [];
      let k = 0;
      while (k < raw.length) {
        const w = words[wi] ?? { start: st.start, end: st.end };
        const d = display.find((x) => x.spoken.every((s, j) => norm(raw[k + j] ?? "") === s));
        if (d) {
          const n = d.spoken.length;
          const last = words[wi + n - 1] ?? w;
          const trail = raw[k + n - 1].match(/[.,:;?!…»"]+$/)?.[0] ?? "";
          toks.push({ text: d.show + trail, start: w.start * FPS, end: last.end * FPS, key: keys.includes(norm(d.show)) });
          k += n; wi += n;
        } else {
          toks.push({ text: raw[k], start: w.start * FPS, end: w.end * FPS, key: keys.includes(norm(raw[k])) });
          k++; wi++;
        }
      }
      // Páginas de 4 palabras como máximo (estilo TikTok)
      for (let a = 0; a < toks.length; a += 4) {
        const page = toks.slice(a, a + 4);
        out.push({ toks: page, start: page[0].start, end: page[page.length - 1].end });
      }
    });
  });
  return out;
};

/** Subtítulos «héroe»: la línea actual en grande y la palabra que se está diciendo salta y se tiñe de naranja. */
export const Subtitles: React.FC<{ scenes: SceneDef[]; timings: Timings }> = ({ scenes, timings }) => {
  const frame = useCurrentFrame();
  const chunks = buildChunks(scenes, timings);
  const i = chunks.findIndex((c, k) => frame >= c.start - 2 && (k + 1 >= chunks.length ? frame <= c.end + FPS * 1.5 : frame < chunks[k + 1].start - 2));
  if (i < 0) return null;
  const c = chunks[i];
  const cur = c.toks.findIndex((tk, k) => frame >= tk.start && (k + 1 >= c.toks.length || frame < c.toks[k + 1].start));
  const pageIn = springAt(frame, c.start - 2, { damping: 15, stiffness: 100 });
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
        columnGap: 6,
        rowGap: 2,
        fontFamily,
        fontWeight: 900,
        fontSize: 78,
        lineHeight: 1.12,
        textAlign: "center",
        color: COLORS.white,
        textShadow: "none",
        translate: `0px ${30 * (1 - pageIn)}px`,
      }}
    >
      {c.toks.map((tk, k) => {
        const said = frame >= tk.start;
        const active = k === cur;
        return (
          <span
            key={`${i}-${k}`}
            style={{
              display: "inline-block",
              padding: "0 12px",
              borderRadius: 18,
              backgroundColor: active ? COLORS.amber : "transparent",
              boxShadow: active ? STICKER_SM : undefined,
              color: active ? COLORS.ink : tk.key ? COLORS.orange : said ? COLORS.ink : "rgba(11,18,32,0.35)",
              scale: String(active ? 1 + 0.05 * springAt(frame, tk.start, { damping: 14, stiffness: 160, mass: 0.6 }) : 1),
              translate: `0px ${8 * (1 - springAt(frame, tk.start, { damping: 12, stiffness: 200, mass: 0.8 }))}px`,
              opacity: Math.min(1, interpolate(frame, [c.start - 3, c.start + 3], [0, 1], CLAMP) * (said ? 1 : 0.9)),
            }}
          >
            {tk.text}
          </span>
        );
      })}
    </div>
  );
};
