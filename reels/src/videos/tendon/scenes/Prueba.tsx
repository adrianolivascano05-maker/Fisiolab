import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Horse, OvalBall } from "../Pictos";

/** Prueba: revisión de 2016 de los creadores del modelo continuo, con futbolistas australianos y caballos de carreras. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rev = wordAt(s0, "revisión");
  const cont = wordAt(s0, "continuo");
  const fut = wordAt(s1, "fútbol");
  const cab = wordAt(s1, "caballos");
  const card = (at: number, children: React.ReactNode, label: string) => (
    <div style={{ width: 400, height: 330, borderRadius: 30, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      {children}
      <div style={{ fontWeight: 900, fontSize: 36, color: COLORS.ink, textAlign: "center", lineHeight: 1.1, whiteSpace: "pre-line" }}>{label}</div>
    </div>
  );
  return (
    <Punch dur={c.dur} shakeAt={[cab]} amount={0.5}>
      <Stage gap={34} justify="flex-start">
        <div style={{ width: 860, padding: "30px 40px", borderRadius: 30, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.cyan}`, boxShadow: STICKER, marginTop: 6, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.muted }}>REVISIÓN</span>
            <span style={{ fontWeight: 900, fontSize: 70, color: COLORS.cyan }}>2016</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 38, color: COLORS.ink }}>Br J Sports Med · Cook et al.</div>
          <div style={{ fontWeight: 800, fontSize: 32, color: COLORS.orange, marginTop: 8, opacity: frame >= cont ? 1 : 0 }}>los creadores del modelo continuo</div>
        </div>
        <div style={{ display: "flex", gap: 40 }}>
          {card(fut, <OvalBall at={fut} size={170} />, "futbolistas\naustralianos")}
          {card(cab, <Horse at={cab} size={190} />, "caballos\nde carreras")}
        </div>
      </Stage>
    </Punch>
  );
};
