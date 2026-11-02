import { useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { Loop } from "../Pictos";

/** Hallazgo: el 91,4 % es % de positivos entre ya diagnosticados… con esos mismos tests (bucle). */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const cuantos = wordAt(s0, "cuántos");
  const posit = wordAt(s0, "positivo");
  const pac = wordAt(s1, "pacientes");
  const mismos = wordAt(s1, "mismos");
  return (
    <Punch dur={c.dur} shakeAt={[posit, mismos]} amount={0.7}>
      <Stage gap={12} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 1 ? posit : undefined} wrongAt={i === 0 ? cuantos : undefined} color={i === 1 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ textAlign: "center", opacity: frame >= cuantos ? 1 : 0, scale: String(pop(frame, cuantos)) }}>
          <div style={{ fontWeight: 900, fontSize: 124, color: COLORS.orange, lineHeight: 1, letterSpacing: -5 }}>91,4 %</div>
          <div style={{ fontWeight: 900, fontSize: 56, color: COLORS.ink, marginTop: 6 }}>
            de <span style={{ color: COLORS.green }}>POSITIVOS</span>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 38, color: COLORS.muted, opacity: frame >= posit ? 1 : 0, scale: String(pop(frame, posit + 6)) }}>entre los que ya tenían el diagnóstico</div>
        {frame >= pac ? (
          <div style={{ marginTop: 6 }}>
            <Loop at={pac} size={390} labelAt={mismos} />
          </div>
        ) : null}
        
      </Stage>
    </Punch>
  );
};
