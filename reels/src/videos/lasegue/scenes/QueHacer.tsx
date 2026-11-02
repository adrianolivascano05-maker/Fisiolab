import { useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { LegRaise } from "../Pictos";

const Step: React.FC<{ at: number; doneAt: number; left: React.ReactNode; right: string; color: string }> = ({ at, doneAt, left, right, color }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, width: 920, padding: "26px 26px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${frame >= doneAt ? color : COLORS.line}`, boxShadow: STICKER, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ flexShrink: 0 }}>{left}</div>
      <div style={{ flex: 1, fontWeight: 900, fontSize: 48, color: COLORS.ink, lineHeight: 1.15 }}>{right}</div>
      <div style={{ flexShrink: 0, width: 80 }}>{frame >= doneAt ? <Check size={76} start={doneAt} color={color} /> : null}</div>
    </div>
  );
};

/** Qué hacer: Lasègue − → la raíz baja en la lista; Lasègue + → no pares, añade el cruzado. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const [s0, s1] = c.s;
  const neg = wordAt(s0, "negativo");
  const baja = wordAt(s0, "baja");
  const pos = wordAt(s1, "positivo");
  const cruz = wordAt(s1, "cruzado");
  return (
    <Punch dur={c.dur} shakeAt={[baja, cruz]} amount={0.4}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="MAÑANA EN CONSULTA" at={s0.start} size={64} color={COLORS.ink} />
        </div>
        <Step at={neg - 4} doneAt={baja} left={<LegRaise at={neg - 4} size={250} mode="slr" label={false} />} right="Lasègue − → la raíz baja en tu lista" color={COLORS.green} />
        <Step at={pos - 4} doneAt={cruz} left={<LegRaise at={pos - 4} size={250} mode="slr" painAt={pos} label={false} />} right="Lasègue + → no pares: añade el cruzado" color={COLORS.cyan} />
      </Stage>
    </Punch>
  );
};
