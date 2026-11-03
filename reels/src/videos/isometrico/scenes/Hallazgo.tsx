import { useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { BrakeBar } from "../Pictos";

/** Hallazgo: tras una meniscectomía, incluso sin derrame detectable, el freno estirada puede ser más del doble que a 30-40°. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const men = wordAt(s0, "meniscectomía");
  const det = wordAt(s0, "detectable");
  const est = wordAt(s0, "estirada");
  const dob = wordAt(s0, "doble");
  const tre = wordAt(s0, "treinta");
  return (
    <Punch dur={c.dur} shakeAt={[dob]} amount={0.5}>
      <Stage gap={24} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 1 ? tre : undefined} wrongAt={i === 0 ? dob : undefined} color={i === 1 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: frame >= men ? 1 : 0, scale: String(pop(frame, men)) }}>
          <div style={{ fontWeight: 900, fontSize: 54, color: COLORS.ink }}>primeros días tras <span style={{ color: COLORS.orange }}>meniscectomía</span></div>
          <div style={{ fontWeight: 800, fontSize: 36, color: COLORS.muted, opacity: frame >= det ? 1 : 0 }}>incluso sin derrame detectable</div>
        </div>
        <div style={{ display: "flex", gap: 60, alignItems: "flex-end" }}>
          <BrakeBar at={est} value={0.92} label="0° · estirada" color={COLORS.red} />
          <BrakeBar at={tre} value={0.4} label="30-40°" color={COLORS.green} />
        </div>
        <div style={{ height: 100, display: "flex", alignItems: "center" }}>{frame >= dob ? <Slam text="MÁS DEL DOBLE DE FRENO" at={dob} size={64} color={COLORS.red} /> : null}</div>
      </Stage>
    </Punch>
  );
};
