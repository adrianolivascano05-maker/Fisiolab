import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";

/** Matiz: no se sabe si es adaptación o el comienzo de un problema (bifurcación con interrogante). */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const ojo = Math.max(0, s0.start - 2);
  const sabe = wordAt(s0, "sabe");
  const adap = wordAt(s0, "adaptación");
  const prob = wordAt(s0, "problema");
  const sign = (text: string, at: number, color: string, rot: number) => (
    <div style={{ padding: "26px 40px", borderRadius: 24, backgroundColor: COLORS.paper, border: `3px solid ${color}`, boxShadow: STICKER, fontWeight: 900, fontSize: 52, color, rotate: `${rot}deg`, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>{text}</div>
  );
  return (
    <Punch dur={c.dur} shakeAt={[prob]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="OJO: NO SE SABE" at={ojo} size={84} color={COLORS.red} />
        </div>
        <svg width={700} height={220} viewBox="0 0 700 220" style={{ opacity: frame >= sabe ? 1 : 0 }}>
          <path d="M350 210 V120 L130 30 M350 120 L570 30" stroke={COLORS.ink} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={350} cy={150} r={44} fill={COLORS.orange} />
          <text x={350} y={168} textAnchor="middle" fontSize={56} fontWeight={900} fill={COLORS.paper}>?</text>
        </svg>
        <div style={{ display: "flex", gap: 40, marginTop: -30 }}>
          {sign("¿ADAPTACIÓN?", adap, COLORS.green, -4)}
          {sign("¿PROBLEMA?", prob, COLORS.red, 4)}
        </div>
      </Stage>
    </Punch>
  );
};
