import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { KneeLeg } from "../Pictos";

/** Qué hacer: isométrico con la rodilla doblada (rulo) y vigilar el derrame. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const iso = wordAt(s0, "isométrico");
  const dob = wordAt(s0, "doblada");
  const der = wordAt(s1, "derrame");
  const pesa = wordAt(s1, "pesa");
  const flex = interpolate(frame, [dob - 4, dob + 14], [0, 40], { ...CLAMP });
  return (
    <Punch dur={c.dur} shakeAt={[dob + 14, pesa]} amount={0.4}>
      <Stage gap={22} justify="flex-start">
        <div style={{ marginTop: 4 }}>
          <Slam text="MAÑANA EN CONSULTA" at={s0.start} size={62} color={COLORS.ink} />
        </div>
        <KneeLeg at={iso} width={820} flex={flex} roll={frame >= dob} quad={frame >= dob + 14 ? 1 : 0.5} press={frame >= dob + 14 ? 0.6 + 0.4 * Math.sin(frame / 3) : 0} label={frame >= dob ? "≈ 30-50°" : undefined} labelColor={COLORS.green} />
        {frame >= der ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 30px", borderRadius: 999, backgroundColor: COLORS.paper, border: `3px solid ${COLORS.cyan}`, boxShadow: STICKER_SM, scale: String(pop(frame, der)) }}>
            <svg width={60} height={70} viewBox="0 0 60 70">
              <path d="M30 4 C 44 26 54 38 54 48 A24 24 0 0 1 6 48 C 6 38 16 26 30 4 Z" fill={COLORS.cyan} />
            </svg>
            <span style={{ fontWeight: 900, fontSize: 42, color: COLORS.ink }}>
              vigila el derrame <span style={{ color: COLORS.orange, opacity: frame >= pesa ? 1 : 0 }}>· más líquido, más pesa el ángulo</span>
            </span>
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
