import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";

/** Matiz: muchos de esos estudios son de los ochenta y noventa (años reales de las referencias citadas). */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const ojo = Math.max(0, s0.start - 2);
  const est = wordAt(s0, "estudios");
  const och = wordAt(s0, "ochenta");
  const nov = wordAt(s0, "noventa");
  return (
    <Punch dur={c.dur} shakeAt={[nov]} amount={0.5}>
      <Stage gap={36} justify="flex-start">
        <div style={{ marginTop: 20 }}>
          <Slam text="OJO" at={ojo} size={120} color={COLORS.red} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 36, letterSpacing: 4, color: COLORS.muted, opacity: frame >= est ? 1 : 0 }}>AÑOS DE LOS ESTUDIOS CITADOS</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, width: 820 }}>
          {DATA.years.map((y, i) => {
            const at = i < 2 ? och + i * 4 : nov + (i - 2) * 4;
            return (
              <div key={y} style={{ padding: "22px 40px", borderRadius: 22, backgroundColor: COLORS.paper, border: `3px solid ${i < 2 ? COLORS.orange : COLORS.cyan}`, boxShadow: STICKER_SM, fontWeight: 900, fontSize: 64, color: COLORS.ink, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), rotate: `${i % 2 ? 3 : -3}deg` }}>{y}</div>
            );
          })}
        </div>
        <div style={{ fontWeight: 800, fontSize: 32, color: COLORS.muted, opacity: frame >= nov + 12 ? 1 : 0 }}>revisión narrativa de 2010</div>
      </Stage>
    </Punch>
  );
};
