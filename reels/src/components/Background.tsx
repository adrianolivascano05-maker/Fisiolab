import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../config";

/** Un latido de ECG (P, QRS, T) en 300 px de ancho. */
const BEAT = "l40 0 l10 -14 l10 14 l30 0 l8 -70 l10 118 l8 -48 l36 0 l14 -22 l14 22 l120 0";

/** «Clínico»: blanco-gris frío, papel milimetrado fino, una línea de ECG discreta y aros finos. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const ecgX = -((frame * 2.2) % 300);
  let d = `M${ecgX - 300} 1620 `;
  for (let i = 0; i < 7; i++) d += BEAT + " ";
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`, overflow: "hidden" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="mm" width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M40 0 H0 V40" fill="none" stroke={COLORS.ink} strokeWidth={0.8} opacity={0.07} />
          </pattern>
          <pattern id="cm" width={200} height={200} patternUnits="userSpaceOnUse">
            <path d="M200 0 H0 V200" fill="none" stroke={COLORS.ink} strokeWidth={1.2} opacity={0.1} />
          </pattern>
          <linearGradient id="fadeEcg" x1="0" x2="1">
            <stop offset="0" stopColor={COLORS.cyan} stopOpacity={0} />
            <stop offset="0.2" stopColor={COLORS.cyan} stopOpacity={1} />
            <stop offset="0.8" stopColor={COLORS.cyan} stopOpacity={1} />
            <stop offset="1" stopColor={COLORS.cyan} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#mm)" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#cm)" />
        {/* Aros finos que giran muy despacio */}
        <g style={{ transformOrigin: "880px 300px", rotate: `${frame * 0.15}deg` }}>
          <circle cx={880} cy={300} r={260} fill="none" stroke={COLORS.orange} strokeWidth={1.5} opacity={0.12} strokeDasharray="40 24" />
        </g>
        <circle cx={880} cy={300} r={200} fill="none" stroke={COLORS.ink} strokeWidth={1} opacity={0.08} />
        <g style={{ transformOrigin: "160px 1500px", rotate: `${-frame * 0.1}deg` }}>
          <circle cx={160} cy={1500} r={220} fill="none" stroke={COLORS.cyan} strokeWidth={1.5} opacity={0.12} strokeDasharray="6 18" />
        </g>
        {/* Línea de ECG que avanza */}
        <path d={d} fill="none" stroke="url(#fadeEcg)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" opacity={0.35} />
        <line x1={0} y1={1620} x2={WIDTH} y2={1620} stroke={COLORS.cyan} strokeWidth={1} opacity={0.12} />
      </svg>
    </AbsoluteFill>
  );
};
