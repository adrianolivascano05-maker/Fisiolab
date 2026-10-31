import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Coin } from "../components/Coin";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Gancho: «MÁS DE LA MITAD FALLÓ» de golpe con temblor; moneda girando solo como imagen. */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const hit = wordAt(s2, "mitad") - 2;
  const hit2 = wordAt(s2, "equivocaron");
  const pre = interpolate(frame, [hit - 6, hit], [1, 0], { ...CLAMP, easing: Easing.bezier(0.7, 0, 0.84, 0) });
  return (
    <Punch shakeAt={[hit, hit2]} amount={1.2}>
      <Stage gap={30}>
        {/* Fase 1: moneda + dos etiquetas */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40, opacity: pre, scale: String(0.7 + 0.3 * pre) }}>
          <div style={{ scale: String(interpolate(frame, [0, 8], [0.4, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })) }}>
            <Coin size={260} />
          </div>
          <Slam text="FISIOS EXPERTOS" at={Math.max(0, s0.start - 6)} size={96} color={COLORS.white} />
          <Slam text="PALPANDO LUMBARES" at={s1.start} size={80} color={COLORS.cyan} glow />
        </div>
        {/* Fase 2: el dato fuerte */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {frame >= hit ? <Slam text="MÁS DE LA MITAD" at={hit} size={128} color={COLORS.white} /> : null}
          {frame >= hit2 ? <Slam text="FALLÓ" at={hit2} size={260} color={COLORS.orange} glow spacing={-6} /> : null}
          {frame >= hit2 ? (
            <div style={{ fontWeight: 700, fontSize: 44, color: COLORS.muted, marginTop: 20, opacity: interpolate(frame, [hit2 + 10, hit2 + 18], [0, 1], CLAMP) }}>
              de vértebra
            </div>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
