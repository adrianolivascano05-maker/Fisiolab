import { useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { Check } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { LegRaise, RuleCard } from "../Pictos";

/** Hallazgo: Lasègue negativo → la tensión de la raíz se vuelve poco probable. Regla: muy sensible + negativo = descarta. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const raiz = wordAt(s0, "raíz");
  const poco = wordAt(s0, "poco");
  const sens = wordAt(s1, "sensible");
  const neg = wordAt(s1, "negativo");
  const desc = wordAt(s1, "descarta");
  return (
    <Punch dur={c.dur} shakeAt={[poco, desc]} amount={0.6}>
      <Stage gap={22} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 1 ? poco : undefined} wrongAt={i === 0 ? raiz : undefined} color={i === 1 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <LegRaise at={0} size={330} mode="slr" label={false} />
          {frame >= poco ? <Check size={130} start={poco} /> : null}
        </div>
        <div style={{ textAlign: "center", opacity: frame >= raiz ? 1 : 0, scale: String(pop(frame, raiz)) }}>
          <div style={{ fontWeight: 800, fontSize: 44, color: COLORS.muted }}>tensión de la raíz</div>
          <div style={{ fontWeight: 900, fontSize: 84, color: COLORS.green, lineHeight: 1, opacity: frame >= poco ? 1 : 0 }}>POCO PROBABLE</div>
        </div>
        <RuleCard at={sens} quality="MUY SENSIBLE" result="NEGATIVO" verdict="DESCARTA" color={COLORS.green} stepAt={[sens, neg, desc]} />
        <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, opacity: frame >= desc + 10 ? 1 : 0 }}>regla clásica de interpretación (no es una frase de la revisión)</div>
      </Stage>
    </Punch>
  );
};
