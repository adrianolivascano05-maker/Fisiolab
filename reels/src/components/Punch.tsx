import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP } from "../config";
import { SPRINGS, breathe, exitStyle, springAt } from "../motion";

/** Entrada de escena con «punch» de escala y temblor opcional alrededor de un frame. */
export const Punch: React.FC<{ children: React.ReactNode; shakeAt?: number[]; amount?: number; dur?: number }> = ({ children, shakeAt = [], amount = 1, dur }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ex = exitStyle(frame, dur ?? durationInFrames);
  const br = breathe(frame, 75);
  let sx = 0;
  let sy = 0;
  for (const a of shakeAt) {
    const d = frame - a;
    if (d >= 0 && d < 10) {
      const k = (1 - d / 10) * 11 * amount;
      sx += (random(`sx${a}${frame}`) - 0.5) * k;
      sy += (random(`sy${a}${frame}`) - 0.5) * k;
    }
  }
  return (
    <AbsoluteFill
      style={{
        scale: String(interpolate(frame, [0, 10], [1.05, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) }) * br.scale),
        translate: `${sx}px ${sy + ex.y + br.y}px`,
        opacity: ex.opacity,
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
  const tremble = d >= 0 && d < 8 ? (random(`t${at}${frame}`) - 0.5) * (8 - d) * 0.8 : 0;
  return (
    <div
      style={{
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: spacing,
        color,
        textAlign: "center",
        whiteSpace: "pre-line",
        textShadow: glow ? "none" : "none",
        opacity: Math.min(1, springAt(frame, at, SPRINGS.smooth) * 1.6),
        scale: String(0.6 + 0.4 * springAt(frame, at, SPRINGS.bouncy)),
        translate: `${tremble}px ${tremble * 0.6 + 40 * (1 - springAt(frame, at, SPRINGS.smooth))}px`,
      }}
    >
      {text}
    </div>
  );
};
