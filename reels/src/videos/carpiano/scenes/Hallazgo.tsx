import { useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { Cross } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { LinkChips } from "../Pictos";

/** Hallazgo: una odds ratio solo dice que van juntas; no dice cuál llega antes ni cuál causa a cuál. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const solo = wordAt(s0, "solo");
  const juntas = wordAt(s0, "juntas");
  const antes = wordAt(s1, "antes");
  const causa = wordAt(s1, "causa");
  return (
    <Punch dur={c.dur} shakeAt={[juntas, causa]} amount={0.5}>
      <Stage gap={34} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 2 ? antes : undefined} wrongAt={i === 0 ? solo : i === 1 ? solo + 4 : undefined} color={i === 2 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.ink, opacity: frame >= solo ? 1 : 0, scale: String(pop(frame, solo)), textAlign: "center", lineHeight: 1.1 }}>
          una odds ratio <span style={{ color: COLORS.orange }}>solo</span> dice
        </div>
        <LinkChips at={solo} linkAt={juntas} arrowAt={antes} causeAt={causa} />
        <div style={{ position: "relative", height: 130, display: "flex", alignItems: "center", gap: 30 }}>
          {frame >= causa ? (
            <>
              <Slam text="NI CUÁL CAUSA" at={causa} size={66} color={COLORS.red} />
              <Cross size={110} start={causa + 4} />
            </>
          ) : frame >= antes ? (
            <Slam text="¿CUÁL LLEGA ANTES?" at={antes} size={66} color={COLORS.orange} />
          ) : frame >= juntas ? (
            <Slam text="QUE VAN JUNTAS" at={juntas} size={72} color={COLORS.ink} />
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
