import { interpolate, useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { Piece } from "../Pictos";

/** Matiz: «no sirve» tachado → es una pieza; el puzle se completa palabra a palabra. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const sirva = wordAt(s0, "sirva");
  const pieza = wordAt(s1, "pieza");
  const ext = wordAt(s1, "extender");
  const rod = wordAt(s1, "rodilla");
  const neuro = wordAt(s1, "neurológica");
  const normal = wordAt(s1, "normal");
  const ats = [pieza, ext, rod, neuro];
  const colors = [COLORS.orange, COLORS.cyan, COLORS.green, "#C08BFF"];
  return (
    <Punch shakeAt={[sirva, normal]} amount={0.6}>
      <Stage gap={28} justify="flex-start">
        <div style={{ position: "relative", marginTop: 6, opacity: interpolate(frame, [pieza, pieza + 8], [1, 0.3], CLAMP), scale: String(interpolate(frame, [pieza, pieza + 8], [1, 0.75], CLAMP)), transformOrigin: "top center" }}>
          <Slam text="«NO SIRVE»" at={s0.start} size={84} color={COLORS.white} />
          <div style={{ position: "absolute", left: "-4%", width: "108%", height: 14, top: "50%", marginTop: -7, borderRadius: 7, backgroundColor: COLORS.red, boxShadow: `0 0 20px ${COLORS.red}`, rotate: "-6deg", transformOrigin: "left center", scale: `${interpolate(frame, [sirva, sirva + 7], [0, 1], CLAMP)} 1` }} />
        </div>
        {frame >= pieza ? <Slam text="ES UNA PIEZA" at={pieza} size={80} color={COLORS.green} glow /> : null}
        <div style={{ display: "grid", gridTemplateColumns: "420px 420px", gap: 8, marginTop: 6 }}>
          {DATA.piezas.map((t, i) => (
            <Piece key={t} at={ats[i]} text={t} color={colors[i]} index={i} glowAt={normal} />
          ))}
        </div>
        {frame >= normal ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontWeight: 900, fontSize: 52, color: COLORS.green }}>
            <Check size={80} start={normal} /> las 4 juntas
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
