import { useCurrentFrame } from "remotion";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { RangeBar } from "../../kemp/Pictos";
import { DATA } from "../config";
import { Crowd } from "../Pictos";

const fmt = (v: number) => (v === 1 ? "1" : v.toFixed(2).replace(".", ","));

/** Datos del Lasègue: sensibilidad alta (casi todos los que tienen el problema dan +) y especificidad que baja a 0,10 (+ en mucha gente sin el problema). */
export const Datos: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2, s3] = c.s;
  const sens = wordAt(s0, "sensibilidad");
  const sMax = wordAt(s0, "cero");
  const todos = wordAt(s1, "todos");
  const posit = wordAt(s1, "positivo");
  const spec = wordAt(s2, "especificidad");
  const eMin = wordAt(s2, "cero");
  const mucha = wordAt(s3, "mucha");
  const sin = wordAt(s3, "sin");
  return (
    <Punch dur={c.dur} shakeAt={[sMax, eMin]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: 8, color: COLORS.muted, marginTop: 4 }}>LASÈGUE</div>
        <RangeBar label="Sensibilidad" at={sens} min={DATA.slr.sens.min} max={DATA.slr.sens.max} minAt={sMax - 6} maxAt={sMax} color={COLORS.orange} fmt={fmt} width={880} />
        {frame >= todos ? <Crowd n={10} positives={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]} at={todos} markAt={posit} plusColor={COLORS.orange} label="con el problema" size={78} /> : null}
        {frame >= spec ? <RangeBar label="Especificidad" at={spec} min={DATA.slr.spec.min} max={DATA.slr.spec.max} minAt={eMin} maxAt={eMin + 12} color={COLORS.cyan} fmt={fmt} width={880} /> : null}
        {frame >= mucha ? <Crowd n={10} positives={[0, 2, 3, 5, 7, 8]} at={mucha} markAt={sin} plusColor={COLORS.red} label="sin el problema" size={78} /> : null}
      </Stage>
    </Punch>
  );
};
