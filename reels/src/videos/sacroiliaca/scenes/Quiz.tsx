import { interpolate, useCurrentFrame } from "remotion";
import { Option, centerX } from "../../../components/Engage";
import { Finger } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { LAYOUT } from "../../../theme";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";

/** Quiz: ¿qué mide ese 91 %? El dedo pulsa la trampa: SENSIBILIDAD. */
export const Quiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const q = wordAt(s0, "qué");
  const opts = wordAt(s0, "mide");
  const tap = wordEnd(s0, "uno") + 4;
  const fy = interpolate(frame, [opts + 10, opts + 18, Math.max(opts + 19, tap - 6)], [LAYOUT.headTop + 420, LAYOUT.headTop + 420, LAYOUT.headTop + 290], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[q]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 30 }}>
          <Slam text="¿QUÉ MIDE ESE 91 %?" at={q} size={86} color={COLORS.ink} spacing={-2} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 20 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={opts + i * 5} pressAt={i === 0 ? tap : undefined} />
          ))}
        </div>
      </Stage>
      {frame >= opts + 10 ? <Finger x={centerX(560) + 360} y={fy} at={opts + 10} tapAt={tap} /> : null}
    </Punch>
  );
};
