import { Easing, interpolate, random, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS, STICKER, STICKER_SM } from "../../config";
import { fontFamily } from "../../theme";

const SPECKLE = new Array(90).fill(0).map((_, i) => ({ x: random(`sx${i}`), y: random(`sy${i}`), r: 0.6 + random(`sr${i}`) * 1.6 }));

/** Ecografía estilizada del Aquiles (corte longitudinal). `swell` 0..1: el tendón engrosa y su patrón se vuelve más irregular. */
export const TendonScan: React.FC<{ at: number; width?: number; swell?: number; label?: string; labelColor?: string }> = ({ at, width = 560, swell = 0, label, labelColor = COLORS.cyan }) => {
  const frame = useCurrentFrame();
  const h = width * 0.62;
  const th = 46 + 26 * swell; // grosor del tendón
  const cy = h * 0.55;
  return (
    <div style={{ position: "relative", width, height: h, borderRadius: 26, overflow: "hidden", backgroundColor: "#0D1420", boxShadow: STICKER, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <defs>
          <clipPath id="fan">
            <path d={`M${width * 0.08} 18 L${width * 0.92} 18 L${width * 0.98} ${h - 14} L${width * 0.02} ${h - 14} Z`} />
          </clipPath>
        </defs>
        <g clipPath="url(#fan)">
          <rect width={width} height={h} fill="#1B2433" />
          {/* piel y grasa */}
          <rect x={0} y={18} width={width} height={22} fill="#5A6578" opacity={0.7} />
          {/* tendón: bandas fibrilares paralelas */}
          <g style={{ transformOrigin: `${width / 2}px ${cy}px` }}>
            <rect x={0} y={cy - th / 2} width={width} height={th} fill="#7D899D" opacity={0.55} />
            {new Array(9).fill(0).map((_, i) => {
              const y = cy - th / 2 + 4 + (i * (th - 8)) / 8;
              const wav = swell * 5;
              return <path key={i} d={`M0 ${y} Q ${width * 0.25} ${y - wav} ${width * 0.5} ${y} T ${width} ${y}`} fill="none" stroke="#E8EEF7" strokeWidth={2.2 - swell * 0.8} opacity={0.85 - swell * 0.35} />;
            })}
            {SPECKLE.map((s, i) => (
              <circle key={i} cx={s.x * width} cy={cy - th / 2 + s.y * th} r={s.r * (0.6 + swell)} fill={i % 3 ? "#0D1420" : "#C8D1DF"} opacity={swell * 0.75} />
            ))}
          </g>
          {/* hueso (calcáneo) */}
          <ellipse cx={width * 0.9} cy={h - 10} rx={width * 0.18} ry={30} fill="#D9DEE7" opacity={0.6} />
        </g>
        <text x={18} y={h - 18} fontFamily={fontFamily} fontWeight={700} fontSize={20} fill="#8A96AA">AQUILES · LONGITUDINAL</text>
      </svg>
      {label ? (
        <div style={{ position: "absolute", right: 16, top: 14, padding: "8px 18px", borderRadius: 12, backgroundColor: labelColor, color: COLORS.paper, fontFamily, fontWeight: 900, fontSize: 30 }}>{label}</div>
      ) : null}
    </div>
  );
};

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** Semana (lunes a domingo) con días marcados. */
export const WeekStrip: React.FC<{ at: number; marks: { day: number; at: number; color: string; text?: string }[] }> = ({ at, marks }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 10, opacity: frame >= at ? 1 : 0 }}>
      {DAYS.map((d, i) => {
        const m = marks.find((x) => x.day === i && frame >= x.at);
        return (
          <div key={d} style={{ position: "relative", width: 110, height: 130, borderRadius: 18, backgroundColor: m ? m.color : COLORS.paper, border: `2px solid ${m ? m.color : COLORS.line}`, boxShadow: STICKER_SM, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, scale: String(pop(frame, at + i * 2) * (m ? 1 + 0.06 * pop(frame, m.at) : 1)) }}>
            <div style={{ fontFamily, fontWeight: 900, fontSize: 46, color: m ? COLORS.paper : COLORS.ink }}>{d}</div>
            {m?.text ? <div style={{ fontFamily, fontWeight: 800, fontSize: 20, color: COLORS.paper }}>{m.text}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

/** Balón oval (fútbol australiano). */
export const OvalBall: React.FC<{ at: number; size?: number }> = ({ at, size = 140 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), rotate: `${-20 + Math.sin((frame - at) / 10) * 8}deg` }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <ellipse cx={50} cy={50} rx={42} ry={26} fill={COLORS.red} />
        <path d="M14 50 H86" stroke={COLORS.paper} strokeWidth={3} />
        {[38, 46, 54, 62].map((x) => <path key={x} d={`M${x} 44 V56`} stroke={COLORS.paper} strokeWidth={3} strokeLinecap="round" />)}
      </svg>
    </div>
  );
};

/** Silueta de caballo. */
export const Horse: React.FC<{ at: number; size?: number }> = ({ at, size = 170 }) => {
  const frame = useCurrentFrame();
  const g = Math.sin((frame - at) / 4) * 4;
  return (
    <div style={{ width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size} viewBox="0 0 120 100">
        <path d="M22 48 C30 38 56 36 78 40 L92 24 C96 20 104 22 104 28 L100 34 C106 36 108 42 104 44 L96 44 L88 52 C88 62 84 66 76 66 L40 66 C32 66 24 60 22 48 Z" fill={COLORS.ink} />
        <path d={`M40 64 L${34 + g} 92 M50 66 L${54 - g} 92 M70 66 L${66 - g} 92 M80 64 L${86 + g} 92`} stroke={COLORS.ink} strokeWidth={6} strokeLinecap="round" />
        <path d="M22 48 C12 50 8 60 10 70" stroke={COLORS.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/** Curva de respuesta en días (0 → 4) con cursor; el pico está en el día 2. */
export const DayCurve: React.FC<{ at: number; width?: number; t: number; marks: { day: number; at: number }[] }> = ({ at, width = 900, t, marks }) => {
  const frame = useCurrentFrame();
  const h = 300;
  const x = (d: number) => 60 + (d / 4) * (width - 120);
  const y = (d: number) => h - 60 - 170 * Math.exp(-((d - 2) ** 2) / 0.9);
  let path = "";
  for (let d = 0; d <= 4.0001; d += 0.05) path += `${d === 0 ? "M" : "L"}${x(d)} ${y(d)} `;
  const drawn = Math.max(0, Math.min(1, t / 4));
  return (
    <div style={{ width, height: h, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <path d={`M40 ${h - 60} H${width - 30}`} stroke={COLORS.line} strokeWidth={3} />
        <text x={40} y={30} fontFamily={fontFamily} fontWeight={800} fontSize={24} fill={COLORS.muted}>cambio en la imagen</text>
        <path d={path} fill="none" stroke={COLORS.orange} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} />
        {[0, 1, 2, 3, 4].map((d) => {
          const m = marks.find((mm) => mm.day === d);
          const on = m ? frame >= m.at : false;
          return (
            <g key={d}>
              <circle cx={x(d)} cy={h - 60} r={on ? 16 : 8} fill={on ? (d === 2 ? COLORS.orange : d === 4 ? COLORS.green : COLORS.ink) : COLORS.line} />
              <text x={x(d)} y={h - 16} textAnchor="middle" fontFamily={fontFamily} fontWeight={900} fontSize={on ? 38 : 28} fill={on ? COLORS.ink : COLORS.muted}>día {d}</text>
            </g>
          );
        })}
        {t > 0 ? <circle cx={x(Math.min(4, t))} cy={y(Math.min(4, t))} r={14} fill={COLORS.paper} stroke={COLORS.orange} strokeWidth={6} /> : null}
      </svg>
    </div>
  );
};

/** Proteoglicano esquemático (cepillo) que se hincha al atrapar gotas de agua. `fill` 0..1. */
export const PGBrush: React.FC<{ at: number; fill: number; size?: number }> = ({ at, fill, size = 220 }) => {
  const frame = useCurrentFrame();
  const n = 9;
  return (
    <div style={{ position: "relative", width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at) * (1 + 0.18 * fill)) }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={20 + 18 * fill} fill={COLORS.cyan} opacity={0.12 + 0.18 * fill} />
        <path d="M50 12 V88" stroke={COLORS.ink} strokeWidth={4} strokeLinecap="round" />
        {new Array(n).fill(0).map((_, i) => {
          const yy = 18 + i * 8;
          const len = 12 + 8 * fill;
          return (
            <g key={i}>
              <path d={`M50 ${yy} L${50 - len} ${yy - 4}`} stroke={COLORS.orange} strokeWidth={3} strokeLinecap="round" />
              <path d={`M50 ${yy} L${50 + len} ${yy - 4}`} stroke={COLORS.orange} strokeWidth={3} strokeLinecap="round" />
            </g>
          );
        })}
        {new Array(8).fill(0).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + frame / 40;
          const r = 30 + 6 * Math.sin(frame / 9 + i);
          return <path key={i} d={`M${50 + r * Math.cos(a)} ${50 + r * Math.sin(a) - 4} q 3 4 0 7 q -3 -3 0 -7 Z`} fill={COLORS.cyan} opacity={fill > i / 8 ? 1 : 0} />;
        })}
      </svg>
    </div>
  );
};

/** Barra de «velocidad de renovación». */
export const RenewBar: React.FC<{ at: number; label: string; value: number; text: string; color: string; width?: number }> = ({ at, label, value, text, color, width = 860 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at + 4, at + 24], [0, value], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 10, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily }}>
        <span style={{ fontWeight: 900, fontSize: 48, color: COLORS.ink }}>{label}</span>
        <span style={{ fontWeight: 900, fontSize: 44, color }}>{text}</span>
      </div>
      <div style={{ height: 46, borderRadius: 23, backgroundColor: "rgba(11,18,32,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", borderRadius: 23, backgroundColor: color }} />
      </div>
    </div>
  );
};
