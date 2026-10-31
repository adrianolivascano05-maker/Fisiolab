import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Arrow } from "../components/Icons";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { SceneProps } from "./types";

/** CTA: botón «Comenta L4» con rebote; tarjeta «PARTE 2 →». */
export const Cta: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const btn = s0.start + 2;
  const part2 = s1.start;
  const bounce = frame > btn + 14 ? 1 + 0.04 * Math.max(0, Math.sin((frame - btn) / 5)) : 1;
  return (
    <Punch shakeAt={[part2]} amount={0.6}>
      <Stage gap={50}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: COLORS.muted, opacity: interpolate(frame, [btn, btn + 8], [0, 1], CLAMP) }}>¿LO HAS DICHO ALGUNA VEZ?</div>
        <div
          style={{
            padding: "38px 70px",
            borderRadius: 999,
            backgroundColor: COLORS.orange,
            color: COLORS.ink,
            fontWeight: 900,
            fontSize: 96,
            letterSpacing: -2,
            boxShadow: `0 0 80px ${COLORS.orange}aa`,
            scale: String(interpolate(frame, [btn, btn + 14], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }) * bounce),
            rotate: `${interpolate(frame, [btn, btn + 14], [-8, 0], CLAMP)}deg`,
          }}
        >
          Comenta «L4»
        </div>
        {frame >= part2 ? (
          <div
            style={{
              marginTop: 30,
              width: 880,
              padding: "40px 48px",
              borderRadius: 36,
              border: `4px solid ${COLORS.cyan}`,
              backgroundColor: "rgba(79,209,255,0.1)",
              boxShadow: `0 0 ${50 + 25 * Math.sin((frame - part2) / 6)}px ${COLORS.cyan}66`,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              translate: `${interpolate(frame, [part2, part2 + 12], [1100, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: COLORS.cyan, fontWeight: 900, fontSize: 84, lineHeight: 1 }}>
              PARTE 2{" "}
              <div style={{ translate: `${Math.max(0, Math.sin((frame - part2) / 4)) * 16}px 0px`, display: "flex" }}>
                <Arrow size={84} color={COLORS.cyan} />
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 42, color: COLORS.white, lineHeight: 1.2 }}>El test que usamos a diario y que ni confirma ni descarta</div>
          </div>
        ) : null}
        {frame >= c.s[c.s.length - 1].end + 4 ? <Slam text="SÍGUEME PARA LA PARTE 2" at={c.s[c.s.length - 1].end + 4} size={48} color={COLORS.muted} weight={700} spacing={2} /> : null}
      </Stage>
    </Punch>
  );
};
