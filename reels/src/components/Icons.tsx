import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS } from "../config";

const draw = (frame: number, start: number, len = 10) =>
  interpolate(frame, [start, start + len], [1, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });

/** Marca de verificación dibujada en SVG (sin emojis). */
export const Check: React.FC<{ size?: number; start: number; color?: string }> = ({ size = 80, start, color = COLORS.green }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 ${size / 6}px ${color})` }}>
      <path
        d="M18 54 L42 76 L84 26"
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={draw(frame, start)}
      />
    </svg>
  );
};

/** Aspa dibujada en SVG. */
export const Cross: React.FC<{ size?: number; start: number; color?: string }> = ({ size = 80, start, color = COLORS.red }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 ${size / 6}px ${color})` }}>
      <path d="M24 24 L76 76" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(frame, start, 6)} />
      <path d="M76 24 L24 76" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(frame, start + 4, 6)} />
    </svg>
  );
};

/** Flecha hacia la derecha. */
export const Arrow: React.FC<{ size?: number; color?: string }> = ({ size = 60, color = COLORS.ink }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 100 70">
    <path d="M8 35 H86 M60 10 L88 35 L60 60" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
