import { AbsoluteFill } from "remotion";
import { Background } from "./components/Background";
import { COLORS, VideoMeta } from "./config";
import { fontFamily } from "./theme";

/** Portada del reel: frase + dato grande + fuente. */
export const Portada: React.FC<{ meta: VideoMeta }> = ({ meta }) => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 20, padding: 90 }}>
      <div style={{ fontWeight: 900, fontSize: 140, color: COLORS.white, textAlign: "center", lineHeight: 1.0, letterSpacing: -5, textShadow: "none" }}>{meta.portada.linea1}</div>
      <div style={{ fontWeight: 900, fontSize: meta.portada.dato.length > 8 ? 160 : meta.portada.dato.length > 4 ? 250 : 460, color: COLORS.orange, lineHeight: 1, letterSpacing: -8, whiteSpace: "nowrap", textAlign: "center", textShadow: "none" }}>
        {meta.portada.dato.replace(/\s*%$/, "")}
        {/%$/.test(meta.portada.dato) ? <span style={{ fontSize: 200, letterSpacing: 0, marginLeft: 10 }}>%</span> : null}
      </div>
      <div style={{ fontWeight: 800, fontSize: 52, color: COLORS.cyan, letterSpacing: 4, textAlign: "center", maxWidth: 900 }}>{meta.portada.sub}</div>
      <div style={{ fontWeight: 600, fontSize: 28, color: COLORS.muted, marginTop: 40, textAlign: "center", opacity: 0.8 }}>{meta.fuente.replace(/^Fuente: /, "")}</div>
    </AbsoluteFill>
  </AbsoluteFill>
);
