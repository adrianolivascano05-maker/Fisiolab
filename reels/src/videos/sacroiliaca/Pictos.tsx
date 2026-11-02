import { Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../components/Pictograms";
import { CLAMP, COLORS, STICKER_SM } from "../../config";
import { fontFamily } from "../../theme";

/** Figura tumbada en posición del «4» (FABER): una pierna estirada y la otra cruzada con la rodilla abierta. */
export const Leg4: React.FC<{ at: number; size?: number; color?: string; press?: number }> = ({ at, size = 260, color = COLORS.ink, press = 0 }) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [at + 6, at + 20], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  return (
    <div style={{ width: size, height: size * 0.62, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size * 0.62} viewBox="0 0 160 100">
        {/* camilla */}
        <rect x={4} y={78} width={152} height={8} rx={4} fill={COLORS.line} />
        {/* cabeza y tronco */}
        <circle cx={22} cy={62} r={10} fill={color} />
        <path d="M32 66 L84 66" stroke={color} strokeWidth={10} strokeLinecap="round" />
        {/* pierna estirada */}
        <path d="M84 66 L150 68" stroke={color} strokeWidth={8} strokeLinecap="round" />
        {/* pierna en 4: muslo sube y abre, tobillo sobre la rodilla contraria */}
        <g style={{ transformOrigin: "84px 66px", rotate: `${-38 * open}deg` }}>
          <path d={`M84 66 L${116} ${40 - press * 6}`} stroke={COLORS.orange} strokeWidth={8} strokeLinecap="round" />
          <path d={`M${116} ${40 - press * 6} L118 66`} stroke={COLORS.orange} strokeWidth={7} strokeLinecap="round" opacity={0.9} />
        </g>
        {/* mano del fisio que empuja la rodilla */}
        {press > 0 ? <path d="M118 14 L118 26 M112 20 L118 26 L124 20" stroke={COLORS.red} strokeWidth={4} strokeLinecap="round" fill="none" opacity={press} /> : null}
      </svg>
    </div>
  );
};

/** Jeringa (infiltración). */
export const Syringe: React.FC<{ at: number; size?: number; color?: string }> = ({ at, size = 150, color = COLORS.cyan }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <g style={{ transformOrigin: "50px 50px", rotate: "-40deg" }}>
          <rect x={38} y={20} width={24} height={46} rx={4} fill={COLORS.paper} stroke={color} strokeWidth={4} />
          <rect x={41} y={40} width={18} height={23} rx={2} fill={color} opacity={0.35} />
          <path d="M50 66 L50 90" stroke={COLORS.ink} strokeWidth={3} strokeLinecap="round" />
          <path d="M34 20 H66 M50 20 V8 M42 8 H58" stroke={color} strokeWidth={4} strokeLinecap="round" />
          {[30, 38, 46, 54].map((y) => (
            <path key={y} d={`M38 ${y} H45`} stroke={color} strokeWidth={2} />
          ))}
        </g>
      </svg>
    </div>
  );
};

/** Lupa que se desliza (estudio original). */
export const Magnifier: React.FC<{ at: number; size?: number; x?: number; y?: number }> = ({ at, size = 220, x = 0, y = 0 }) => {
  const frame = useCurrentFrame();
  const p = pop(frame, at);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(p), rotate: `${interpolate(frame, [at, at + 30], [-20, 0], CLAMP)}deg` }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={42} cy={42} r={28} fill="rgba(10,88,202,0.08)" stroke={COLORS.ink} strokeWidth={6} />
        <path d="M62 62 L90 90" stroke={COLORS.ink} strokeWidth={10} strokeLinecap="round" />
        <path d="M28 34 A16 16 0 0 1 40 24" stroke={COLORS.paper} strokeWidth={4} strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
};

/** Rejilla de N pacientes (puntos) que aparecen escalonados y pueden teñirse. */
export const DotGrid: React.FC<{ n: number; cols: number; from: number; to: number; tintAt?: number; size?: number; gap?: number }> = ({ n, cols, from, to, tintAt, size = 34, gap = 14 }) => {
  const frame = useCurrentFrame();
  const shown = Math.round(interpolate(frame, [from, to], [0, n], CLAMP));
  const tinted = tintAt !== undefined && frame >= tintAt;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap }}>
      {new Array(n).fill(0).map((_, i) => {
        const vis = i < shown;
        const d = tintAt !== undefined ? Math.max(0, frame - tintAt - Math.floor(i / cols) * 1.2) : 0;
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: tinted && d > 0 ? COLORS.orange : COLORS.paper,
              border: `2px solid ${tinted && d > 0 ? COLORS.orange : COLORS.line}`,
              opacity: vis ? 1 : 0,
              scale: String(vis ? 1 : 0.4),
            }}
          />
        );
      })}
    </div>
  );
};

/** Bucle «TESTS → DIAGNÓSTICO → TESTS» con flechas que giran (razonamiento circular). */
export const Loop: React.FC<{ at: number; size?: number; labelAt?: number; top?: string; bottom?: string; label?: string }> = ({ at, size = 520, labelAt, top = "TESTS", bottom = "DIAGNÓSTICO", label = "LOS MISMOS\nTESTS" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 22], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const spin = frame > at + 22 ? (frame - at - 22) * 0.6 : 0;
  const r = size / 2 - 40;
  const node = (text: string, angle: number, color: string, delay: number) => {
    const a = (angle * Math.PI) / 180;
    return (
      <div
        style={{
          position: "absolute",
          left: size / 2 + r * Math.cos(a) - 130,
          top: size / 2 + r * Math.sin(a) - 42,
          width: 260,
          height: 84,
          borderRadius: 20,
          backgroundColor: COLORS.paper,
          border: `2px solid ${color}`,
          boxShadow: STICKER_SM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontWeight: 900,
          fontSize: 38,
          color,
          scale: String(pop(frame, at + delay)),
          opacity: frame >= at + delay ? 1 : 0,
        }}
      >
        {text}
      </div>
    );
  };
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, rotate: `${spin}deg` }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill={COLORS.orange} />
          </marker>
        </defs>
        <path d={`M ${size / 2 + r} ${size / 2} A ${r} ${r} 0 0 1 ${size / 2 - r * 0.2} ${size / 2 + r * 0.98}`} fill="none" stroke={COLORS.orange} strokeWidth={8} strokeLinecap="round" markerEnd="url(#arr)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        <path d={`M ${size / 2 - r} ${size / 2} A ${r} ${r} 0 0 1 ${size / 2 + r * 0.2} ${size / 2 - r * 0.98}`} fill="none" stroke={COLORS.orange} strokeWidth={8} strokeLinecap="round" markerEnd="url(#arr)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
      {node(top, -90, COLORS.ink, 0)}
      {node(bottom, 90, COLORS.orange, 8)}
      {labelAt !== undefined && frame >= labelAt ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: size / 2 - 40, textAlign: "center", fontFamily, fontWeight: 900, fontSize: 42, lineHeight: 1.1, whiteSpace: "pre-line", color: COLORS.red, scale: String(pop(frame, labelAt)) }}>
          {label}
        </div>
      ) : null}
    </div>
  );
};

/** Pierna recta elevada (Lasègue). `flip` gira el conjunto 180° («al revés»). */
export const SLR: React.FC<{ at: number; size?: number; flipAt?: number }> = ({ at, size = 200, flipAt }) => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [at + 4, at + 18], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  const flip = flipAt === undefined ? 0 : interpolate(frame, [flipAt, flipAt + 12], [0, 180], { ...CLAMP, easing: Easing.bezier(0.83, 0, 0.17, 1) });
  return (
    <div style={{ width: size, height: size * 0.62, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), rotate: `${flip}deg` }}>
      <svg width={size} height={size * 0.62} viewBox="0 0 160 100">
        <rect x={4} y={78} width={152} height={8} rx={4} fill={COLORS.line} />
        <circle cx={22} cy={62} r={10} fill={COLORS.ink} />
        <path d="M32 66 L84 66" stroke={COLORS.ink} strokeWidth={10} strokeLinecap="round" />
        <path d="M84 66 L150 68" stroke={COLORS.ink} strokeWidth={8} strokeLinecap="round" opacity={0.35} />
        <g style={{ transformOrigin: "84px 66px", rotate: `${-55 * lift}deg` }}>
          <path d="M84 66 L150 66" stroke={COLORS.cyan} strokeWidth={8} strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

/** Detector de humo de techo; `alarm` hace parpadear el piloto y salir ondas. */
export const Detector: React.FC<{ at: number; size?: number; alarm?: number }> = ({ at, size = 200, alarm }) => {
  const frame = useCurrentFrame();
  const on = alarm !== undefined && frame >= alarm;
  const blink = on && Math.floor((frame - alarm) / 5) % 2 === 0;
  return (
    <div style={{ width: size, height: size * 0.8, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size * 0.8} viewBox="0 0 100 80">
        <rect x={10} y={4} width={80} height={6} rx={3} fill={COLORS.line} />
        <path d="M18 10 H82 L76 34 H24 Z" fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={3} strokeLinejoin="round" />
        {[34, 44, 54, 64].map((x) => (
          <path key={x} d={`M${x} 18 V26`} stroke={COLORS.line} strokeWidth={3} strokeLinecap="round" />
        ))}
        <circle cx={70} cy={22} r={4} fill={blink ? COLORS.red : "rgba(11,18,32,0.2)"} />
        {on
          ? [0, 1, 2].map((i) => {
              const r = 10 + (((frame - alarm) / 2 + i * 6) % 18);
              return <path key={i} d={`M${50 - r} ${36 + r * 0.5} Q50 ${36 + r} ${50 + r} ${36 + r * 0.5}`} fill="none" stroke={COLORS.red} strokeWidth={2.5} opacity={1 - r / 28} />;
            })
          : null}
      </svg>
    </div>
  );
};

/** Llama (fuego) con un ligero parpadeo. */
export const Flame: React.FC<{ at: number; size?: number; question?: boolean }> = ({ at, size = 160, question = false }) => {
  const frame = useCurrentFrame();
  const f = Math.sin(frame / 3) * 0.04;
  return (
    <div style={{ position: "relative", width: size, height: size, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ scale: `${1 - f} ${1 + f}`, transformOrigin: "50% 100%" }}>
        <path d="M50 8 C62 30 80 40 78 64 C76 84 62 94 50 94 C38 94 24 84 22 64 C20 46 34 38 38 22 C44 34 48 36 50 8 Z" fill={COLORS.orange} />
        <path d="M50 46 C56 58 64 62 62 76 C61 86 56 90 50 90 C44 90 39 86 38 76 C37 66 46 60 50 46 Z" fill="#FFB547" />
      </svg>
      {question ? <div style={{ position: "absolute", right: -16, top: -10, fontFamily, fontWeight: 900, fontSize: size * 0.4, color: COLORS.ink }}>?</div> : null}
    </div>
  );
};

/** Humo: tres bocanadas que suben. */
export const Smoke: React.FC<{ at: number; size?: number }> = ({ at, size = 140 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {[0, 1, 2].map((i) => {
        const t = ((frame - at) / 30 + i / 3) % 1;
        return <circle key={i} cx={50 + Math.sin(t * 6 + i) * 10} cy={90 - t * 80} r={10 + t * 14} fill="rgba(11,18,32,0.18)" opacity={1 - t} />;
      })}
    </svg>
  );
};
