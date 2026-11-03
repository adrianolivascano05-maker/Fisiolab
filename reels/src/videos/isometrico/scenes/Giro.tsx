import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Goniometer } from "../Pictos";

/** Giro: la recomendación de los autores (fase aguda, 30-50°), donde la presión es mínima. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rec = wordAt(s0, "recomiendan");
  const agu = wordAt(s0, "aguda");
  const t30 = wordAt(s0, "treinta");
  const min = wordAt(s1, "mínima");
  const angle = interpolate(frame, [rec, t30, t30 + 20], [0, 0, 40], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[t30 + 20, min]} amount={0.4}>
      <Stage gap={24} justify="flex-start">
        <div style={{ width: 860, padding: "22px 34px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.green}`, boxShadow: STICKER, marginTop: 4, opacity: frame >= rec ? 1 : 0, scale: String(pop(frame, rec)) }}>
          <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: 4, color: COLORS.muted }}>
            RECOMIENDAN LOS AUTORES · <span style={{ color: COLORS.orange, opacity: frame >= agu ? 1 : 0 }}>FASE AGUDA</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 58, color: COLORS.ink, marginTop: 4 }}>
            isométricos a <span style={{ color: COLORS.green, opacity: frame >= t30 ? 1 : 0 }}>30-50°</span>
          </div>
        </div>
        <Goniometer at={rec} angle={angle} zone={interpolate(frame, [t30, t30 + 8], [0, 1], CLAMP)} size={560} />
        <div style={{ height: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {frame >= min ? (
            <>
              <Slam text="PRESIÓN MÍNIMA" at={min} size={64} color={COLORS.green} />
              <div style={{ fontWeight: 800, fontSize: 30, color: COLORS.muted, opacity: interpolate(frame, [min + 10, min + 16], [0, 1], CLAMP) }}>y probablemente, mejor activación</div>
            </>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
