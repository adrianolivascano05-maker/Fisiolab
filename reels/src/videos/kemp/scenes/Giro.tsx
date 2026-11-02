import { interpolate, useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { Person, pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";

/** Giro: con esa especificidad, muchos positivos sin dolor facetario; con esa sensibilidad, el negativo tampoco descarta. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const esp = wordAt(s0, "especificidad");
  const posAt = wordAt(s0, "positivo");
  const gente = wordAt(s0, "gente");
  const sinAt = wordAt(s0, "sin");
  const confX = wordEnd(s0, "facetario") + 2;
  const sens = wordAt(s1, "sensibilidad");
  const neg = wordAt(s1, "negativo");
  const descX = wordAt(s1, "tampoco") + 2;
  const ning = wordEnd(s1, "tranquilo") + 2;
  const N = 10;
  const falsePos = [0, 2, 3, 5, 6, 8]; // positivos sin dolor facetario (ilustrativo, no es un dato del estudio)
  return (
    <Punch shakeAt={[confX, descX, ning]} amount={0.7}>
      <Stage gap={22} justify="flex-start">
        <div style={{ display: "flex", gap: 12, marginTop: 4, scale: String(0.58), transformOrigin: "top center", height: 70 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : undefined} wrongAt={i === 0 ? confX : i === 1 ? descX : undefined} color={i === 2 && frame >= ning ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <Slam text="CON ESA ESPECIFICIDAD" at={esp} size={60} color={COLORS.cyan} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", width: 900, opacity: frame >= gente - 6 ? 1 : 0 }}>
          {new Array(N).fill(0).map((_, i) => {
            const fp = falsePos.includes(i) && frame >= posAt + i * 2;
            return (
              <div key={i} style={{ position: "relative" }}>
                <Person at={Math.min(gente, posAt)} delay={i * 2} size={88} color={fp ? COLORS.red : "rgba(255,255,255,0.8)"} />
                {fp ? <div style={{ position: "absolute", right: -6, top: -6, width: 34, height: 34, borderRadius: "50%", backgroundColor: COLORS.red, color: COLORS.white, fontWeight: 900, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", scale: String(pop(frame, posAt + i * 2)) }}>+</div> : null}
              </div>
            );
          })}
        </div>
        <div style={{ fontWeight: 900, fontSize: 46, color: COLORS.red, opacity: interpolate(frame, [sinAt, sinAt + 6], [0, 1], CLAMP) }}>SIN DOLOR FACETARIO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 10, opacity: frame >= sens ? 1 : 0 }}>
          <Slam text="CON ESA SENSIBILIDAD" at={sens} size={54} color={COLORS.orange} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: frame >= neg ? 1 : 0 }}>
          <div style={{ position: "relative" }}>
            <Person at={neg} size={100} color={COLORS.white} />
            <div style={{ position: "absolute", right: -6, top: -6, width: 34, height: 34, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.25)", border: `3px solid ${COLORS.white}`, color: COLORS.white, fontWeight: 900, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>−</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 48, color: COLORS.white }}>
            negativo: <span style={{ color: COLORS.orange, opacity: frame >= descX ? 1 : 0 }}>tampoco descarta</span>
          </div>
        </div>
      </Stage>
    </Punch>
  );
};
