import { interpolate, useCurrentFrame } from "remotion";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { UCurve } from "../Pictos";

/** Datos: con derrame la presión dibuja una U (máxima en los extremos, mínima en el rango medio) y el freno sigue el mismo patrón. */
export const Datos: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const der = wordAt(s0, "derrame");
  const pres = wordAt(s0, "presión");
  const u = wordAt(s0, "u");
  const max = wordAt(s1, "máxima");
  const min = wordAt(s1, "mínima");
  const fre = wordAt(s2, "freno");
  const pat = wordAt(s2, "patrón");
  const draw = interpolate(frame, [pres, u + 10], [0, 1], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[u, pat]} amount={0.4}>
      <Stage gap={18} justify="flex-start">
        <div style={{ fontWeight: 900, fontSize: 56, color: COLORS.ink, marginTop: 4, opacity: frame >= der ? 1 : 0 }}>
          rodilla <span style={{ color: COLORS.cyan }}>con derrame</span>
        </div>
        <UCurve at={der} draw={draw} maxAt={max} minAt={min} band={interpolate(frame, [min, min + 8], [0, 1], CLAMP)} brake={interpolate(frame, [fre, fre + 10], [0, 1], CLAMP)} />
        <div style={{ height: 90, display: "flex", alignItems: "center" }}>
          {frame >= pat ? <Slam text="EL FRENO, IGUAL" at={pat} size={64} color={COLORS.red} /> : frame >= u ? <Slam text="UNA U" at={u} size={70} color={COLORS.orange} /> : null}
        </div>
      </Stage>
    </Punch>
  );
};
