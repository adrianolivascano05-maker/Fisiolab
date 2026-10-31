import { useCurrentFrame } from "remotion";
import { COLORS } from "../config";
import { fontFamily } from "../theme";

/** Moneda girando (solo imagen, sin metáfora hablada). */
export const Coin: React.FC<{ size?: number }> = ({ size = 220 }) => {
  const frame = useCurrentFrame();
  const sx = Math.cos(frame / 4.5);
  const face = sx >= 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: face
          ? "radial-gradient(circle at 35% 30%, #FFE6B3 0%, #FFB347 45%, #C9731A 100%)"
          : "radial-gradient(circle at 35% 30%, #FFF2D0 0%, #FFC266 45%, #A85E12 100%)",
        boxShadow: `0 0 60px ${COLORS.orange}66, inset 0 0 0 10px rgba(0,0,0,0.18)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontWeight: 900,
        fontSize: size * 0.42,
        color: "rgba(60,25,0,0.75)",
        scale: `${Math.max(0.08, Math.abs(sx))} 1`,
        rotate: `${Math.sin(frame / 9) * 6}deg`,
      }}
    >
      {face ? "L4" : "?"}
    </div>
  );
};
