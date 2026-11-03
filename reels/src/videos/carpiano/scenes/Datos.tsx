import { useCurrentFrame } from "remotion";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { OrBars } from "../Pictos";

/** Datos: odds ratio del túnel carpiano (2,98, casi el triple) y, una a una, las demás condiciones de la mano. */
export const Datos: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const odds = wordAt(s0, "odds");
  const dos = wordAt(s0, "dos");
  const triple = wordAt(s1, "triple");
  const at: Record<string, number> = {
    "Túnel carpiano": dos,
    "Dedo en resorte": wordAt(s2, "resorte"),
    "De Quervain": wordAt(s2, "quervain"),
    Tendinitis: wordAt(s2, "tendinitis"),
    "Artrosis de mano": wordAt(s2, "artrosis"),
  };
  const order = ["Túnel carpiano", "Dedo en resorte", "De Quervain", "Tendinitis", "Artrosis de mano"];
  const rows = order.map((l) => ({ label: l, v: DATA.ors.find((o) => o.label === l)!.v, at: at[l], color: l === "Túnel carpiano" ? COLORS.orange : COLORS.cyan }));
  return (
    <Punch dur={c.dur} shakeAt={[dos + 16, triple]} amount={0.4}>
      <Stage gap={26} justify="flex-start">
        <div style={{ fontWeight: 900, fontSize: 58, color: COLORS.ink, marginTop: 4, opacity: frame >= s0.start ? 1 : 0 }}>
          ODDS RATIO <span style={{ color: COLORS.muted, fontSize: 36, fontWeight: 800, opacity: frame >= odds ? 1 : 0 }}>· con fibromialgia</span>
        </div>
        <OrBars rows={rows} axisAt={s0.start} tripleAt={triple} />
        <div style={{ fontWeight: 800, fontSize: 30, color: COLORS.muted, opacity: frame >= at["Artrosis de mano"] + 10 ? 1 : 0 }}>todas P &lt; 0,001</div>
      </Stage>
    </Punch>
  );
};
