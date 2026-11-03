import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { KneeLeg } from "../Pictos";

/** Prueba: revisión narrativa de 2010 → tras una lesión, la rodilla frena el cuádriceps por reflejo. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rev = wordAt(s0, "revisión");
  const nar = wordAt(s0, "narrativa");
  const fre = wordAt(s1, "frena");
  const ref = wordAt(s1, "reflejo");
  return (
    <Punch dur={c.dur} shakeAt={[fre]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ width: 860, padding: "26px 38px", borderRadius: 30, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.cyan}`, boxShadow: STICKER, marginTop: 4, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.muted }}>
              REVISIÓN <span style={{ color: COLORS.orange, opacity: frame >= nar ? 1 : 0 }}>NARRATIVA</span>
            </span>
            <span style={{ fontWeight: 900, fontSize: 66, color: COLORS.cyan }}>2010</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 36, color: COLORS.ink }}>Semin Arthritis Rheum · Rice y McNair</div>
        </div>
        <KneeLeg at={s1.start} width={760} flex={10} quad={0.8} brake={interpolate(frame, [fre, fre + 8], [0, 1], CLAMP)} />
        <div style={{ height: 100, display: "flex", alignItems: "center" }}>{frame >= ref ? <Slam text="FRENO REFLEJO" at={ref} size={78} color={COLORS.red} /> : null}</div>
      </Stage>
    </Punch>
  );
};
