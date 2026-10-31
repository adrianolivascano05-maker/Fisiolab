import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { CLAMP } from "../config";

/** Entrada de escena con «punch» de escala y temblor opcional alrededor de un frame. */
export const Punch: React.FC<{ children: React.ReactNode; shakeAt?: number[]; amount?: number }> = ({ children, shakeAt = [], amount = 1 }) => {
  const frame = useCurrentFrame();
  let sx = 0;
  let sy = 0;
  for (const a of shakeAt) {
    const d = frame - a;
    if (d >= 0 && d < 14) {
      const k = (1 - d / 14) * 22 * amount;
      sx += (random(`sx${a}${frame}`) - 0.5) * k;
      sy += (random(`sy${a}${frame}`) - 0.5) * k;
    }
  }
  return (
    <AbsoluteFill
      style={{
        scale: interpolate(frame, [0, 9], [1.14, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        translate: `${sx}px ${sy}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Texto que entra de golpe con rebote y pequeño temblor. */
export const Slam: React.FC<{
  text: string;
  at: number;
  size?: number;
  color?: string;
  weight?: number;
  glow?: boolean;
  spacing?: number;
}> = ({ text, at, size = 120, color = "white", weight = 900, glow = false, spacing = -2 }) => {
  const frame = useCurrentFrame();
  const d = frame - at;
  const tremble = d >= 0 && d < 10 ? (random(`t${at}${frame}`) - 0.5) * (10 - d) * 1.6 : 0;
  return (
    <div
      style={{
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: spacing,
        color,
        textAlign: "center",
        textShadow: glow ? `0 0 40px ${color}99, 0 6px 30px rgba(0,0,0,0.6)` : "0 6px 30px rgba(0,0,0,0.6)",
        opacity: interpolate(frame, [at, at + 2], [0, 1], CLAMP),
        scale: interpolate(frame, [at, at + 10], [2.4, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" }),
        translate: `${tremble}px ${tremble * 0.6}px`,
      }}
    >
      {text}
    </div>
  );
};
