import { useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { Loop } from "../Pictos";

/** Hallazgo: el 91,4 % es cuántos dieron positivo… en un test que formaba parte de su propio diagnóstico. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const cuantos = wordAt(s0, "cuántos");
  const posit = wordAt(s0, "positivo");
  const formaba = wordAt(s0, "formaba");
  const diag = wordAt(s0, "diagnóstico");
  return (
    <Punch dur={c.dur} shakeAt={[posit, diag]} amount={0.7}>
      <Stage gap={14} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 1 ? posit : undefined} wrongAt={i === 0 ? cuantos : undefined} color={i === 1 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ textAlign: "center", opacity: frame >= cuantos ? 1 : 0, scale: String(pop(frame, cuantos)) }}>
          <div style={{ fontWeight: 900, fontSize: 124, color: COLORS.orange, lineHeight: 1, letterSpacing: -5 }}>91,4 %</div>
          <div style={{ fontWeight: 900, fontSize: 56, color: COLORS.ink, marginTop: 6, opacity: frame >= posit ? 1 : 0 }}>
            <span style={{ color: COLORS.green }}>DIERON POSITIVO</span>
          </div>
        </div>
        {frame >= formaba ? (
          <div style={{ marginTop: 8 }}>
            <Loop at={formaba} size={390} labelAt={diag} top="TEST DEL 4" bottom="DIAGNÓSTICO" label={"ERA PARTE\nDE LA REGLA"} />
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
