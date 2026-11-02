import { interpolate, useCurrentFrame } from "remotion";
import { Option, centerX } from "../../../components/Engage";
import { Finger } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { LAYOUT } from "../../../theme";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { LegRaise } from "../Pictos";

/** Quiz: un Lasègue NEGATIVO, ¿qué te dice? El dedo duda y pulsa CONFIRMA (la respuesta de la revisión). */
export const Quiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const las = Math.max(0, wordAt(s0, "lasègue") - 4);
  const neg = wordAt(s0, "negativo");
  const q = wordAt(s0, "qué");
  const tap = wordEnd(s0, "dice") + 4;
  const fy = interpolate(frame, [q + 6, q + 14, Math.max(q + 15, tap - 6)], [LAYOUT.headTop + 560, LAYOUT.headTop + 560, LAYOUT.headTop + 500], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[neg]} amount={0.5}>
      <Stage gap={24} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 4 }}>
          <LegRaise at={las} size={300} mode="slr" label={false} />
          <div style={{ fontWeight: 900, fontSize: 58, color: COLORS.cyan, opacity: frame >= neg ? 1 : 0 }}>NEGATIVO</div>
        </div>
        <Slam text="¿QUÉ TE DICE?" at={q} size={84} color={COLORS.ink} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={q + 4 + i * 4} pressAt={i === 0 ? tap : undefined} />
          ))}
        </div>
      </Stage>
      {frame >= q + 6 ? <Finger x={centerX(560) + 330} y={fy} at={q + 6} tapAt={tap} /> : null}
    </Punch>
  );
};
