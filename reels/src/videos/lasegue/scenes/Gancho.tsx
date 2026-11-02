import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { LegRaise, PainLeg } from "../Pictos";

/** Gancho: dolor que baja por la pierna → Lasègue positivo → ¿confirma o descarta? */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const dolor = Math.max(0, s0.start - 4);
  const pierna = wordAt(s0, "pierna");
  const las = wordAt(s1, "lasègue");
  const pos = wordAt(s1, "positivo");
  const conf = wordAt(s2, "confirma");
  const desc = wordAt(s2, "descarta");
  const btn = (text: string, at: number, color: string) => (
    <div style={{ padding: "24px 40px", borderRadius: 26, backgroundColor: COLORS.paper, border: `3px solid ${color}`, boxShadow: STICKER_SM, fontWeight: 900, fontSize: 64, color, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>{text}</div>
  );
  return (
    <Punch dur={c.dur} shakeAt={[pos, desc]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 450, marginTop: 10 }}>
          <PainLeg at={dolor} size={430} painAt={pierna} />
          {frame >= las ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 50 }}>
              <LegRaise at={las} size={580} mode="slr" painAt={pos} label={false} />
            </div>
          ) : null}
        </div>
        <div style={{ height: 120, display: "flex", alignItems: "center" }}>
          {frame < las ? (
            <Slam text="DOLOR POR LA PIERNA" at={dolor} size={78} color={COLORS.ink} />
          ) : frame < conf ? (
            <Slam text={frame >= pos ? "LASÈGUE POSITIVO" : "LASÈGUE"} at={frame >= pos ? pos : las} size={84} color={frame >= pos ? COLORS.orange : COLORS.ink} />
          ) : (
            <div style={{ display: "flex", gap: 30 }}>
              {btn("¿CONFIRMA?", conf, COLORS.green)}
              {btn("¿DESCARTA?", desc, COLORS.cyan)}
            </div>
          )}
        </div>
      </Stage>
    </Punch>
  );
};
