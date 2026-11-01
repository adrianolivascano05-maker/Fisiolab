import { interpolate, useCurrentFrame } from "remotion";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { RangeBar } from "../Pictos";

const fmt = (v: number) => (v === 1 ? "1" : v.toFixed(3).replace(".", ",").replace(/0+$/, ""));

/** Datos: dos barras de rango con una aguja que no se decide. */
export const Datos: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const sens = wordAt(s0, "sensibilidad");
  const sMin = wordAt(s0, "veintitrés");
  const sMax = wordAt(s0, "uno");
  const spec = wordAt(s1, "especificidad");
  const eMin = wordAt(s1, "dieciséis");
  const eMax = wordAt(s1, "seiscientos");
  return (
    <Punch shakeAt={[sMax, eMax + 10]} amount={0.7}>
      <Stage gap={40} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="TEST DE KEMP" at={0} size={64} color={COLORS.muted} weight={700} spacing={6} />
        </div>
        <RangeBar label="Sensibilidad" at={sens} min={DATA.sens.min} max={DATA.sens.max} minAt={sMin} maxAt={sMax} color={COLORS.orange} fmt={fmt} />
        <RangeBar label="Especificidad" at={spec} min={DATA.spec.min} max={DATA.spec.max} minAt={eMin} maxAt={eMax} color={COLORS.cyan} fmt={fmt} />
        <div style={{ fontWeight: 900, fontSize: 60, color: COLORS.white, textAlign: "center", lineHeight: 1.1, marginTop: 10, opacity: interpolate(frame, [eMax + 14, eMax + 22], [0, 1], CLAMP) }}>
          según el estudio: <span style={{ color: COLORS.red }}>casi cualquier valor</span>
        </div>
      </Stage>
    </Punch>
  );
};
