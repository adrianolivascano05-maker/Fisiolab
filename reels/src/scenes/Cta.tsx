import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CommentBox } from "../components/Engage";
import { Arrow, Cross } from "../components/Icons";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** CTA: caja de comentario que teclea «L4», sello de «seguridad», tarjeta Parte 2 y ✗ en confirma/descarta. */
export const Cta: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const com = wordAt(s0, "comenta");
  const l4 = wordAt(s0, "l4");
  const seg = wordAt(s0, "seguridad");
  const parte = wordAt(s1, "parte");
  const test = wordAt(s1, "test");
  const conf = wordAt(s1, "confirma");
  const desc = wordAt(s1, "descarta");
  const end = wordEnd(s1, "descarta") + 6;
  const lift = interpolate(frame, [parte, parte + 10], [0, -40], CLAMP);
  return (
    <Punch shakeAt={[seg, parte]} amount={0.6}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10, translate: `0px ${lift}px`, scale: String(interpolate(frame, [parte, parte + 10], [1, 0.8], CLAMP)), transformOrigin: "top center", position: "relative" }}>
          <CommentBox at={com} typeAt={l4} text="L4" />
          {frame >= seg ? (
            <div style={{ position: "absolute", right: -20, top: 24, fontWeight: 900, fontSize: 38, color: COLORS.red, border: `5px solid ${COLORS.red}`, padding: "8px 20px", borderRadius: 14, rotate: "-12deg", letterSpacing: 2, backgroundColor: "rgba(5,12,26,0.8)", scale: String(interpolate(frame, [seg, seg + 8], [3, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })), opacity: interpolate(frame, [seg, seg + 3], [0, 1], CLAMP) }}>
              100 % SEGURO
            </div>
          ) : null}
        </div>
        {frame >= parte ? (
          <div style={{ width: 900, padding: "34px 44px", borderRadius: 36, border: `4px solid ${COLORS.cyan}`, backgroundColor: "rgba(79,209,255,0.1)", boxShadow: `0 0 ${50 + 25 * Math.sin((frame - parte) / 6)}px ${COLORS.cyan}66`, display: "flex", flexDirection: "column", gap: 16, translate: `${interpolate(frame, [parte, parte + 12], [1100, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: COLORS.cyan, fontWeight: 900, fontSize: 80, lineHeight: 1 }}>
              PARTE 2
              <div style={{ translate: `${Math.max(0, Math.sin((frame - parte) / 4)) * 16}px 0px`, display: "flex" }}>
                <Arrow size={80} color={COLORS.cyan} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: frame >= test ? 1 : 0 }}>
              <div style={{ width: 90, height: 90, borderRadius: 20, border: `4px solid ${COLORS.white}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 60, color: COLORS.white, scale: String(interpolate(frame, [test, test + 10], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })) }}>?</div>
              <div style={{ fontWeight: 700, fontSize: 40, color: COLORS.white, lineHeight: 1.15 }}>El test que usamos a diario</div>
            </div>
            <div style={{ display: "flex", gap: 30, justifyContent: "center", marginTop: 6 }}>
              {[{ t: "CONFIRMA", at: conf }, { t: "DESCARTA", at: desc }].map((x) => (
                <div key={x.t} style={{ position: "relative", fontWeight: 900, fontSize: 46, color: frame >= x.at ? COLORS.red : "rgba(255,255,255,0.4)", padding: "10px 22px", border: `4px solid ${frame >= x.at ? COLORS.red : "rgba(255,255,255,0.25)"}`, borderRadius: 16 }}>
                  {x.t}
                  {frame >= x.at ? <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}><Cross size={110} start={x.at} /></div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {frame >= end ? <Slam text="SÍGUEME PARA LA PARTE 2" at={end} size={44} color={COLORS.muted} weight={700} spacing={2} /> : null}
      </Stage>
    </Punch>
  );
};
