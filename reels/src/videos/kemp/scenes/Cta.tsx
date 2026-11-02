import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CommentBox } from "../../../components/Engage";
import { Arrow, Check, Cross } from "../../../components/Icons";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { Pelvis } from "../Pictos";

/** CTA: comentario que teclea «Kemp»; tarjeta Parte 3: sacroilíaca, un test no basta, necesitas tres. */
export const Cta: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const com = wordAt(s0, "comenta");
  const kemp = wordAt(s0, "kemp");
  const parte = wordAt(s1, "parte");
  const sacro = wordAt(s1, "sacroilíaca");
  const uno = wordAt(s1, "un");
  const basta = wordAt(s1, "basta");
  const tres = wordAt(s1, "tres", 1);
  const end = wordEnd(s1, "tres", 1) + 6;
  return (
    <Punch dur={c.dur} shakeAt={[parte, basta]} amount={0.6}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10, translate: `0px ${interpolate(frame, [parte, parte + 10], [0, -30], CLAMP)}px`, scale: String(interpolate(frame, [parte, parte + 10], [1, 0.8], CLAMP)), transformOrigin: "top center" }}>
          <CommentBox at={com} typeAt={kemp} text="Kemp" />
        </div>
        {frame >= parte ? (
          <div style={{ width: 900, padding: "30px 40px", borderRadius: 36, border: `4px solid ${COLORS.cyan}`, backgroundColor: COLORS.paper, boxShadow: STICKER, display: "flex", flexDirection: "column", gap: 14, translate: `${interpolate(frame, [parte, parte + 12], [1100, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: COLORS.cyan, fontWeight: 900, fontSize: 80, lineHeight: 1 }}>
              PARTE 3
              <div style={{ translate: `${Math.max(0, Math.sin((frame - parte) / 4)) * 16}px 0px`, display: "flex" }}>
                <Arrow size={80} color={COLORS.cyan} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: frame >= sacro ? 1 : 0 }}>
              <Pelvis at={sacro} size={170} />
              <div style={{ fontWeight: 900, fontSize: 52, color: COLORS.white, lineHeight: 1.1 }}>SACROILÍACA</div>
            </div>
            <div style={{ display: "flex", gap: 30, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
              <div style={{ position: "relative", fontWeight: 900, fontSize: 48, color: frame >= basta ? COLORS.red : COLORS.white, padding: "10px 22px", border: `4px solid ${frame >= basta ? COLORS.red : "rgba(11,18,32,0.4)"}`, borderRadius: 16, opacity: frame >= uno ? 1 : 0 }}>
                1 TEST
                {frame >= basta ? <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}><Cross size={110} start={basta} /></div> : null}
              </div>
              <div style={{ display: "flex", gap: 10, opacity: frame >= tres ? 1 : 0 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 80, height: 80, borderRadius: 20, border: `4px solid ${COLORS.green}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,196,182,0.15)" }}>
                    <Check size={60} start={tres + i * 4} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {frame >= end ? <Slam text="SÍGUEME PARA LA PARTE 3" at={end} size={44} color={COLORS.muted} weight={700} spacing={2} /> : null}
      </Stage>
    </Punch>
  );
};
