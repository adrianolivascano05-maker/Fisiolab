import { Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS, STICKER } from "../../config";
import { fontFamily } from "../../theme";

const rad = (d: number) => (d * Math.PI) / 180;

/** Pierna en decúbito supino (vista lateral) sobre la camilla. `flex` = grados de flexión de rodilla (cadera y talón apoyados);
 *  `roll` dibuja un rulo bajo la rodilla; `press` 0..1 empuja hacia la camilla; `quad` 0..1 «enciende» el cuádriceps;
 *  `brake` 0..1 muestra el freno (cuádriceps tachado en rojo). */
export const KneeLeg: React.FC<{ at: number; width?: number; flex?: number; roll?: boolean; press?: number; quad?: number; brake?: number; label?: string; labelColor?: string }> = ({
  at,
  width = 640,
  flex = 0,
  roll = false,
  press = 0,
  quad = 0.3,
  brake = 0,
  label,
  labelColor = COLORS.ink,
}) => {
  const frame = useCurrentFrame();
  const W = 640;
  const H = 330;
  const L = 230; // muslo = pierna
  const tableY = 270;
  const hip = { x: 110, y: tableY - 40 };
  const half = rad(flex / 2);
  const knee = { x: hip.x + L * Math.cos(half), y: hip.y - L * Math.sin(half) + press * 6 };
  const ankle = { x: knee.x + L * Math.cos(half), y: hip.y };
  const thighAng = Math.atan2(knee.y - hip.y, knee.x - hip.x);
  // cuádriceps: banda sobre la cara anterior del muslo
  const nx = Math.sin(thighAng);
  const ny = -Math.cos(thighAng);
  const q1 = { x: hip.x + 40 * Math.cos(thighAng) + nx * 22, y: hip.y + 40 * Math.sin(thighAng) + ny * 22 };
  const q2 = { x: knee.x - 30 * Math.cos(thighAng) + nx * 22, y: knee.y - 30 * Math.sin(thighAng) + ny * 22 };
  const qc = { x: (q1.x + q2.x) / 2 + nx * 18, y: (q1.y + q2.y) / 2 + ny * 18 };
  const quadCol = brake > 0.5 ? COLORS.red : COLORS.cyan;
  return (
    <div style={{ position: "relative", width, height: (width * H) / W, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), fontFamily }}>
      <svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
        {/* camilla */}
        <rect x={10} y={tableY} width={W - 20} height={26} rx={10} fill="#D8E2EE" />
        <rect x={40} y={tableY + 26} width={14} height={30} fill="#C3CFDD" />
        <rect x={W - 54} y={tableY + 26} width={14} height={30} fill="#C3CFDD" />
        {/* tronco */}
        <rect x={-20} y={hip.y - 34} width={140} height={68} rx={30} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={6} />
        {/* rulo */}
        {roll ? <circle cx={knee.x} cy={(knee.y + tableY) / 2 + 12} r={Math.max(16, (tableY - knee.y) / 2 - 6)} fill={COLORS.amber} stroke={COLORS.ink} strokeWidth={5} /> : null}
        {/* muslo y pierna */}
        <path d={`M${hip.x} ${hip.y} L${knee.x} ${knee.y} L${ankle.x} ${ankle.y}`} fill="none" stroke={COLORS.ink} strokeWidth={50} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M${hip.x} ${hip.y} L${knee.x} ${knee.y} L${ankle.x} ${ankle.y}`} fill="none" stroke={COLORS.paper} strokeWidth={38} strokeLinecap="round" strokeLinejoin="round" />
        {/* pie */}
        <path d={`M${ankle.x} ${ankle.y} L${ankle.x + 12} ${ankle.y - 62}`} stroke={COLORS.ink} strokeWidth={34} strokeLinecap="round" />
        <path d={`M${ankle.x} ${ankle.y} L${ankle.x + 12} ${ankle.y - 62}`} stroke={COLORS.paper} strokeWidth={22} strokeLinecap="round" />
        {/* cuádriceps */}
        <path d={`M${q1.x} ${q1.y} Q${qc.x} ${qc.y} ${q2.x} ${q2.y}`} fill="none" stroke={quadCol} strokeWidth={22} strokeLinecap="round" opacity={0.25 + 0.75 * quad} />
        {brake > 0 ? (
          <g opacity={brake}>
            <path d={`M${qc.x - 40} ${qc.y - 40} L${qc.x + 40} ${qc.y + 40} M${qc.x + 40} ${qc.y - 40} L${qc.x - 40} ${qc.y + 40}`} stroke={COLORS.red} strokeWidth={12} strokeLinecap="round" />
          </g>
        ) : null}
        {/* rodilla */}
        <circle cx={knee.x} cy={knee.y} r={14} fill={COLORS.orange} />
        {/* flecha de empuje */}
        {press > 0 ? <path d={`M${knee.x} ${knee.y - 110} V${knee.y - 46} M${knee.x - 18} ${knee.y - 66} L${knee.x} ${knee.y - 44} L${knee.x + 18} ${knee.y - 66}`} fill="none" stroke={COLORS.orange} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={press} /> : null}
      </svg>
      {label ? (
        <div style={{ position: "absolute", right: 10, top: 6, padding: "8px 18px", borderRadius: 12, backgroundColor: labelColor, color: COLORS.paper, fontWeight: 900, fontSize: 34 }}>{label}</div>
      ) : null}
    </div>
  );
};

/** Curva en U (presión, y luego freno) frente al ángulo de flexión. Esquema cualitativo: sin valores en el eje Y. */
export const UCurve: React.FC<{ at: number; draw: number; brake?: number; band?: number; maxAt?: number; minAt?: number; width?: number }> = ({ at, draw, brake = 0, band = 0, maxAt, minAt, width = 900 }) => {
  const frame = useCurrentFrame();
  const W = 900;
  const H = 520;
  const x0 = 90;
  const x1 = 860;
  const yTop = 70;
  const yBot = 420;
  const deg = (d: number) => x0 + ((x1 - x0) * d) / 130;
  const u = (d: number, lift = 0) => {
    const t = (d - 40) / 90;
    const v = d < 40 ? ((40 - d) / 40) ** 1.6 : Math.abs(t) ** 1.8;
    return yBot - 40 - lift - (yBot - yTop - 80) * v;
  };
  const path = (lift: number) => {
    const pts: string[] = [];
    for (let d = 0; d <= 130; d += 2) pts.push(`${deg(d).toFixed(1)} ${u(d, lift).toFixed(1)}`);
    return `M${pts.join(" L")}`;
  };
  const maxOn = maxAt !== undefined && frame >= maxAt;
  const minOn = minAt !== undefined && frame >= minAt;
  return (
    <div style={{ position: "relative", width, height: (width * H) / W, opacity: frame >= at ? 1 : 0, fontFamily }}>
      <svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
        {/* banda 30-50° */}
        <rect x={deg(30)} y={yTop - 20} width={deg(50) - deg(30)} height={yBot - yTop + 20} rx={14} fill={COLORS.green} opacity={0.16 * band} />
        {/* ejes */}
        <path d={`M${x0} ${yTop - 30} V${yBot} H${x1 + 10}`} fill="none" stroke={COLORS.ink} strokeWidth={5} strokeLinecap="round" />
        {[0, 30, 50, 90, 130].map((d) => (
          <g key={d}>
            <path d={`M${deg(d)} ${yBot} v14`} stroke={COLORS.ink} strokeWidth={4} />
            <text x={deg(d)} y={yBot + 48} textAnchor="middle" fontFamily={fontFamily} fontWeight={800} fontSize={30} fill={d === 30 || d === 50 ? COLORS.green : COLORS.muted}>{`${d}°`}</text>
          </g>
        ))}
        <text x={x1} y={yBot + 92} textAnchor="end" fontFamily={fontFamily} fontWeight={700} fontSize={26} fill={COLORS.muted}>flexión de rodilla →</text>
        {/* presión */}
        <path d={path(0)} fill="none" stroke={COLORS.orange} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        {/* freno */}
        <path d={path(-18)} fill="none" stroke={COLORS.red} strokeWidth={8} strokeDasharray="18 14" strokeLinecap="round" opacity={brake} />
        {maxOn ? (
          <>
            <circle cx={deg(0)} cy={u(0)} r={16} fill={COLORS.orange} />
            <circle cx={deg(130)} cy={u(130)} r={16} fill={COLORS.orange} />
          </>
        ) : null}
        {minOn ? <circle cx={deg(40)} cy={u(40)} r={16} fill={COLORS.green} /> : null}
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, fontWeight: 800, fontSize: 28, color: COLORS.orange }}>presión</div>
      {brake > 0 ? <div style={{ position: "absolute", left: 130, top: 0, fontWeight: 800, fontSize: 28, color: COLORS.red, opacity: brake }}>- - freno</div> : null}
      {maxOn ? (
        <>
          <div style={{ position: "absolute", left: (width * (deg(0) + 20)) / W, top: (width * (u(0) - 30)) / W, fontWeight: 900, fontSize: 36, color: COLORS.orange, scale: String(pop(frame, maxAt!)) }}>MÁXIMA</div>
          <div style={{ position: "absolute", right: (width * (W - deg(130) + 24)) / W, top: (width * (u(130) - 30)) / W, fontWeight: 900, fontSize: 36, color: COLORS.orange, scale: String(pop(frame, maxAt!)) }}>MÁXIMA</div>
        </>
      ) : null}
      {minOn ? <div style={{ position: "absolute", left: (width * deg(40)) / W - 90, top: (width * (u(40) - 78)) / W, width: 180, textAlign: "center", fontWeight: 900, fontSize: 36, color: COLORS.green, scale: String(pop(frame, minAt!)) }}>MÍNIMA</div> : null}
      <div style={{ position: "absolute", right: 0, top: 0, fontWeight: 700, fontSize: 22, color: COLORS.muted }}>esquema</div>
    </div>
  );
};

/** Goniómetro: semicírculo 0-130° con la zona 30-50° en verde y una aguja. */
export const Goniometer: React.FC<{ at: number; angle: number; zone?: number; size?: number }> = ({ at, angle, zone = 1, size = 440 }) => {
  const frame = useCurrentFrame();
  const R = 180;
  const cx = 260;
  const cy = 220;
  // 0° a la izquierda, crece en sentido horario hacia arriba
  const pt = (d: number, r = R) => ({ x: cx - r * Math.cos(rad(d)), y: cy - r * Math.sin(rad(d)) });
  const arc = (a: number, b: number, r: number) => {
    const p = pt(a, r);
    const q = pt(b, r);
    return `M${p.x} ${p.y} A${r} ${r} 0 0 1 ${q.x} ${q.y}`;
  };
  const n = pt(angle, R - 20);
  return (
    <div style={{ width: size, height: (size * 260) / 520, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={(size * 260) / 520} viewBox="0 0 520 260">
        <path d={arc(0, 130, R)} fill="none" stroke={COLORS.line} strokeWidth={34} />
        <path d={arc(30, 50, R)} fill="none" stroke={COLORS.green} strokeWidth={34} opacity={zone} />
        <path d={arc(0, 12, R)} fill="none" stroke={COLORS.red} strokeWidth={34} opacity={zone * 0.8} />
        {[0, 30, 50, 90].map((d) => {
          const p = pt(d, R + 34);
          return (
            <text key={d} x={p.x} y={p.y + 10} textAnchor="middle" fontFamily={fontFamily} fontWeight={800} fontSize={30} fill={d === 30 || d === 50 ? COLORS.green : COLORS.muted}>{`${d}°`}</text>
          );
        })}
        <path d={`M${cx} ${cy} L${n.x} ${n.y}`} stroke={COLORS.ink} strokeWidth={10} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={16} fill={COLORS.ink} />
      </svg>
    </div>
  );
};

/** Barra de «freno» (inhibición) relativa, con etiqueta. */
export const BrakeBar: React.FC<{ at: number; value: number; label: string; color: string; width?: number }> = ({ at, value, label, color, width = 360 }) => {
  const frame = useCurrentFrame();
  const g = interpolate(frame, [at, at + 18], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: frame >= at ? 1 : 0, fontFamily }}>
      <div style={{ width, height: 220, borderRadius: 20, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 14 }}>
        <div style={{ width: width * 0.45, height: `${value * g * 100}%`, borderRadius: 14, backgroundColor: color }} />
      </div>
      <div style={{ fontWeight: 900, fontSize: 36, color }}>{label}</div>
    </div>
  );
};
