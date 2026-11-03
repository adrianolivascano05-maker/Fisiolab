import { interpolate, useCurrentFrame } from "remotion";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { OvalBall, TendonScan, WeekStrip } from "../Pictos";

/** Gancho: partido el domingo → el martes la ecografía sale distinta → ¿se está lesionando? */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const partido = Math.max(0, s0.start - 4);
  const domingo = wordAt(s0, "domingo");
  const martes = wordAt(s1, "martes");
  const distinto = wordAt(s1, "distinto");
  const les = wordAt(s2, "lesionando");
  const swell = interpolate(frame, [distinto - 4, distinto + 10], [0, 1], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[distinto, les]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 6 }}>
          <OvalBall at={partido} size={120} />
          <WeekStrip at={partido} marks={[{ day: 6, at: domingo, color: COLORS.ink, text: "partido" }, { day: 1, at: martes, color: COLORS.orange, text: "eco" }]} />
        </div>
        <TendonScan at={martes} width={760} swell={swell} label={frame >= distinto ? "MARTES" : undefined} labelColor={COLORS.orange} />
        <div style={{ height: 120, display: "flex", alignItems: "center" }}>
          {frame >= les ? <Slam text="¿SE ESTÁ LESIONANDO?" at={les} size={80} color={COLORS.red} /> : frame >= martes ? <Slam text="SALE DISTINTO" at={distinto} size={76} color={COLORS.ink} /> : null}
        </div>
      </Stage>
    </Punch>
  );
};
