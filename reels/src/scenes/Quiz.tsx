import { interpolate, useCurrentFrame } from "remotion";
import { Option, centerX } from "../components/Engage";
import { Finger } from "../components/Pictograms";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { LAYOUT } from "../theme";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Quiz: el espectador apuesta antes del dato. Un dedo duda y pulsa una opción. */
export const Quiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const q = wordAt(s0, "cuántos");
  const opts = wordAt(s0, "crees");
  const tap = wordAt(s0, "acertaron") + 6;
  const fy = interpolate(frame, [opts + 10, opts + 18, Math.max(opts + 19, tap - 6)], [LAYOUT.headTop + 190, LAYOUT.headTop + 190, LAYOUT.headTop + 330], CLAMP);
  return (
    <Punch shakeAt={[q]} amount={0.6}>
      <Stage gap={34} justify="flex-start">
        <div style={{ marginTop: 20 }}>
          <Slam text="¿CUÁNTOS ACERTARON?" at={q} size={84} color={COLORS.white} spacing={-2} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 10 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={opts + i * 5} pressAt={i === 1 ? tap : undefined} />
          ))}
        </div>
        <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: 4, color: COLORS.muted, opacity: interpolate(frame, [tap + 6, tap + 14], [0, 1], CLAMP) }}>
          ¿Y TÚ? COMÉNTALO
        </div>
      </Stage>
      {frame >= opts + 10 ? <Finger x={centerX(560) + 330} y={fy} at={opts + 10} tapAt={tap} /> : null}
    </Punch>
  );
};
