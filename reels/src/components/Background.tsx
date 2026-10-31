import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../config";

const PARTICLES = new Array(70).fill(0).map((_, i) => ({
  x: random(`px${i}`) * WIDTH,
  y: random(`py${i}`) * HEIGHT,
  r: 1.2 + random(`pr${i}`) * 2.4,
  v: 0.25 + random(`pv${i}`) * 0.9,
  ph: random(`pp${i}`) * Math.PI * 2,
}));

/** Sala de rayos X: azul marino, rejilla cian que se desplaza, partículas y viñeta. */
export const Background: React.FC<{ flash?: number }> = ({ flash = 0 }) => {
  const frame = useCurrentFrame();
  const grid = 120;
  const dx = (frame * 0.35) % grid;
  const dy = (frame * 0.55) % grid;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`, overflow: "hidden" }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, opacity: 0.28 }}>
        <defs>
          <pattern id="grid" width={grid} height={grid} patternUnits="userSpaceOnUse" x={dx} y={dy}>
            <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke={COLORS.cyan} strokeWidth={1} />
          </pattern>
          <radialGradient id="gridFade" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity={1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </radialGradient>
          <mask id="gridMask">
            <rect width={WIDTH} height={HEIGHT} fill="url(#gridFade)" />
          </mask>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" mask="url(#gridMask)" />
      </svg>
      {PARTICLES.map((p, i) => {
        const y = (((p.y - frame * p.v) % HEIGHT) + HEIGHT) % HEIGHT;
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(frame / 11 + p.ph));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: y,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: "50%",
              backgroundColor: COLORS.cyan,
              opacity: tw * 0.7,
              boxShadow: `0 0 ${p.r * 4}px ${COLORS.cyan}`,
            }}
          />
        );
      })}
      {/* Viñeta */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      {/* Fogonazo de rayos X */}
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
