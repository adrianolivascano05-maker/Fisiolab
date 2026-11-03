import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { KneeLeg } from "../Pictos";

/** Gancho: rodilla recién operada → isométrico con la pierna estirada → ¿y si es el ángulo que más lo frena? */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const op = wordAt(s0, "operada");
  const iso = wordAt(s1, "isométrico");
  const est = wordAt(s1, "estirada");
  const ang = wordAt(s2, "ángulo");
  const fre = wordAt(s2, "frena");
  const press = interpolate(frame, [iso, iso + 8, est, est + 8], [0, 1, 1, 1], CLAMP) * (0.7 + 0.3 * Math.sin(frame / 3));
  return (
    <Punch dur={c.dur} shakeAt={[est, fre]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6, padding: "14px 30px", borderRadius: 999, backgroundColor: COLORS.paper, border: `3px solid ${COLORS.orange}`, boxShadow: STICKER_SM, opacity: frame >= op ? 1 : 0, scale: String(pop(frame, op)) }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: COLORS.orange }} />
          <span style={{ fontWeight: 900, fontSize: 46, color: COLORS.ink }}>
            Rodilla <span style={{ color: COLORS.orange }}>recién operada</span>
          </span>
        </div>
        <LegWrap>
          <KneeLeg at={Math.max(0, s0.start - 2)} width={860} flex={0} press={press} quad={frame >= iso ? 0.8 : 0.3} brake={interpolate(frame, [fre, fre + 8], [0, 1], CLAMP)} label={frame >= est ? "0° · ESTIRADA" : undefined} labelColor={COLORS.red} />
        </LegWrap>
        <div style={{ height: 120, display: "flex", alignItems: "center" }}>
          {frame >= ang ? <Slam text={"¿EL ÁNGULO QUE\nMÁS LO FRENA?"} at={ang} size={70} color={COLORS.red} /> : frame >= iso ? <Slam text="ISOMÉTRICO" at={iso} size={80} color={COLORS.ink} /> : null}
        </div>
      </Stage>
    </Punch>
  );
};

const LegWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ marginTop: 20 }}>{children}</div>;
