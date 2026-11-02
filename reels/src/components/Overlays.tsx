import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, FPS, VideoMeta } from "../config";
import { fontFamily } from "../theme";
import { SceneClock } from "../timeline";

/** Cold open: el dato a pantalla completa antes de la voz. También sirve de último fotograma (bucle). */
export const ColdOpen: React.FC<{ meta: VideoMeta; from: number; dur: number; outro?: boolean }> = ({ meta, from, dur, outro = false }) => {
  const frame = useCurrentFrame();
  const f = frame - from;
  if (f < 0 || f >= dur) return null;
  const inP = interpolate(f, [0, 6], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const out = outro ? 1 : interpolate(f, [dur - 5, dur], [1, 0], CLAMP);
  const big = meta.coldOpen.big;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, fontFamily, opacity: outro ? interpolate(f, [0, 8], [0, 1], CLAMP) : out, backgroundColor: COLORS.bgTop }}>
      <div style={{ position: "absolute", left: 90, top: 520, width: 900, height: 820, borderRadius: "46% 54% 52% 48% / 55% 45% 55% 45%", backgroundColor: "#FFD6C9", rotate: `${Math.sin(f / 30) * 4 - 6}deg` }} />
      <div style={{ position: "absolute", left: 640, top: 1180, width: 360, height: 340, borderRadius: "50% 50% 45% 55% / 55% 45% 55% 45%", backgroundColor: "#FFF0BF" }} />
      <div style={{ fontWeight: 900, fontSize: big.length > 5 ? 220 : 380, lineHeight: 1, letterSpacing: -10, color: COLORS.orange, textShadow: `8px 8px 0 ${COLORS.ink}`, scale: String(0.6 + 0.4 * inP), whiteSpace: "nowrap" }}>{big}</div>
      <div style={{ fontWeight: 800, fontSize: 56, color: COLORS.white, textAlign: "center", lineHeight: 1.15, maxWidth: 900, opacity: interpolate(f, [4, 10], [0, 1], CLAMP), translate: `0px ${interpolate(f, [4, 12], [30, 0], CLAMP)}px` }}>{meta.coldOpen.small}</div>
      {outro ? (
        <div style={{ position: "absolute", bottom: 420, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: COLORS.muted, opacity: interpolate(f, [6, 12], [0, 1], CLAMP) }}>VUELVE A VERLO</div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Cuenta atrás 3-2-1 y negro de 0,3 s justo antes del dato fuerte. */
export const Countdown: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const f = frame - (at - Math.round(0.9 * FPS));
  const len = Math.round(0.9 * FPS);
  if (f < 0 || f >= len) return null;
  const black = f >= len - Math.round(0.3 * FPS);
  const step = Math.min(2, Math.floor(f / 6));
  const n = 3 - step;
  const fi = f - step * 6;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily }}>
      {black ? <AbsoluteFill style={{ backgroundColor: COLORS.ink }} /> : null}
      {!black ? (
        <div style={{ fontWeight: 900, fontSize: 300, lineHeight: 1, color: COLORS.white, textShadow: "none", scale: String(interpolate(fi, [0, 6], [1.25, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })), opacity: interpolate(fi, [0, 1, 6], [0, 1, 0.9], CLAMP) }}>{n}</div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Aviso de «guárdalo» con icono de marcador, arriba a la derecha, 1,4 s. */
export const SaveNudge: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const f = frame - at;
  const len = Math.round(1.4 * FPS);
  if (f < 0 || f >= len) return null;
  const p = interpolate(f, [0, 8], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  const bob = Math.sin(f / 3) * 4;
  return (
    <div style={{ position: "absolute", left: "50%", translate: "-50% 0", top: 196, display: "flex", alignItems: "center", gap: 14, fontFamily, fontWeight: 900, fontSize: 36, color: COLORS.ink, backgroundColor: COLORS.paper, border: `3px solid ${COLORS.ink}`, padding: "12px 22px", borderRadius: 999, boxShadow: "4px 4px 0 #14181F", scale: String(p * interpolate(f, [len - 6, len], [1, 0], CLAMP)), marginTop: bob }}>
      <svg width={34} height={40} viewBox="0 0 34 40">
        <path d="M4 3 H30 V37 L17 27 L4 37 Z" fill={COLORS.orange} stroke={COLORS.ink} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      GUÁRDALO
    </div>
  );
};

/** Cámara: zoom lento por escena (alternando dentro/fuera), barrido corto con desenfoque en cada corte,
 *  fondo con parallax (se mueve a 0,3) y tinte de color por escena. */
export const Camera: React.FC<{ scenes: SceneClock[]; tints?: Record<string, string>; background: React.ReactNode; children: React.ReactNode }> = ({ scenes, tints = {}, background, children }) => {
  const frame = useCurrentFrame();
  const c = scenes.find((s) => frame >= s.from && frame < s.from + s.dur) ?? scenes[scenes.length - 1];
  const i = scenes.indexOf(c);
  const p = (frame - c.from) / Math.max(1, c.dur);
  const zoom = 1 + 0.035 * (i % 2 === 0 ? p : 1 - p);
  const dir = i % 2 === 0 ? 1 : -1;
  // Barrido: sale hacia un lado en los 4 frames previos al corte y entra desde el contrario en los 5 siguientes
  const next = scenes[i + 1];
  const out = next ? interpolate(frame, [next.from - 4, next.from], [0, 1], { ...CLAMP, easing: Easing.bezier(0.7, 0, 0.84, 0) }) : 0;
  const inn = i > 0 ? interpolate(frame, [c.from, c.from + 5], [1, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) }) : 0;
  const whip = out > 0 ? -dir * 90 * out : dir * 90 * inn;
  const blur = Math.max(out, inn) * 6;
  const tint = tints[c.id];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ translate: `${whip * 0.3}px 0px`, scale: String(1 + (zoom - 1) * 0.5) }}>{background}</AbsoluteFill>
      <AbsoluteFill style={{ scale: String(zoom), translate: `${whip}px ${-10 * p}px`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
      {tint ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${tint}2e 0%, rgba(0,0,0,0) 70%)`, opacity: interpolate(frame, [c.from, c.from + 10], [0, 1], CLAMP) }} /> : null}
    </AbsoluteFill>
  );
};
