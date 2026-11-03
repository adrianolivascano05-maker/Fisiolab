import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";

/** Matiz: es una asociación, no una causa. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const ojo = Math.max(0, s0.start - 2);
  const aso = wordAt(s0, "asociación");
  const cau = wordAt(s0, "causa");
  const pill = (text: string, at: number, color: string, rot: number) => (
    <div style={{ padding: "30px 44px", borderRadius: 26, backgroundColor: COLORS.paper, border: `4px solid ${color}`, boxShadow: STICKER, fontWeight: 900, fontSize: 60, color, rotate: `${rot}deg`, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>{text}</div>
  );
  return (
    <Punch dur={c.dur} shakeAt={[cau]} amount={0.5}>
      <Stage gap={40} justify="flex-start">
        <div style={{ marginTop: 30 }}>
          <Slam text="OJO" at={ojo} size={120} color={COLORS.red} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {pill("ASOCIACIÓN", aso, COLORS.green, -3)}
          <div style={{ fontWeight: 900, fontSize: 110, color: COLORS.ink, lineHeight: 1, opacity: frame >= cau ? 1 : 0, scale: String(pop(frame, cau)) }}>≠</div>
          {pill("CAUSA", cau, COLORS.red, 3)}
        </div>
      </Stage>
    </Punch>
  );
};
