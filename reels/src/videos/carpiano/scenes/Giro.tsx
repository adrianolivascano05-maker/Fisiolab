import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Magnifier } from "../../sacroiliaca/Pictos";
import { UpStat } from "../Pictos";

/** Giro: dato de la revisión (más uso sanitario y más cirugías) y, separado y marcado, una hipótesis que no es de la revisión. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const dato = wordAt(s0, "dato");
  const san = wordAt(s0, "sanitario");
  const ope = wordAt(s0, "operaban");
  const pos = wordAt(s1, "posible");
  const rev = wordAt(s1, "revisión");
  const cons = wordAt(s1, "consultas");
  const diag = wordAt(s1, "diagnósticos");
  const hyp = frame >= pos;
  return (
    <Punch dur={c.dur} shakeAt={[ope, diag]} amount={0.4}>
      <Stage gap={26} justify="flex-start">
        <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: 5, color: COLORS.muted, marginTop: 4, opacity: frame >= dato ? 1 : 0 }}>
          OTRO DATO <span style={{ color: COLORS.cyan }}>· DE LA REVISIÓN</span>
        </div>
        <div style={{ display: "flex", gap: 30, scale: hyp ? "0.8" : "1", transformOrigin: "top center", height: hyp ? 250 : 320 }}>
          <UpStat at={san} kind="hospital" label={"más uso\nsanitario"} />
          <UpStat at={ope} kind="cirugia" label={"más\ncirugías"} />
        </div>
        {hyp ? (
          <div style={{ position: "relative", width: 880, padding: "26px 34px 30px", borderRadius: 28, backgroundColor: COLORS.paper, border: `4px dashed ${COLORS.red}`, boxShadow: STICKER, scale: String(pop(frame, pos)) }}>
            <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: 4, color: COLORS.red }}>
              HIPÓTESIS <span style={{ opacity: frame >= rev ? 1 : 0 }}>· NO LA DA LA REVISIÓN</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, fontWeight: 900, fontSize: 52, color: COLORS.ink }}>
              <span style={{ opacity: frame >= cons ? 1 : 0.15 }}>+ consultas</span>
              <span style={{ color: COLORS.muted, opacity: frame >= diag ? 1 : 0.15 }}>→</span>
              <span style={{ color: COLORS.orange, opacity: frame >= diag ? 1 : 0.15 }}>+ diagnósticos</span>
            </div>
            <Magnifier at={diag} size={150} x={700} y={-70} />
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
