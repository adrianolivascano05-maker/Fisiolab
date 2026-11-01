import { interpolate, useCurrentFrame } from "remotion";
import { Option, centerX } from "../../../components/Engage";
import { Finger } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { LAYOUT } from "../../../theme";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { KempFigure } from "../Pictos";

/** Quiz: ¿confirma o descarta? El dedo pulsa «CONFIRMA». */
export const Quiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const kemp = wordAt(s0, "kemp") - 4;
  const q = wordAt(s0, "confirma") - 2;
  const opts = wordAt(s0, "confirma");
  const tap = wordEnd(s0, "descarta") + 4;
  const fy = interpolate(frame, [opts + 12, opts + 20, Math.max(opts + 21, tap - 6)], [LAYOUT.headTop + 420, LAYOUT.headTop + 420, LAYOUT.headTop + 400], CLAMP);
  return (
    <Punch shakeAt={[q]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 0 }}>
          <KempFigure at={kemp} size={200} pain={1} />
          <div style={{ fontWeight: 900, fontSize: 60, color: COLORS.orange, opacity: interpolate(frame, [kemp + 6, kemp + 12], [0, 1], CLAMP) }}>KEMP +</div>
        </div>
        <Slam text="¿CONFIRMA O DESCARTA?" at={q} size={78} color={COLORS.white} spacing={-2} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={opts + 6 + i * 5} pressAt={i === 0 ? tap : undefined} />
          ))}
        </div>
      </Stage>
      {frame >= opts + 12 ? <Finger x={centerX(560) + 330} y={fy} at={opts + 12} tapAt={tap} /> : null}
    </Punch>
  );
};
