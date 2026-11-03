import { Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS, STICKER, STICKER_SM } from "../../config";
import { fontFamily } from "../../theme";

/* Mano en vista palmar (contorno limpio: primero el trazo de todas las piezas, luego el relleno encima). */
const PARTS = [
  "M58 112 L58 52 Q58 40 68 40 Q78 40 78 52 L78 112 Z", // índice
  "M82 112 L82 36 Q82 24 92 24 Q102 24 102 36 L102 112 Z", // medio
  "M106 112 L106 46 Q106 34 116 34 Q126 34 126 46 L126 112 Z", // anular
  "M130 116 L130 66 Q130 56 139 56 Q148 56 148 66 L148 120 Z", // meñique
  "M66 178 L28 132 Q20 122 28 114 Q36 108 44 116 L80 152 Z", // pulgar
  "M54 108 L150 108 Q156 150 146 186 Q136 206 100 206 Q66 206 58 184 Q50 150 54 108 Z", // palma
  "M70 196 L130 196 L134 262 L66 262 Z", // muñeca / antebrazo
];

/** Mano con el túnel carpiano. `pain` 0..1 enciende la muñeca; `nerve` 0..1 dibuja el nervio mediano;
 *  `territory` 0..1 tiñe pulgar, índice, medio y medio anular (su recorrido). */
export const WristHand: React.FC<{ at: number; size?: number; pain?: number; nerve?: number; territory?: number; tunnel?: number }> = ({ at, size = 300, pain = 0, nerve = 0, territory = 0, tunnel = 0 }) => {
  const frame = useCurrentFrame();
  const h = size * 1.3;
  const pulse = 0.85 + 0.15 * Math.sin(frame / 5);
  return (
    <div style={{ width: size, height: h, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={h} viewBox="0 0 200 270">
        <defs>
          <radialGradient id="wristPain">
            <stop offset="0%" stopColor={COLORS.red} stopOpacity={0.75} />
            <stop offset="100%" stopColor={COLORS.red} stopOpacity={0} />
          </radialGradient>
          <clipPath id="handClip">
            {PARTS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </clipPath>
        </defs>
        {PARTS.map((d, i) => (
          <path key={`s${i}`} d={d} fill="none" stroke={COLORS.ink} strokeWidth={7} strokeLinejoin="round" />
        ))}
        {PARTS.map((d, i) => (
          <path key={`f${i}`} d={d} fill={COLORS.paper} />
        ))}
        {/* territorio del mediano */}
        <g clipPath="url(#handClip)" opacity={territory * 0.55}>
          <path d="M66 178 L28 132 Q20 122 28 114 Q36 108 44 116 L80 152 Z" fill={COLORS.amber} />
          <rect x={56} y={20} width={60} height={120} fill={COLORS.amber} />
          <rect x={60} y={120} width={56} height={70} fill={COLORS.amber} />
        </g>
        {/* dolor en la muñeca */}
        <circle cx={100} cy={200} r={52 * pulse} fill="url(#wristPain)" opacity={pain} />
        {/* ligamento transverso (techo del túnel) */}
        <path d="M70 196 Q100 182 130 196" fill="none" stroke={COLORS.cyan} strokeWidth={8} strokeLinecap="round" opacity={tunnel} />
        {/* nervio mediano */}
        <path
          d="M100 262 L100 196 Q98 170 92 150 M92 150 L60 126 M92 150 L68 70 M92 150 L92 50 M96 156 L110 70"
          fill="none"
          stroke={COLORS.orange}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - nerve}
        />
      </svg>
    </div>
  );
};

/** Expediente con sello «¿CERRADO?». */
export const CaseFile: React.FC<{ at: number; stampAt?: number; width?: number }> = ({ at, stampAt, width = 420 }) => {
  const frame = useCurrentFrame();
  const st = stampAt !== undefined && frame >= stampAt;
  return (
    <div style={{ position: "relative", width, height: width * 0.72, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), fontFamily }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: width * 0.4, height: 40, borderRadius: "16px 16px 0 0", backgroundColor: "#D8E2EE" }} />
      <div style={{ position: "absolute", left: 0, top: 30, right: 0, bottom: 0, borderRadius: 22, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, padding: "26px 30px" }}>
        <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: 4, color: COLORS.muted }}>DIAGNÓSTICO</div>
        <div style={{ fontWeight: 900, fontSize: 44, color: COLORS.ink, marginTop: 4 }}>Túnel carpiano</div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 12, width: `${88 - i * 18}%`, borderRadius: 6, backgroundColor: "rgba(11,18,32,0.08)", marginTop: 16 }} />
        ))}
      </div>
      {st ? (
        <div style={{ position: "absolute", right: -20, bottom: 20, padding: "10px 22px", border: `5px solid ${COLORS.red}`, borderRadius: 14, color: COLORS.red, fontWeight: 900, fontSize: 46, letterSpacing: 2, backgroundColor: "rgba(255,255,255,0.85)", rotate: "-12deg", scale: String(interpolate(frame, [stampAt!, stampAt! + 8], [2.4, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })), opacity: interpolate(frame, [stampAt!, stampAt! + 3], [0, 1], CLAMP) }}>
          ¿CERRADO?
        </div>
      ) : null}
    </div>
  );
};

/** Dos grupos de puntos: casos (con fibromialgia) y controles. */
export const CaseControl: React.FC<{ at: number; casesAt: number; controlsAt: number; n: number; nAt: number }> = ({ at, casesAt, controlsAt, n, nAt }) => {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [nAt, nAt + 24], [0, n], { ...CLAMP, easing: Easing.out(Easing.cubic) }));
  const grid = (color: string, start: number) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 26px)", gap: 10 }}>
      {new Array(40).fill(0).map((_, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: color, scale: String(pop(frame, start + (i % 8) + Math.floor(i / 8))) }} />
      ))}
    </div>
  );
  const panel = (title: string, sub: string, color: string, start: number, extra?: React.ReactNode) => (
    <div style={{ width: 410, padding: "24px 26px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${color}`, boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: frame >= start ? 1 : 0, scale: String(pop(frame, start)) }}>
      <div style={{ fontWeight: 900, fontSize: 40, color }}>{title}</div>
      {grid(color, start + 4)}
      <div style={{ fontWeight: 800, fontSize: 30, color: COLORS.ink, textAlign: "center", lineHeight: 1.1 }}>{sub}</div>
      {extra}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 40, opacity: frame >= at ? 1 : 0, fontFamily }}>
      {panel(
        "CASOS",
        "con fibromialgia",
        COLORS.orange,
        casesAt,
        <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.orange, fontVariantNumeric: "tabular-nums", opacity: frame >= nAt ? 1 : 0 }}>{count >= 1000 ? `${Math.floor(count / 1000)}.${String(count % 1000).padStart(3, "0")}` : count}</div>,
      )}
      {panel("CONTROLES", "para comparar", COLORS.muted, controlsAt, <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.muted }}>vs</div>)}
    </div>
  );
};

/** Gráfico de odds ratios con la línea del 1 («sin diferencia»). Cada fila crece al aparecer. */
export const OrBars: React.FC<{ rows: { label: string; v: number; at: number; color?: string }[]; axisAt: number; width?: number; max?: number; tripleAt?: number }> = ({ rows, axisAt, width = 900, max = 3.3, tripleAt }) => {
  const frame = useCurrentFrame();
  const labelW = 340;
  const valW = 120;
  const barW = width - labelW - valW;
  const x = (v: number) => (v / max) * barW;
  const rowH = 104;
  const top = 54;
  return (
    <div style={{ position: "relative", width, height: top + rows.length * rowH + 20, fontFamily, opacity: frame >= axisAt ? 1 : 0 }}>
      {/* línea del 1 */}
      <div style={{ position: "absolute", left: labelW + x(1) - 2, top: top - 10, width: 4, height: rows.length * rowH + 14, backgroundImage: `repeating-linear-gradient(${COLORS.ink} 0 12px, transparent 12px 22px)`, opacity: 0.55 }} />
      <div style={{ position: "absolute", left: labelW + x(1) - 120, top: 0, width: 240, textAlign: "center", fontWeight: 800, fontSize: 26, color: COLORS.muted }}>1 = sin diferencia</div>
      {rows.map((r, i) => {
        const g = interpolate(frame, [r.at, r.at + 16], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
        const v = 1 + (r.v - 1) * g;
        const on = frame >= r.at;
        const col = r.color ?? COLORS.cyan;
        return (
          <div key={r.label} style={{ position: "absolute", left: 0, top: top + i * rowH, width, height: rowH - 18, display: "flex", alignItems: "center", opacity: on ? 1 : 0.18 }}>
            <div style={{ width: labelW, fontWeight: 900, fontSize: 38, color: COLORS.ink, textAlign: "right", paddingRight: 20, whiteSpace: "nowrap" }}>{r.label}</div>
            <div style={{ position: "relative", width: barW, height: "100%" }}>
              <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: x(on ? v : 1), borderRadius: "0 14px 14px 0", backgroundColor: col, boxShadow: STICKER_SM }} />
            </div>
            <div style={{ width: valW, fontWeight: 900, fontSize: 48, color: col, fontVariantNumeric: "tabular-nums", paddingLeft: 10 }}>{on ? v.toFixed(2).replace(".", ",") : ""}</div>
          </div>
        );
      })}
      {tripleAt !== undefined && frame >= tripleAt ? (
        <div style={{ position: "absolute", left: labelW + x(2.98) - 130, top: top + 14, padding: "4px 16px", borderRadius: 10, backgroundColor: COLORS.paper, color: COLORS.orange, fontWeight: 900, fontSize: 36, scale: String(pop(frame, tripleAt)) }}>≈ ×3</div>
      ) : null}
    </div>
  );
};

/** Dos fichas (FIBRO y MANO) unidas: cadena «van juntas», flecha que cambia de sentido, o causa tachada. */
export const LinkChips: React.FC<{ at: number; linkAt: number; arrowAt?: number; causeAt?: number; width?: number }> = ({ at, linkAt, arrowAt, causeAt, width = 860 }) => {
  const frame = useCurrentFrame();
  const chip = (text: string, color: string, delay: number) => (
    <div style={{ width: 280, padding: "28px 0", borderRadius: 26, backgroundColor: COLORS.paper, border: `4px solid ${color}`, boxShadow: STICKER, fontWeight: 900, fontSize: 52, color, textAlign: "center", scale: String(pop(frame, at + delay)) }}>{text}</div>
  );
  const arrowOn = arrowAt !== undefined && frame >= arrowAt;
  // la flecha alterna de sentido cada 14 frames: no se sabe cuál llega antes
  const dir = arrowOn ? (Math.floor((frame - arrowAt!) / 14) % 2 === 0 ? 1 : -1) : 1;
  const crossed = causeAt !== undefined && frame >= causeAt;
  const midW = width - 560;
  return (
    <div style={{ display: "flex", alignItems: "center", width, opacity: frame >= at ? 1 : 0, fontFamily }}>
      {chip("FIBRO", COLORS.orange, 0)}
      <div style={{ position: "relative", width: midW, height: 140 }}>
        <svg width={midW} height={140} viewBox={`0 0 ${midW} 140`}>
          {!arrowOn ? (
            <path d={`M10 70 H${midW - 10}`} stroke={COLORS.ink} strokeWidth={8} strokeDasharray="14 10" opacity={interpolate(frame, [linkAt, linkAt + 8], [0, 1], CLAMP)} />
          ) : (
            <g style={{ transformOrigin: `${midW / 2}px 70px`, scale: `${dir} 1` }}>
              <path d={`M14 70 H${midW - 34}`} stroke={crossed ? COLORS.red : COLORS.ink} strokeWidth={10} strokeLinecap="round" />
              <path d={`M${midW - 50} 46 L${midW - 14} 70 L${midW - 50} 94`} fill="none" stroke={crossed ? COLORS.red : COLORS.ink} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </svg>
        {arrowOn ? (
          <div style={{ position: "absolute", left: midW / 2 - 30, top: -8, width: 60, height: 60, borderRadius: "50%", backgroundColor: COLORS.orange, color: COLORS.paper, fontWeight: 900, fontSize: 44, display: "flex", alignItems: "center", justifyContent: "center", scale: String(pop(frame, arrowAt!)) }}>?</div>
        ) : null}
      </div>
      {chip("MANO", COLORS.cyan, 4)}
    </div>
  );
};

/** Icono de hospital (uso sanitario) o bisturí (cirugía) con flecha arriba. */
export const UpStat: React.FC<{ at: number; kind: "hospital" | "cirugia"; label: string }> = ({ at, kind, label }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: 400, padding: "26px 20px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), fontFamily }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width={130} height={130} viewBox="0 0 100 100">
          {kind === "hospital" ? (
            <>
              <rect x={14} y={30} width={72} height={60} rx={6} fill="none" stroke={COLORS.ink} strokeWidth={6} />
              <rect x={40} y={66} width={20} height={24} fill={COLORS.ink} />
              <path d="M50 38 V58 M40 48 H60" stroke={COLORS.red} strokeWidth={8} strokeLinecap="round" />
              <path d="M30 30 L50 12 L70 30" fill="none" stroke={COLORS.ink} strokeWidth={6} strokeLinejoin="round" />
            </>
          ) : (
            <>
              <path d="M18 82 L62 38" stroke={COLORS.ink} strokeWidth={10} strokeLinecap="round" />
              <path d="M62 38 Q80 16 92 12 Q88 30 66 46 Z" fill={COLORS.cyan} stroke={COLORS.ink} strokeWidth={5} strokeLinejoin="round" />
            </>
          )}
        </svg>
        <svg width={70} height={110} viewBox="0 0 50 80" style={{ translate: `0px ${interpolate(frame, [at + 6, at + 16], [20, 0], CLAMP)}px`, opacity: interpolate(frame, [at + 6, at + 12], [0, 1], CLAMP) }}>
          <path d="M25 76 V10 M8 28 L25 8 L42 28" fill="none" stroke={COLORS.red} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontWeight: 900, fontSize: 38, color: COLORS.ink, textAlign: "center", lineHeight: 1.1, whiteSpace: "pre-line" }}>{label}</div>
    </div>
  );
};
