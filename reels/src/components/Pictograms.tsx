import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS } from "../config";
import { fontFamily } from "../theme";

/** Entrada con rebote a partir del frame `at` (devuelve la escala 0..1). */
export const pop = (frame: number, at: number, len = 12) =>
  interpolate(frame, [at, at + len], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });

const Wrap: React.FC<{ at: number; size: number; children: React.ReactNode; glow?: string; delay?: number }> = ({ at, size, children, glow, delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= at + delay ? 1 : 0, scale: String(pop(frame, at + delay)), filter: glow ? `drop-shadow(0 0 ${size / 8}px ${glow})` : undefined }}>
      {children}
    </div>
  );
};

/** Persona (fisio o paciente). */
export const Person: React.FC<{ at: number; size?: number; color?: string; delay?: number; coat?: boolean }> = ({ at, size = 120, color = COLORS.white, delay = 0, coat = false }) => (
  <Wrap at={at} size={size} delay={delay} glow={color !== COLORS.white ? color : undefined}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={24} r={16} fill={color} />
      <path d="M18 96 C18 62 34 50 50 50 C66 50 82 62 82 96 Z" fill={color} />
      {coat ? <path d="M50 52 L44 96 L56 96 Z" fill={COLORS.ink} opacity={0.5} /> : null}
    </svg>
  </Wrap>
);

/** Mano que palpa (vista lateral, dedos extendidos). */
export const Hand: React.FC<{ at: number; size?: number; color?: string; press?: number }> = ({ at, size = 200, color = COLORS.orange, press = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <Wrap at={at} size={size} glow={color}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ translate: `0px ${press * 10}px`, rotate: `${press * -4}deg` }}>
        <path d="M30 95 L30 55 C30 45 36 40 42 42 L42 20 C42 12 52 12 52 20 L52 40 L58 18 C60 10 70 12 68 20 L63 42 L72 28 C76 20 86 25 82 33 L72 50 L84 44 C92 40 96 50 90 55 L74 68 C66 78 60 80 54 86 L54 95 Z" fill={color} />
        <rect x={30} y={88} width={24} height={10} fill={color} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${60 + i * 8} ${74 + i * 5} q6 -4 12 0`} fill="none" stroke={COLORS.white} strokeWidth={2} opacity={interpolate(frame, [at + 10 + i * 4, at + 14 + i * 4], [0, 0.8], CLAMP) * (1 - press)} />
        ))}
      </svg>
    </Wrap>
  );
};

/** Vértebra sola (vista superior: cuerpo + arco + espinosa). */
export const Vertebra: React.FC<{ at: number; size?: number; color?: string; label?: string }> = ({ at, size = 160, color = COLORS.white, label }) => (
  <Wrap at={at} size={size} glow={color !== COLORS.white ? color : undefined}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <ellipse cx={50} cy={40} rx={30} ry={22} fill="rgba(255,255,255,0.1)" stroke={color} strokeWidth={5} />
      <path d="M30 56 C26 72 36 78 50 78 C64 78 74 72 70 56" fill="none" stroke={color} strokeWidth={5} />
      <path d="M50 78 L50 96 M44 96 L56 96" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <path d="M26 60 L12 66 M74 60 L88 66" stroke={color} strokeWidth={5} strokeLinecap="round" />
      {label ? <text x={50} y={46} textAnchor="middle" fontFamily={fontFamily} fontWeight={900} fontSize={20} fill={color}>{label}</text> : null}
    </svg>
  </Wrap>
);

/** Báscula (peso / IMC). */
export const Scale: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 120, color = COLORS.white }) => (
  <Wrap at={at} size={size}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x={14} y={30} width={72} height={60} rx={10} fill="rgba(255,255,255,0.1)" stroke={color} strokeWidth={5} />
      <path d="M30 56 A20 20 0 0 1 70 56" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <path d="M50 56 L58 44" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <rect x={34} y={14} width={32} height={10} rx={5} fill={color} />
    </svg>
  </Wrap>
);

/** Calendario (edad). */
export const Calendar: React.FC<{ at: number; size?: number; color?: string; text?: string }> = ({ at, size = 120, color = COLORS.white, text = "65" }) => (
  <Wrap at={at} size={size}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x={12} y={20} width={76} height={70} rx={10} fill="rgba(255,255,255,0.1)" stroke={color} strokeWidth={5} />
      <rect x={12} y={20} width={76} height={18} rx={6} fill={color} />
      <rect x={28} y={8} width={8} height={20} rx={4} fill={color} />
      <rect x={64} y={8} width={8} height={20} rx={4} fill={color} />
      <text x={50} y={74} textAnchor="middle" fontFamily={fontFamily} fontWeight={900} fontSize={30} fill={color}>{text}</text>
    </svg>
  </Wrap>
);

/** Símbolos de sexo. */
export const Sex: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 120, color = COLORS.white }) => (
  <Wrap at={at} size={size}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={36} cy={58} r={18} fill="none" stroke={color} strokeWidth={5} />
      <path d="M49 45 L68 26 M56 26 L68 26 L68 38" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <circle cx={70} cy={60} r={14} fill="none" stroke={color} strokeWidth={5} opacity={0.75} />
      <path d="M70 74 L70 92 M62 84 L78 84" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
    </svg>
  </Wrap>
);

/** Rotulador (marcador). */
export const Marker: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 120, color = COLORS.orange }) => (
  <Wrap at={at} size={size} glow={color}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <g style={{ transformOrigin: "50px 50px", rotate: "40deg" }}>
        <rect x={40} y={8} width={20} height={56} rx={6} fill={color} />
        <path d="M40 64 L50 90 L60 64 Z" fill={COLORS.white} />
        <rect x={40} y={8} width={20} height={14} rx={6} fill={COLORS.ink} opacity={0.4} />
      </g>
    </svg>
  </Wrap>
);

/** Bocadillo de opinión. */
export const Bubble: React.FC<{ at: number; size?: number; color?: string; text?: string; width?: number }> = ({ at, size = 140, color = COLORS.white, text, width = 100 }) => (
  <Wrap at={at} size={size}>
    <svg width={size * (width / 100)} height={size} viewBox={`0 0 ${width} 100`}>
      <path d={`M14 14 H${width - 14} a10 10 0 0 1 10 10 V62 a10 10 0 0 1 -10 10 H44 L28 88 L30 72 H14 a10 10 0 0 1 -10 -10 V24 a10 10 0 0 1 10 -10 Z`} fill="rgba(255,255,255,0.1)" stroke={color} strokeWidth={5} strokeLinejoin="round" />
      {text ? <text x={width / 2} y={50} textAnchor="middle" fontFamily={fontFamily} fontWeight={900} fontSize={22} fill={color}>{text}</text> : <path d={`M30 42 H${width - 30}`} stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray="10 8" />}
    </svg>
  </Wrap>
);

/** Diana / retícula (nivel exacto). */
export const Target: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 160, color = COLORS.orange }) => {
  const frame = useCurrentFrame();
  return (
    <Wrap at={at} size={size} glow={color}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ rotate: `${(frame - at) * 1.5}deg` }}>
        <circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={4} strokeDasharray="14 10" />
        <circle cx={50} cy={50} r={22} fill="none" stroke={color} strokeWidth={4} />
        <path d="M50 4 V22 M50 78 V96 M4 50 H22 M78 50 H96" stroke={color} strokeWidth={4} strokeLinecap="round" />
        <circle cx={50} cy={50} r={6} fill={color} />
      </svg>
    </Wrap>
  );
};

/** Medidor con aguja (lo que cambia el resultado). */
export const Gauge: React.FC<{ at: number; size?: number; needle?: number; color?: string }> = ({ at, size = 220, needle = 0.5, color = COLORS.cyan }) => (
  <Wrap at={at} size={size}>
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60">
      <path d="M8 56 A42 42 0 0 1 92 56" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={10} strokeLinecap="round" />
      <path d="M8 56 A42 42 0 0 1 92 56" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - needle} />
      <g style={{ transformOrigin: "50px 56px", rotate: `${-90 + needle * 180}deg` }}>
        <path d="M50 56 L50 18" stroke={COLORS.white} strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={50} cy={56} r={6} fill={COLORS.white} />
    </svg>
  </Wrap>
);

/** Mano con el dedo índice que pulsa (cursor de interacción). */
export const Finger: React.FC<{ x: number; y: number; at: number; tapAt?: number; size?: number }> = ({ x, y, at, tapAt, size = 110 }) => {
  const frame = useCurrentFrame();
  const press = tapAt === undefined ? 0 : interpolate(frame, [tapAt, tapAt + 4, tapAt + 10], [0, 1, 0], CLAMP);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: interpolate(frame, [at, at + 6], [0, 1], CLAMP), scale: String(1 - press * 0.15), translate: `0px ${press * 10}px`, pointerEvents: "none" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.6))" }}>
        <path d="M38 96 L38 60 L30 46 C26 40 34 34 38 40 L44 50 L44 14 C44 6 56 6 56 14 L56 48 L62 46 C66 44 72 46 72 52 L72 50 C76 48 82 52 82 58 C86 58 90 62 88 68 L84 86 C82 92 78 96 72 96 Z" fill="#FFD9B3" stroke={COLORS.ink} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      {tapAt !== undefined ? <div style={{ position: "absolute", left: size * 0.5 - 40, top: size * 0.05 - 40, width: 80, height: 80, borderRadius: "50%", border: `4px solid ${COLORS.white}`, opacity: interpolate(frame, [tapAt, tapAt + 14], [0.9, 0], CLAMP), scale: String(interpolate(frame, [tapAt, tapAt + 14], [0.3, 1.6], CLAMP)) }} /> : null}
    </div>
  );
};
