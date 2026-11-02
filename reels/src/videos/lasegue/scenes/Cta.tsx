import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CommentBox } from "../../../components/Engage";
import { Arrow, Cross } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { Stretch } from "../Pictos";

/** CTA: comentario «cruzado»; tarjeta Parte 4: el único ejercicio que no funcionó para el dolor lumbar. */
export const Cta: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const com = wordAt(s0, "comenta");
  const cruz = wordAt(s0, "cruzado");
  const parte = wordAt(s1, "parte");
  const unico = wordAt(s1, "único");
  const no = wordAt(s1, "no");
  const end = wordEnd(s1, "lumbar") + 6;
  return (
    <Punch dur={c.dur} shakeAt={[parte, no]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10, translate: `0px ${interpolate(frame, [parte, parte + 10], [0, -30], CLAMP)}px`, scale: String(interpolate(frame, [parte, parte + 10], [1, 0.8], CLAMP)), transformOrigin: "top center" }}>
          <CommentBox at={com} typeAt={cruz} text="cruzado" />
        </div>
        {frame >= parte ? (
          <div style={{ width: 900, padding: "30px 40px", borderRadius: 32, border: `2px solid ${COLORS.cyan}`, backgroundColor: COLORS.paper, boxShadow: STICKER, display: "flex", flexDirection: "column", gap: 14, translate: `${interpolate(frame, [parte, parte + 12], [1100, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: COLORS.cyan, fontWeight: 900, fontSize: 80, lineHeight: 1 }}>
              PARTE 4
              <div style={{ translate: `${Math.max(0, Math.sin((frame - parte) / 4)) * 16}px 0px`, display: "flex" }}>
                <Arrow size={80} color={COLORS.cyan} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: frame >= unico ? 1 : 0 }}>
              <div style={{ position: "relative" }}>
                <Stretch at={unico} size={200} />
                {frame >= no ? (
                  <div style={{ position: "absolute", left: 40, top: 30 }}>
                    <Cross size={130} start={no} />
                  </div>
                ) : null}
              </div>
              <div style={{ fontWeight: 900, fontSize: 50, color: COLORS.ink, lineHeight: 1.1 }}>
                el único ejercicio
                <br />
                <span style={{ color: COLORS.red, opacity: frame >= no ? 1 : 0, scale: String(pop(frame, no)) }}>que no funcionó</span>
              </div>
            </div>
          </div>
        ) : null}
        {frame >= end ? <Slam text="SÍGUEME PARA LA PARTE 4" at={end} size={44} color={COLORS.muted} weight={700} spacing={2} /> : null}
      </Stage>
    </Punch>
  );
};
