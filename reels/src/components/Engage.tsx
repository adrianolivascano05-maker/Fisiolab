import { Easing, interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, SCENES, WIDTH } from "../config";
import { fontFamily } from "../theme";
import { SceneClock } from "../timeline";

/** Barra de progreso por capítulos (una pastilla por escena) en la parte alta de la zona segura. */
export const Progress: React.FC<{ scenes: SceneClock[]; frame: number }> = ({ scenes, frame }) => (
  <div style={{ position: "absolute", top: 262, left: 90, right: 90, display: "flex", gap: 8 }}>
    {SCENES.map((s, i) => {
      const c = scenes[i];
      const p = interpolate(frame, [c.from, c.from + c.dur], [0, 1], CLAMP);
      return (
        <div key={s.id} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
          <div style={{ width: `${p * 100}%`, height: "100%", backgroundColor: i === SCENES.findIndex((x) => x.id === "hallazgo") ? COLORS.orange : COLORS.cyan }} />
        </div>
      );
    })}
  </div>
);

/** Caja de comentario estilo Instagram que teclea un texto letra a letra. */
export const CommentBox: React.FC<{ at: number; typeAt: number; text: string; width?: number }> = ({ at, typeAt, text, width = 900 }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - typeAt) / 5)));
  const typed = text.slice(0, n);
  const caret = frame >= typeAt - 8 && Math.floor(frame / 8) % 2 === 0;
  const sent = n >= text.length && frame >= typeAt + text.length * 5 + 16;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 18, opacity: interpolate(frame, [at, at + 6], [0, 1], CLAMP), translate: `0px ${interpolate(frame, [at, at + 12], [60, 0], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })}px` }}>
      {sent ? (
        <div style={{ display: "flex", gap: 18, alignItems: "center", scale: String(interpolate(frame, [typeAt + text.length * 5 + 16, typeAt + text.length * 5 + 26], [0.8, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })) }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.orange}, #FF3D8A)` }} />
          <div style={{ fontFamily, fontSize: 36, color: COLORS.white }}>
            <span style={{ fontWeight: 800 }}>tú</span> <span style={{ fontWeight: 600 }}>{text}</span>
          </div>
          <div style={{ marginLeft: "auto", fontFamily, fontWeight: 700, fontSize: 30, color: COLORS.red }}>♥ 1</div>
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 28px", borderRadius: 999, border: "3px solid rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.cyan}, #7B61FF)`, flexShrink: 0 }} />
        <div style={{ fontFamily, fontWeight: 700, fontSize: 40, color: typed ? COLORS.white : "rgba(255,255,255,0.4)", flex: 1, textAlign: "left" }}>
          {typed || (frame < typeAt ? "Añade un comentario..." : "")}
          <span style={{ opacity: caret && !sent ? 1 : 0, color: COLORS.orange }}>|</span>
        </div>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 36, color: n >= text.length ? COLORS.cyan : "rgba(255,255,255,0.3)", scale: String(sent ? 0.9 : 1) }}>Publicar</div>
      </div>
    </div>
  );
};

/** Opción de quiz: pastilla que puede quedar «pulsada» y después tachada. */
export const Option: React.FC<{ label: string; at: number; pressAt?: number; wrongAt?: number; color?: string }> = ({ label, at, pressAt, wrongAt, color = COLORS.cyan }) => {
  const frame = useCurrentFrame();
  const pressed = pressAt !== undefined && frame >= pressAt;
  const wrong = wrongAt !== undefined && frame >= wrongAt;
  return (
    <div
      style={{
        position: "relative",
        width: 560,
        padding: "22px 0",
        borderRadius: 999,
        border: `4px solid ${wrong ? COLORS.red : pressed ? color : "rgba(255,255,255,0.4)"}`,
        backgroundColor: wrong ? "rgba(255,77,94,0.15)" : pressed ? `${color}33` : "rgba(255,255,255,0.06)",
        fontFamily,
        fontWeight: 900,
        fontSize: 60,
        color: wrong ? COLORS.red : COLORS.white,
        textAlign: "center",
        opacity: wrong ? 0.8 : 1,
        scale: String(interpolate(frame, [at, at + 12], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }) * (pressAt !== undefined ? interpolate(frame, [pressAt, pressAt + 4, pressAt + 10], [1, 0.94, 1], CLAMP) : 1)),
        boxShadow: pressed && !wrong ? `0 0 40px ${color}66` : undefined,
      }}
    >
      {label}
      {wrong ? <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", height: 8, marginTop: -4, borderRadius: 4, backgroundColor: COLORS.red, transformOrigin: "left center", scale: `${interpolate(frame, [wrongAt!, wrongAt! + 6], [0, 1], CLAMP)} 1` }} /> : null}
    </div>
  );
};

export const centerX = (w: number) => (WIDTH - w) / 2;
