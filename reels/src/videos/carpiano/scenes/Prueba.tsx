import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { CaseControl } from "../Pictos";

/** Prueba: revisión narrativa de 2026 (grupo Nature) → estudio original de casos y controles con 9.232 personas con fibromialgia. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rev = wordAt(s0, "revisión");
  const nar = wordAt(s0, "narrativa");
  const nat = wordAt(s0, "nature");
  const casos = wordAt(s1, "casos");
  const ctrl = wordAt(s1, "controles");
  const nueve = wordAt(s1, "nueve");
  return (
    <Punch dur={c.dur} shakeAt={[casos]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ width: 860, padding: "26px 38px", borderRadius: 30, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.cyan}`, boxShadow: STICKER, marginTop: 4, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.muted }}>
              REVISIÓN <span style={{ color: COLORS.orange, opacity: frame >= nar ? 1 : 0 }}>NARRATIVA</span>
            </span>
            <span style={{ fontWeight: 900, fontSize: 66, color: COLORS.cyan }}>2026</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 36, color: COLORS.ink, opacity: frame >= nat ? 1 : 0.15 }}>Nat Rev Rheumatol · Fitzcharles et al.</div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: 4, color: COLORS.muted, opacity: frame >= s1.start ? 1 : 0 }}>
          ESTUDIO ORIGINAL · <span style={{ color: COLORS.ink }}>CASOS Y CONTROLES</span>
        </div>
        <CaseControl at={s1.start} casesAt={casos} controlsAt={ctrl} n={9232} nAt={nueve} />
      </Stage>
    </Punch>
  );
};
