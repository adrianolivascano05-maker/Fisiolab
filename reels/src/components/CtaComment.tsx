import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, CLAMP, STICKER } from "../config";
import { SceneClock, wordAt, wordEnd } from "../timeline";
import { CommentBox } from "./Engage";
import { pop } from "./Pictograms";
import { Punch, Slam } from "./Punch";
import { Stage } from "./Stage";

/** Cierre sin «parte X»: la caja de comentario teclea la palabra, el comentario se publica y suben los «me gusta»;
 *  al terminar la frase, «SÍGUEME» y «GUÁRDALO». `stamp` añade un sello opcional sobre la caja. */
export const CtaComment: React.FC<{ c: SceneClock; word: string; typed: string; stamp?: { text: string; at: string } }> = ({ c, word, typed, stamp }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const com = wordAt(s0, "comenta");
  const typeAt = wordAt(s0, word);
  const end = wordEnd(s0, s0.words[s0.words.length - 1]?.w ?? word) + 4;
  const stampAt = stamp ? wordAt(s0, stamp.at) : 0;
  const likeFrom = typeAt + typed.length * 5 + 20;
  const likes = Math.round(interpolate(frame, [likeFrom, Math.max(likeFrom + 20, end + 30)], [1, 47], CLAMP));
  return (
    <Punch dur={c.dur} shakeAt={[end]} amount={0.4}>
      <Stage gap={40} justify="flex-start">
        <div style={{ marginTop: 60, fontWeight: 800, fontSize: 40, letterSpacing: 6, color: COLORS.muted, opacity: frame >= com ? 1 : 0 }}>TU TURNO</div>
        <div style={{ position: "relative" }}>
          <CommentBox at={com} typeAt={typeAt} text={typed} width={820} />
          {stamp && frame >= stampAt ? (
            <div style={{ position: "absolute", right: 10, top: -58, fontWeight: 900, fontSize: 36, color: COLORS.red, border: `4px solid ${COLORS.red}`, padding: "8px 20px", borderRadius: 14, rotate: "-12deg", letterSpacing: 2, backgroundColor: COLORS.paper, scale: String(interpolate(frame, [stampAt, stampAt + 8], [2.4, 1], CLAMP)), opacity: interpolate(frame, [stampAt, stampAt + 3], [0, 1], CLAMP) }}>
              {stamp.text}
            </div>
          ) : null}
        </div>
        <div style={{ fontWeight: 900, fontSize: 52, color: COLORS.red, opacity: frame >= typeAt + typed.length * 5 + 20 ? 1 : 0, fontVariantNumeric: "tabular-nums" }}>♥ {likes}</div>
        {frame >= end ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, marginTop: 20 }}>
            <div style={{ padding: "24px 70px", borderRadius: 999, backgroundColor: COLORS.orange, color: COLORS.paper, fontWeight: 900, fontSize: 64, boxShadow: STICKER, scale: String(pop(frame, end)) }}>SÍGUEME</div>
            <Slam text="y guárdalo para consulta" at={end + 6} size={44} color={COLORS.muted} weight={700} spacing={1} />
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
