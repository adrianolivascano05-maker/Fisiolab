import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../config";

const BLOBS = [
  { color: "#FFD6C9", x: -200, y: 200, r: 620, sx: 70, sy: 40, ph: 0 },
  { color: "#CFF3EE", x: 760, y: 900, r: 560, sx: 50, sy: 70, ph: 2 },
  { color: "#FFF0BF", x: 300, y: 1500, r: 520, sx: 60, sy: 50, ph: 4 },
  { color: "#DCE8FF", x: 900, y: 150, r: 380, sx: 40, sy: 60, ph: 1 },
];

const DOTS = new Array(26).fill(0).map((_, i) => ({
  x: random(`dx${i}`) * WIDTH,
  y: random(`dy${i}`) * HEIGHT,
  r: 5 + random(`dr${i}`) * 9,
  v: 0.15 + random(`dv${i}`) * 0.4,
  c: [COLORS.orange, COLORS.green, COLORS.amber, COLORS.cyan][i % 4],
  ph: random(`dp${i}`) * Math.PI * 2,
}));

/** «Clínica clara»: crema con formas orgánicas pastel que respiran y confeti de colores. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`, overflow: "hidden" }}>
      {BLOBS.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x + Math.sin(frame / 140 + b.ph) * b.sx,
            top: b.y + Math.cos(frame / 160 + b.ph) * b.sy,
            width: b.r,
            height: b.r * (0.85 + 0.1 * Math.sin(frame / 90 + b.ph)),
            borderRadius: "46% 54% 52% 48% / 55% 45% 55% 45%",
            backgroundColor: b.color,
            opacity: 0.8,
            rotate: `${Math.sin(frame / 200 + b.ph) * 12}deg`,
            filter: "blur(2px)",
          }}
        />
      ))}
      {DOTS.map((d, i) => {
        const y = (((d.y - frame * d.v) % HEIGHT) + HEIGHT) % HEIGHT;
        return <div key={i} style={{ position: "absolute", left: d.x + Math.sin(frame / 40 + d.ph) * 6, top: y, width: d.r, height: d.r, borderRadius: "50%", backgroundColor: d.c, opacity: 0.55 }} />;
      })}
      {/* Grano de papel muy sutil */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, opacity: 0.08 }}>
        <defs>
          <pattern id="grain" width={6} height={6} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.6} fill={COLORS.ink} />
            <circle cx={4} cy={4} r={0.5} fill={COLORS.ink} />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
