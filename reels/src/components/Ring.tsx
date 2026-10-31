import { COLORS } from "../config";

/** Anillo de progreso (0..1). */
export const Ring: React.FC<{ size: number; progress: number; color?: string; width?: number }> = ({ size, progress, color = COLORS.orange, width = 26 }) => {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0, rotate: "-90deg", filter: `drop-shadow(0 0 24px ${color}88)` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={width} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))} />
    </svg>
  );
};
