import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS } from "../config";
import { fontFamily } from "../theme";

export const LEVELS = ["L1", "L2", "L3", "L4", "L5"];
const VH = 118; // alto de cada vértebra + disco
export const SPINE_W = 420;
export const SPINE_H = VH * 5 + 150;

/** Posición (x,y) de la punta de la espinosa de cada nivel dentro del SVG. */
export const spinousTip = (level: number) => ({ x: 318, y: 36 + level * VH + 44 });

/** Columna lumbar esquemática en vista lateral: cuerpos a la izquierda, espinosas a la derecha, sacro abajo. */
export const Spine: React.FC<{
  start: number;
  xray?: number; // 0..1 progreso del barrido de rayos X
  markers?: { level: number; at: number }[]; // marcadores que caen sobre las espinosas
}> = ({ start, xray = 0, markers = [] }) => {
  const frame = useCurrentFrame();
  const sweepY = interpolate(xray, [0, 1], [-60, SPINE_H + 60]);
  const bone = xray > 0 ? COLORS.cyan : "rgba(255,255,255,0.92)";
  return (
    <svg width={SPINE_W} height={SPINE_H} viewBox={`0 0 ${SPINE_W} ${SPINE_H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="xrayBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0} />
          <stop offset="50%" stopColor={COLORS.cyan} stopOpacity={0.75} />
          <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
        </linearGradient>
      </defs>
      {LEVELS.map((lv, i) => {
        const y = 36 + i * VH;
        const s = interpolate(frame, [start + i * 4, start + i * 4 + 10], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        const lit = xray > 0 && sweepY > y + 30 ? 1 : 0;
        return (
          <g key={lv} style={{ transformOrigin: `150px ${y + 45}px`, scale: String(s) }}>
            {/* Cuerpo vertebral */}
            <rect x={40} y={y} width={190} height={92} rx={22} fill={lit ? "rgba(79,209,255,0.18)" : "rgba(255,255,255,0.08)"} stroke={lit ? COLORS.cyan : bone} strokeWidth={5} />
            {/* Pedículo + espinosa */}
            <path d={`M230 ${y + 30} L270 ${y + 22} L318 ${y + 36} L318 ${y + 52} L270 ${y + 66} L230 ${y + 60} Z`} fill={lit ? "rgba(79,209,255,0.18)" : "rgba(255,255,255,0.08)"} stroke={lit ? COLORS.cyan : bone} strokeWidth={5} strokeLinejoin="round" />
            {/* Disco */}
            {i < 4 ? <rect x={52} y={y + 96} width={166} height={18} rx={9} fill={lit ? "rgba(79,209,255,0.35)" : "rgba(255,255,255,0.22)"} /> : null}
            <text x={135} y={y + 60} textAnchor="middle" fontFamily={fontFamily} fontWeight={800} fontSize={40} fill={lit ? COLORS.cyan : "white"}>
              {lv}
            </text>
          </g>
        );
      })}
      {/* Sacro */}
      {(() => {
        const y = 36 + 5 * VH;
        const s = interpolate(frame, [start + 20, start + 30], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        const lit = xray > 0 && sweepY > y + 50 ? 1 : 0;
        return (
          <g style={{ transformOrigin: `150px ${y + 60}px`, scale: String(s) }}>
            <path d={`M48 ${y} L236 ${y} L300 ${y + 40} L250 ${y + 130} L120 ${y + 130} L60 ${y + 70} Z`} fill={lit ? "rgba(79,209,255,0.18)" : "rgba(255,255,255,0.08)"} stroke={lit ? COLORS.cyan : bone} strokeWidth={5} strokeLinejoin="round" />
            <text x={160} y={y + 78} textAnchor="middle" fontFamily={fontFamily} fontWeight={800} fontSize={34} fill={lit ? COLORS.cyan : "white"}>
              SACRO
            </text>
          </g>
        );
      })()}
      {/* Marcadores que caen sobre las espinosas */}
      {markers.map((m) => {
        const tip = spinousTip(m.level);
        const p = interpolate(frame, [m.at, m.at + 9], [0, 1], { ...CLAMP, easing: Easing.bezier(0.5, 0, 1, 1) });
        const squash = interpolate(frame, [m.at + 9, m.at + 12, m.at + 18], [1, 1.35, 1], CLAMP);
        const y = tip.y - 380 * (1 - p);
        return (
          <g key={m.level} style={{ opacity: frame >= m.at ? 1 : 0 }}>
            <circle cx={tip.x + 26} cy={y} r={22} fill={COLORS.orange} style={{ transformOrigin: `${tip.x + 26}px ${y}px`, scale: `${squash} ${2 - squash}` }} />
            <circle cx={tip.x + 26} cy={y} r={30} fill="none" stroke={COLORS.orange} strokeWidth={3} opacity={interpolate(frame, [m.at + 9, m.at + 24], [0.9, 0], CLAMP)} style={{ transformOrigin: `${tip.x + 26}px ${y}px`, scale: String(interpolate(frame, [m.at + 9, m.at + 24], [1, 2.2], CLAMP)) }} />
          </g>
        );
      })}
      {/* Barrido de rayos X */}
      {xray > 0 && xray < 1 ? <rect x={-60} y={sweepY - 70} width={SPINE_W + 120} height={140} fill="url(#xrayBand)" /> : null}
    </svg>
  );
};
