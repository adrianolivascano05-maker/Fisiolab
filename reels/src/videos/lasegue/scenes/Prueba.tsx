import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";

/** Prueba: la revisión responde «confirma»… pero sus propios números dicen lo contrario. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rev = wordAt(s0, "revisión");
  const conf = wordAt(s0, "confirma");
  const prop = wordAt(s1, "propios");
  const num = wordAt(s1, "números");
  const contra = wordAt(s1, "contrario");
  const flip = interpolate(frame, [contra, contra + 10], [0, 1], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[conf, contra]} amount={0.6}>
      <Stage gap={34} justify="flex-start">
        <div style={{ position: "relative", width: 760, padding: "34px 40px", borderRadius: 30, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.cyan}`, boxShadow: STICKER, marginTop: 10, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.muted }}>REVISIÓN</span>
            <span style={{ fontWeight: 900, fontSize: 64, color: COLORS.cyan }}>2024</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 40, color: COLORS.ink, marginTop: 10 }}>«Lasègue positivo…»</div>
          {frame >= conf ? (
            <div style={{ position: "absolute", right: -30, bottom: -40, padding: "14px 28px", borderRadius: 16, border: `5px solid ${COLORS.green}`, color: COLORS.green, backgroundColor: COLORS.paper, fontWeight: 900, fontSize: 60, rotate: "-8deg", scale: String(interpolate(frame, [conf, conf + 8], [2.2, 1], CLAMP)), opacity: 1 - flip * 0.6 }}>
              CONFIRMA
              <div style={{ position: "absolute", left: "-6%", right: "-6%", top: "50%", height: 10, marginTop: -5, borderRadius: 5, backgroundColor: COLORS.red, transformOrigin: "left center", scale: `${flip} 1` }} />
            </div>
          ) : null}
        </div>
        {/* Sus propios números */}
        <div style={{ display: "flex", gap: 24, marginTop: 50, opacity: frame >= prop ? 1 : 0 }}>
          {[
            { t: "sensibilidad", v: `hasta ${DATA.slr.sens.max.toString().replace(".", ",")}`, col: COLORS.orange },
            { t: "especificidad", v: `desde ${DATA.slr.spec.min.toFixed(2).replace(".", ",")}`, col: COLORS.cyan },
          ].map((x, i) => (
            <div key={x.t} style={{ width: 360, padding: "22px 0", borderRadius: 24, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, textAlign: "center", scale: String(pop(frame, num + i * 4)), opacity: frame >= num + i * 4 ? 1 : 0 }}>
              <div style={{ fontWeight: 800, fontSize: 32, color: COLORS.muted }}>{x.t}</div>
              <div style={{ fontWeight: 900, fontSize: 64, color: x.col }}>{x.v}</div>
            </div>
          ))}
        </div>
        {frame >= contra ? <Slam text="DICEN LO CONTRARIO" at={contra} size={70} color={COLORS.red} /> : null}
      </Stage>
    </Punch>
  );
};
