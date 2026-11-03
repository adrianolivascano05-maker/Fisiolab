import { interpolate, useCurrentFrame } from "remotion";
import { Option, centerX } from "../../../components/Engage";
import { Finger } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { LAYOUT } from "../../../theme";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";

/** Quiz: ¿qué ha cambiado en esos 2 días? El dedo pulsa la creencia típica: «se ha roto». */
export const Quiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const q = Math.max(0, wordAt(s0, "qué") - 2);
  const opts = wordAt(s0, "cambiado");
  const tap = wordEnd(s0, "días") + 4;
  const fy = interpolate(frame, [opts + 8, opts + 16, Math.max(opts + 17, tap - 6)], [LAYOUT.headTop + 420, LAYOUT.headTop + 420, LAYOUT.headTop + 260], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[q]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 30 }}>
          <Slam text="¿QUÉ HA CAMBIADO?" at={q} size={88} color={COLORS.ink} spacing={-2} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 20 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={opts + i * 4} pressAt={i === 0 ? tap : undefined} />
          ))}
        </div>
      </Stage>
      {frame >= opts + 8 ? <Finger x={centerX(560) + 340} y={fy} at={opts + 8} tapAt={tap} /> : null}
    </Punch>
  );
};
