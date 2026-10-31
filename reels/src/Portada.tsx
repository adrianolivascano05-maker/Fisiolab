import { AbsoluteFill } from "remotion";
import { Background } from "./components/Background";
import { COLORS, META } from "./config";
import { fontFamily } from "./theme";

/** Portada del reel: «¿Seguro que es L4?» con un 47 % grande. */
export const Portada: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 20, padding: 90 }}>
      <div style={{ fontWeight: 900, fontSize: 108, color: COLORS.white, textAlign: "center", lineHeight: 1.05, letterSpacing: -3, textShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>{META.portada.linea1}</div>
      <div style={{ fontWeight: 900, fontSize: 400, color: COLORS.orange, lineHeight: 1, letterSpacing: -16, whiteSpace: "nowrap", textShadow: `0 0 90px ${COLORS.orange}99` }}>
        {META.portada.dato.replace(/\s*%$/, "")}
        <span style={{ fontSize: 200, letterSpacing: 0, marginLeft: 10 }}>%</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 44, color: COLORS.cyan, letterSpacing: 6, textAlign: "center" }}>ACIERTOS DE VÉRTEBRA EXACTA</div>
      <div style={{ fontWeight: 600, fontSize: 30, color: COLORS.muted, marginTop: 30, textAlign: "center" }}>Harlick et al., Man Ther 2007 · Custers et al., Life 2024</div>
    </AbsoluteFill>
  </AbsoluteFill>
);
