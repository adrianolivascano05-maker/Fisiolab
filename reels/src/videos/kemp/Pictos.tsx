import { Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS } from "../../config";
import { fontFamily } from "../../theme";

/** Figura de perfil que hace el test de Kemp: extensión + rotación lumbar. `pose` 0..1 va de pie recto a extendido. */
export const KempFigure: React.FC<{ at: number; size?: number; pose?: number; pain?: number; color?: string }> = ({ at, size = 320, pose = 1, pain = 0, color = COLORS.white }) => {
  const frame = useCurrentFrame();
  const p = pose * interpolate(frame, [at + 6, at + 22], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const bend = -28 * p; // grados de extensión del tronco
  return (
    <div style={{ width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* dolor facetario */}
        {pain > 0 ? <circle cx={44} cy={58} r={14} fill={COLORS.red} opacity={pain * (0.5 + 0.3 * Math.sin(frame / 3))} style={{ filter: "blur(4px)" }} /> : null}
        {/* piernas */}
        <path d="M44 62 L40 96 M48 62 L58 96" stroke={color} strokeWidth={8} strokeLinecap="round" fill="none" />
        {/* tronco + cabeza, giran desde la pelvis */}
        <g style={{ transformOrigin: "46px 62px", rotate: `${bend}deg` }}>
          <path d="M46 62 L46 30" stroke={color} strokeWidth={10} strokeLinecap="round" />
          <circle cx={46} cy={20} r={9} fill={color} />
          {/* brazos hacia atrás (rotación) */}
          <path d="M46 36 L30 48 M46 36 L60 46" stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
        </g>
        {/* flecha de extensión-rotación */}
        <path d="M70 26 A26 26 0 0 1 80 58" fill="none" stroke={COLORS.orange} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        <path d="M74 56 L81 60 L84 52" fill="none" stroke={COLORS.orange} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={p > 0.95 ? 1 : 0} />
      </svg>
    </div>
  );
};

/** Ficha clínica con un texto que puede escribirse y tacharse. */
export const Clipboard: React.FC<{ at: number; width?: number; lines: { text: string; at: number; color?: string; strikeAt?: number }[] }> = ({ at, width = 560, lines }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width, borderRadius: 24, border: "4px solid rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.08)", padding: "26px 30px 24px", position: "relative", opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), fontFamily }}>
      <div style={{ position: "absolute", left: "50%", top: -22, translate: "-50% 0", width: 140, height: 34, borderRadius: 10, backgroundColor: COLORS.cyan }} />
      <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 4, color: COLORS.muted, marginBottom: 10 }}>EXPLORACIÓN</div>
      {lines.map((l, i) => {
        const struck = l.strikeAt !== undefined && frame >= l.strikeAt;
        return (
          <div key={i} style={{ position: "relative", fontWeight: 900, fontSize: 54, lineHeight: 1.15, color: struck ? COLORS.red : (l.color ?? COLORS.white), opacity: frame >= l.at ? 1 : 0, scale: String(interpolate(frame, [l.at, l.at + 8], [1.5, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })), transformOrigin: "left center", display: "inline-block" }}>
            {l.text}
            {l.strikeAt !== undefined ? <div style={{ position: "absolute", left: "-3%", width: "106%", height: 10, top: "50%", marginTop: -5, borderRadius: 5, backgroundColor: COLORS.red, transformOrigin: "left center", scale: `${interpolate(frame, [l.strikeAt, l.strikeAt + 7], [0, 1], CLAMP)} 1` }} /> : null}
          </div>
        );
      })}
    </div>
  );
};

/** Barra de rango 0..1 con mínimo, máximo y una aguja que no se decide. */
export const RangeBar: React.FC<{ label: string; at: number; min: number; max: number; minAt: number; maxAt: number; color: string; width?: number; fmt: (v: number) => string }> = ({ label, at, min, max, minAt, maxAt, color, width = 900, fmt }) => {
  const frame = useCurrentFrame();
  const lo = interpolate(frame, [minAt, minAt + 10], [0, min], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const hi = interpolate(frame, [maxAt, maxAt + 14], [min, max], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const needle = frame >= maxAt + 14 ? lo + (hi - lo) * (0.5 + 0.5 * Math.sin((frame - maxAt) / 5)) : hi;
  return (
    <div style={{ width, fontFamily, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 900, fontSize: 52, color }}>{label}</span>
        <span style={{ fontWeight: 900, fontSize: 60, color: COLORS.white, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ opacity: frame >= minAt ? 1 : 0 }}>{fmt(min)}</span>
          <span style={{ color: COLORS.muted, margin: "0 14px", opacity: frame >= maxAt ? 1 : 0 }}>a</span>
          <span style={{ opacity: frame >= maxAt ? 1 : 0 }}>{fmt(max)}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.12)" }}>
        <div style={{ position: "absolute", left: `${lo * 100}%`, width: `${Math.max(0, hi - lo) * 100}%`, top: 0, bottom: 0, borderRadius: 27, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 30px ${color}88` }} />
        <div style={{ position: "absolute", left: `calc(${needle * 100}% - 6px)`, top: -10, width: 12, height: 74, borderRadius: 6, backgroundColor: COLORS.white, boxShadow: "0 0 16px rgba(255,255,255,0.8)", opacity: frame >= minAt ? 1 : 0 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 28, color: COLORS.muted }}>
        <span>0</span>
        <span>1</span>
      </div>
    </div>
  );
};

/** Pieza de puzle con texto. */
export const Piece: React.FC<{ at: number; text: string; color: string; index: number; glowAt?: number }> = ({ at, text, color, index, glowAt }) => {
  const frame = useCurrentFrame();
  const glow = glowAt !== undefined && frame >= glowAt;
  const col = index % 2, row = Math.floor(index / 2);
  return (
    <div style={{ position: "relative", width: 420, height: 170, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), rotate: `${interpolate(frame, [at, at + 12], [-10, 0], CLAMP)}deg`, filter: glow ? `drop-shadow(0 0 24px ${color})` : undefined }}>
      <svg width={420} height={170} viewBox="0 0 420 170" style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M20 0 H${col === 0 ? 400 : 400} ${col === 0 ? "" : ""} V170 H20 Z`}
          fill={`${color}33`}
          stroke={color}
          strokeWidth={5}
          rx={20}
        />
        {/* saliente / entrante para que parezca puzle */}
        {col === 0 ? <circle cx={400} cy={85} r={26} fill={`${color}33`} stroke={color} strokeWidth={5} /> : <circle cx={20} cy={85} r={26} fill={COLORS.bgTop} stroke={color} strokeWidth={5} />}
        {row === 0 ? <circle cx={210} cy={170} r={26} fill={`${color}33`} stroke={color} strokeWidth={5} /> : <circle cx={210} cy={0} r={26} fill={COLORS.bgTop} stroke={color} strokeWidth={5} />}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 48px", fontFamily, fontWeight: 900, fontSize: 36, lineHeight: 1.1, textAlign: "center", color: COLORS.white }}>{text}</div>
    </div>
  );
};

/** Pelvis con las sacroilíacas marcadas. */
export const Pelvis: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 200, color = COLORS.cyan }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: size, height: size * 0.8, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size * 0.8} viewBox="0 0 100 80">
        <path d="M50 10 L62 34 L56 70 L44 70 L38 34 Z" fill="rgba(255,255,255,0.1)" stroke={COLORS.white} strokeWidth={4} strokeLinejoin="round" />
        <path d="M38 34 C20 20 6 30 10 48 C14 62 30 66 40 60 M62 34 C80 20 94 30 90 48 C86 62 70 66 60 60" fill="none" stroke={COLORS.white} strokeWidth={4} strokeLinecap="round" />
        <path d="M40 34 L42 60 M60 34 L58 60" stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin((frame - at) / 4)} />
      </svg>
    </div>
  );
};
