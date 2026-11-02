import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CommentBox } from "../../../components/Engage";
import { Arrow } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { SLR } from "../Pictos";

/** CTA: comentario «original»; tarjeta Parte 4: el Lasègue, que la revisión interpreta al revés. */
export const Cta: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const com = wordAt(s0, "comenta");
  const orig = wordAt(s0, "original");
  const parte = wordAt(s1, "parte");
  const las = wordAt(s1, "lasègue");
  const reves = wordAt(s1, "revés");
  const end = wordEnd(s1, "revés") + 6;
  return (
    <Punch dur={c.dur} shakeAt={[parte, reves]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10, translate: `0px ${interpolate(frame, [parte, parte + 10], [0, -30], CLAMP)}px`, scale: String(interpolate(frame, [parte, parte + 10], [1, 0.8], CLAMP)), transformOrigin: "top center" }}>
          <CommentBox at={com} typeAt={orig} text="original" />
        </div>
        {frame >= parte ? (
          <div style={{ width: 900, padding: "30px 40px", borderRadius: 32, border: `2px solid ${COLORS.cyan}`, backgroundColor: COLORS.paper, boxShadow: STICKER, display: "flex", flexDirection: "column", gap: 14, translate: `${interpolate(frame, [parte, parte + 12], [1100, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: COLORS.cyan, fontWeight: 900, fontSize: 80, lineHeight: 1 }}>
              PARTE 4
              <div style={{ translate: `${Math.max(0, Math.sin((frame - parte) / 4)) * 16}px 0px`, display: "flex" }}>
                <Arrow size={80} color={COLORS.cyan} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: frame >= las ? 1 : 0 }}>
              <SLR at={las} size={230} flipAt={reves} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.ink, lineHeight: 1 }}>LASÈGUE</div>
                <div style={{ fontWeight: 900, fontSize: 40, color: COLORS.red, marginTop: 10, opacity: frame >= reves ? 1 : 0, scale: String(pop(frame, reves)) }}>interpretado al revés</div>
              </div>
            </div>
          </div>
        ) : null}
        {frame >= end ? <Slam text="SÍGUEME PARA LA PARTE 4" at={end} size={44} color={COLORS.muted} weight={700} spacing={2} /> : null}
      </Stage>
    </Punch>
  );
};
