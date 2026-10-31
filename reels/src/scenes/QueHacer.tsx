import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Check } from "../components/Icons";
import { Punch } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

const Bubble: React.FC<{ text: string; at: number; strikeAt: number }> = ({ text, at, strikeAt }) => {
  const frame = useCurrentFrame();
  const struck = frame >= strikeAt;
  return (
    <div
      style={{
        position: "relative",
        padding: "34px 50px",
        borderRadius: 40,
        borderBottomLeftRadius: 8,
        backgroundColor: struck ? "rgba(255,77,94,0.15)" : "rgba(255,255,255,0.1)",
        border: `4px solid ${struck ? COLORS.red : "rgba(255,255,255,0.4)"}`,
        fontWeight: 800,
        fontSize: 62,
        color: struck ? COLORS.red : COLORS.white,
        textAlign: "center",
        scale: String(interpolate(frame, [at, at + 12], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })),
        rotate: `${interpolate(frame, [strikeAt, strikeAt + 8], [0, -4], CLAMP)}deg`,
        boxShadow: struck ? `0 0 50px ${COLORS.red}66` : undefined,
      }}
    >
      «{text}»
      <div
        style={{
          position: "absolute",
          left: "-4%",
          width: "108%",
          height: 14,
          top: "50%",
          marginTop: -7,
          borderRadius: 7,
          backgroundColor: COLORS.red,
          boxShadow: `0 0 20px ${COLORS.red}`,
          rotate: "-9deg",
          transformOrigin: "left center",
          scale: `${interpolate(frame, [strikeAt, strikeAt + 7], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })} 1`,
        }}
      />
    </div>
  );
};

const Good: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, fontWeight: 900, fontSize: 58, color: COLORS.green, textAlign: "left", opacity: frame >= at ? 1 : 0, translate: `0px ${interpolate(frame, [at, at + 10], [40, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px` }}>
      <div style={{ flexShrink: 0, display: "flex" }}>
        <Check size={90} start={at} />
      </div>
      <span style={{ lineHeight: 1.05 }}>{text}</span>
    </div>
  );
};

/** Qué hacer: bocadillo tachado en rojo → dos ✓ verdes. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const [s0, s1] = c.s;
  const strike = wordAt(s0, "bloqueada") + 4;
  const g1 = wordAt(s1, "zona") - 4;
  const g2 = wordAt(s1, "reconoce") - 6;
  return (
    <Punch shakeAt={[strike, g1, g2]} amount={0.5}>
      <Stage gap={60}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: COLORS.muted }}>DEJA DE DECIR</div>
        <Bubble text="Tienes L4-L5 bloqueada" at={s0.start} strikeAt={strike} />
        <div style={{ display: "flex", flexDirection: "column", gap: 34, alignItems: "flex-start", width: 880 }}>
          <Good text="«Zona lumbar baja»" at={g1} />
          <Good text="El dolor que el paciente reconoce como suyo" at={g2} />
        </div>
      </Stage>
    </Punch>
  );
};
