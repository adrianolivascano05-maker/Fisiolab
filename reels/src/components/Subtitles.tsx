import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, FPS, Timings, flatSentences, norm } from "../config";
import { LAYOUT, SAFE, fontFamily } from "../theme";

type Tok = { text: string; start: number; end: number; key: boolean };
type Chunk = { toks: Tok[]; start: number; end: number };

/** Convierte frases + tiempos de palabra en líneas de subtítulo, fusionando grupos con `display` (p. ej. «setenta y cinco» → «75»). */
export const buildChunks = (t: Timings): Chunk[] => {
  const out: Chunk[] = [];
  flatSentences().forEach(({ sentence }, i) => {
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
      out.push({ toks, start: toks[0].start, end: toks[toks.length - 1].end });
    });
  });
  return out;
};

/** Subtítulos «héroe»: la línea actual en grande y la palabra que se está diciendo salta y se tiñe de naranja. */
export const Subtitles: React.FC<{ timings: Timings }> = ({ timings }) => {
  const frame = useCurrentFrame();
  const chunks = buildChunks(timings);
  const i = chunks.findIndex((c, k) => frame >= c.start - 2 && (k + 1 >= chunks.length ? frame <= c.end + FPS * 1.5 : frame < chunks[k + 1].start - 2));
  if (i < 0) return null;
  const c = chunks[i];
  const cur = c.toks.findIndex((tk, k) => frame >= tk.start && (k + 1 >= c.toks.length || frame < c.toks[k + 1].start));
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
        rowGap: 6,
        fontFamily,
        fontWeight: 900,
        fontSize: 68,
        lineHeight: 1.12,
        textAlign: "center",
        color: COLORS.white,
        textShadow: "0 4px 24px rgba(0,0,0,0.85)",
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
              padding: "0 14px",
              color: active ? COLORS.orange : tk.key ? COLORS.orange : said ? COLORS.white : "rgba(255,255,255,0.35)",
              textShadow: active || tk.key ? `0 0 30px ${COLORS.orange}aa` : undefined,
              scale: String(active ? interpolate(frame, [tk.start, tk.start + 5], [1.2, 1.12], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) }) : 1),
              translate: active ? "0px -3px" : "0px 0px",
              opacity: interpolate(frame, [c.start - 2, c.start + 2], [0, 1], CLAMP),
            }}
          >
            {tk.text}
          </span>
        );
      })}
    </div>
  );
};
