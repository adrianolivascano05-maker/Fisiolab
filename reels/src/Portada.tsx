import { AbsoluteFill } from "remotion";
import { Background } from "./components/Background";
import { COLORS, VideoMeta } from "./config";
import { fontFamily } from "./theme";

/** Portada del reel: frase + dato grande + fuente. */
export const Portada: React.FC<{ meta: VideoMeta }> = ({ meta }) => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 20, padding: 90 }}>
      <div style={{ fontWeight: 900, fontSize: 108, color: COLORS.white, textAlign: "center", lineHeight: 1.05, letterSpacing: -3, textShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>{meta.portada.linea1}</div>
      <div style={{ fontWeight: 900, fontSize: meta.portada.dato.length > 4 ? 220 : 400, color: COLORS.orange, lineHeight: 1, letterSpacing: -8, whiteSpace: "nowrap", textAlign: "center", textShadow: `0 0 90px ${COLORS.orange}99` }}>
        {meta.portada.dato.replace(/\s*%$/, "")}
        {/%$/.test(meta.portada.dato) ? <span style={{ fontSize: 200, letterSpacing: 0, marginLeft: 10 }}>%</span> : null}
      </div>
      <div style={{ fontWeight: 700, fontSize: 44, color: COLORS.cyan, letterSpacing: 6, textAlign: "center" }}>{meta.portada.sub}</div>
      <div style={{ fontWeight: 600, fontSize: 30, color: COLORS.muted, marginTop: 30, textAlign: "center" }}>{meta.fuente.replace(/^Fuente: /, "")}</div>
    </AbsoluteFill>
  </AbsoluteFill>
);
