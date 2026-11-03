import { interpolate, useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { WristHand } from "../Pictos";

/** Qué hacer: confirma el túnel carpiano con la exploración y mira si el dolor sigue el recorrido del nervio. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const conf = wordAt(s0, "confirma");
  const expl = wordAt(s0, "exploración");
  const rec = wordAt(s1, "recorrido");
  const ner = wordAt(s1, "nervio");
  const row = (text: string, at: number, checkAt: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), transformOrigin: "left center" }}>
      <div style={{ width: 70, height: 70, borderRadius: 16, border: `3px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{frame >= checkAt ? <Check size={60} start={checkAt} /> : null}</div>
      <div style={{ fontWeight: 900, fontSize: 42, color: COLORS.ink, lineHeight: 1.1, whiteSpace: "pre-line" }}>{text}</div>
    </div>
  );
  return (
    <Punch dur={c.dur} shakeAt={[ner]} amount={0.4}>
      <Stage gap={22} justify="flex-start">
        <div style={{ marginTop: 4 }}>
          <Slam text="MAÑANA EN CONSULTA" at={s0.start} size={62} color={COLORS.ink} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 520, padding: "26px 28px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, display: "flex", flexDirection: "column", gap: 26, opacity: frame >= conf ? 1 : 0, scale: String(pop(frame, conf)) }}>
            {row("confírmalo con\nla exploración", conf, expl)}
            {row("¿sigue el recorrido\ndel nervio?", s1.start, ner + 6)}
          </div>
          <WristHand at={conf} size={260} tunnel={1} nerve={interpolate(frame, [rec, rec + 14], [0.15, 1], CLAMP)} territory={interpolate(frame, [ner, ner + 10], [0, 1], CLAMP)} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 32, color: COLORS.orange, opacity: frame >= ner ? 1 : 0 }}>nervio mediano: pulgar, índice, medio y medio anular</div>
      </Stage>
    </Punch>
  );
};
