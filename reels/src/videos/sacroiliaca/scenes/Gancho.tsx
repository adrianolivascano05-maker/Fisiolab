import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Pelvis } from "../../kemp/Pictos";
import { Leg4 } from "../Pictos";

/** Gancho: el caso clínico. Dolor en la nalga → test del 4 positivo → «¿ya es la sacroilíaca?». */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const dolor = Math.max(0, s0.start - 4);
  const nalga = wordAt(s0, "nalga");
  const test = wordAt(s1, "test");
  const pos = wordAt(s1, "positivo");
  const sacro = wordAt(s2, "sacroilíaca");
  const press = frame >= pos ? Math.min(1, (frame - pos) / 6) : 0;
  return (
    <Punch dur={c.dur} shakeAt={[pos, sacro]} amount={0.7}>
      <Stage gap={30} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 40, height: 380, marginTop: 20 }}>
          {/* Pelvis con dolor en la nalga */}
          <div style={{ position: "relative", width: 330, height: 330, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= dolor ? 1 : 0 }}>
            {frame >= nalga ? <div style={{ position: "absolute", left: 30, top: 140, width: 150, height: 150, borderRadius: "50%", backgroundColor: COLORS.red, opacity: 0.22 + 0.12 * Math.sin((frame - nalga) / 3), filter: "blur(14px)" }} /> : null}
            <Pelvis at={dolor} size={320} color={COLORS.red} />
          </div>
          {/* Test del 4 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: frame >= test ? 1 : 0 }}>
            <Leg4 at={test} size={380} press={press} />
            {frame >= pos ? (
              <div style={{ fontWeight: 900, fontSize: 44, color: COLORS.paper, backgroundColor: COLORS.orange, padding: "10px 26px", borderRadius: 999, boxShadow: STICKER_SM, scale: String(pop(frame, pos)) }}>FABER +</div>
            ) : null}
          </div>
        </div>
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {frame < sacro ? (
            <div style={{ fontWeight: 900, fontSize: 84, color: COLORS.ink, textAlign: "center", lineHeight: 1.05, opacity: interpolate(frame, [dolor, dolor + 6], [0, 1], CLAMP) }}>
              {frame >= test ? (
                <>
                  TEST DEL 4 <span style={{ color: frame >= pos ? COLORS.orange : COLORS.ink }}>{frame >= pos ? "POSITIVO" : ""}</span>
                </>
              ) : (
                "DOLOR EN LA NALGA"
              )}
            </div>
          ) : (
            <Slam text="¿YA ES LA SACROILÍACA?" at={sacro} size={86} color={COLORS.ink} spacing={-2} />
          )}
        </div>
      </Stage>
    </Punch>
  );
};
