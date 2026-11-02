import { Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS, STICKER_SM } from "../../config";
import { fontFamily } from "../../theme";

/** Zigzag de dolor (rayo) entre dos puntos. */
const zig = (x0: number, y0: number, x1: number, y1: number, n = 6, amp = 5) => {
  let d = `M${x0} ${y0}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + (i % 2 ? amp : -amp);
    d += ` L${x} ${i === n ? y1 : y}`;
  }
  return d;
};

/** Persona de pie con dolor que baja por la pierna (rayo rojo). */
export const PainLeg: React.FC<{ at: number; size?: number; painAt?: number }> = ({ at, size = 260, painAt }) => {
  const frame = useCurrentFrame();
  const p = painAt === undefined ? 0 : interpolate(frame, [painAt, painAt + 12], [0, 1], CLAMP);
  return (
    <div style={{ width: size * 0.6, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size * 0.6} height={size} viewBox="0 0 60 100">
        <circle cx={30} cy={10} r={7} fill={COLORS.ink} />
        <path d="M30 18 L30 50" stroke={COLORS.ink} strokeWidth={7} strokeLinecap="round" />
        <path d="M30 24 L16 40 M30 24 L44 40" stroke={COLORS.ink} strokeWidth={5} strokeLinecap="round" />
        <path d="M30 50 L22 94 M30 50 L38 94" stroke={COLORS.ink} strokeWidth={6} strokeLinecap="round" />
        <path d={zig(24, 52, 20, 92, 7, 3)} fill="none" stroke={COLORS.red} strokeWidth={3} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
    </div>
  );
};

/** Paciente tumbado (vista lateral) con elevación de pierna recta.
 *  mode="slr": se eleva la pierna afectada y el dolor va por esa pierna.
 *  mode="cruzado": se eleva la sana y el dolor aparece en la otra (la afectada, en la camilla).
 *  painAt indefinido = test negativo (sin dolor). */
export const LegRaise: React.FC<{ at: number; size?: number; mode?: "slr" | "cruzado"; painAt?: number; label?: boolean }> = ({ at, size = 360, mode = "slr", painAt, label = true }) => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [at + 4, at + 20], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const p = painAt === undefined ? 0 : interpolate(frame, [painAt, painAt + 10], [0, 1], CLAMP);
  const raisedColor = mode === "slr" ? COLORS.orange : COLORS.ink;
  const lyingColor = mode === "slr" ? "rgba(11,18,32,0.35)" : COLORS.orange;
  return (
    <div style={{ position: "relative", width: size, height: size * 0.62, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size * 0.62} viewBox="0 0 200 124">
        <rect x={4} y={100} width={192} height={8} rx={4} fill={COLORS.line} />
        <circle cx={22} cy={82} r={11} fill={COLORS.ink} />
        <path d="M34 88 L100 88" stroke={COLORS.ink} strokeWidth={12} strokeLinecap="round" />
        {/* pierna en la camilla */}
        <path d="M100 88 L192 90" stroke={lyingColor} strokeWidth={9} strokeLinecap="round" />
        {mode === "cruzado" ? <path d={zig(112, 97, 176, 98, 6, 3)} fill="none" stroke={COLORS.red} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} /> : null}
        {/* pierna elevada */}
        <g style={{ transformOrigin: "100px 88px", rotate: `${-55 * lift}deg` }}>
          <path d="M100 88 L190 88" stroke={raisedColor} strokeWidth={9} strokeLinecap="round" />
          <path d="M190 88 L190 74" stroke={raisedColor} strokeWidth={7} strokeLinecap="round" />
          {mode === "slr" ? <path d={zig(112, 96, 176, 96, 6, 3)} fill="none" stroke={COLORS.red} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} /> : null}
        </g>
      </svg>
      {label ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -44, textAlign: "center", fontFamily, fontWeight: 800, fontSize: 28, color: COLORS.muted }}>
          {mode === "slr" ? "se eleva la pierna que duele" : "se eleva la pierna sana"}
        </div>
      ) : null}
    </div>
  );
};

/** Regla: [cualidad] + [resultado] → veredicto grande debajo. */
export const RuleCard: React.FC<{ at: number; quality: string; result: string; verdict: string; color: string; stepAt?: [number, number, number] }> = ({ at, quality, result, verdict, color, stepAt }) => {
  const frame = useCurrentFrame();
  const [a, b, c] = stepAt ?? [at, at + 6, at + 12];
  const chip = (text: string, t: number) => (
    <div style={{ padding: "16px 26px", borderRadius: 18, fontFamily, fontWeight: 900, fontSize: 50, color: COLORS.ink, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= t ? 1 : 0, scale: String(pop(frame, t)), whiteSpace: "nowrap" }}>{text}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, opacity: frame >= at ? 1 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {chip(quality, a)}
        <div style={{ fontFamily, fontWeight: 900, fontSize: 60, color: COLORS.muted, opacity: frame >= b ? 1 : 0 }}>+</div>
        {chip(result, b)}
      </div>
      <div style={{ padding: "16px 60px", borderRadius: 24, fontFamily, fontWeight: 900, fontSize: 84, color: COLORS.paper, backgroundColor: color, boxShadow: STICKER_SM, opacity: frame >= c ? 1 : 0, scale: String(pop(frame, c)), letterSpacing: -1 }}>= {verdict}</div>
    </div>
  );
};

/** Grupo de personas con + / − (verde, rojo o gris) que aparecen escalonadas. */
export const Crowd: React.FC<{ n: number; positives: number[]; at: number; markAt: number; plusColor: string; label: string; size?: number }> = ({ n, positives, at, markAt, plusColor, label, size = 70 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: frame >= at ? 1 : 0 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {new Array(n).fill(0).map((_, i) => {
          const pos = positives.includes(i);
          const marked = frame >= markAt + i * 2;
          return (
            <div key={i} style={{ position: "relative", width: size, height: size * 1.1, scale: String(pop(frame, at + i * 2)) }}>
              <svg width={size} height={size * 1.1} viewBox="0 0 60 66">
                <circle cx={30} cy={14} r={10} fill={marked && pos ? plusColor : "rgba(11,18,32,0.55)"} />
                <path d="M10 64 C10 40 20 30 30 30 C40 30 50 40 50 64 Z" fill={marked && pos ? plusColor : "rgba(11,18,32,0.55)"} />
              </svg>
              {marked ? (
                <div style={{ position: "absolute", right: -6, top: -8, width: 30, height: 30, borderRadius: "50%", backgroundColor: pos ? plusColor : COLORS.paper, border: `2px solid ${pos ? plusColor : COLORS.line}`, color: pos ? COLORS.paper : COLORS.muted, fontFamily, fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{pos ? "+" : "−"}</div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 36, color: COLORS.muted }}>{label}</div>
    </div>
  );
};

/** Persona estirando (para el teaser de la parte 4). */
export const Stretch: React.FC<{ at: number; size?: number }> = ({ at, size = 180 }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin((frame - at) / 8) * 6;
  return (
    <div style={{ width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x={6} y={90} width={88} height={6} rx={3} fill={COLORS.line} />
        <path d="M30 88 L80 88" stroke={COLORS.ink} strokeWidth={7} strokeLinecap="round" />
        <g style={{ transformOrigin: "30px 86px", rotate: `${-60 + sway}deg` }}>
          <path d="M30 86 L30 46" stroke={COLORS.ink} strokeWidth={8} strokeLinecap="round" />
          <circle cx={30} cy={36} r={8} fill={COLORS.ink} />
          <path d="M30 54 L62 60" stroke={COLORS.ink} strokeWidth={5} strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};
