import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Option } from "../components/Engage";
import { Target, Vertebra } from "../components/Pictograms";
import { Punch } from "../components/Punch";
import { Ring } from "../components/Ring";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** Hallazgo: diana sobre la vértebra, las tres opciones del quiz caen tachadas y el 47 % frena en seco. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const vert = wordAt(s0, "vértebra");
  const exacta = wordAt(s0, "exacta");
  const hit = wordAt(s0, "cuarenta") - 2;
  const stop = wordEnd(s0, "siete");
  const p = interpolate(frame, [hit, stop], [0, 1], { ...CLAMP, easing: Easing.bezier(0.1, 0.9, 0.2, 1) });
  const value = Math.round(DATA.exacta * p);
  const size = 600;
  const shrink = interpolate(frame, [hit, hit + 8], [1, 0.55], CLAMP);
  return (
    <Punch shakeAt={[stop]} amount={1.6}>
      <Stage gap={18} justify="flex-start">
        {/* Opciones del quiz, tachadas en cuanto llega el dato */}
        <div style={{ display: "flex", gap: 14, marginTop: 10, scale: String(0.62), transformOrigin: "top center", height: 70 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 1 ? 0 : undefined} wrongAt={hit + i * 3} />
          ))}
        </div>
        <div style={{ position: "relative", height: 240 * shrink, width: 300, display: "flex", justifyContent: "center", alignItems: "center", scale: String(shrink), transformOrigin: "center top" }}>
          <Vertebra at={vert} size={230} label="L?" />
          {frame >= exacta ? <div style={{ position: "absolute", left: 35, top: 20 }}><Target at={exacta} size={230} /></div> : null}
        </div>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 8, color: COLORS.muted, opacity: interpolate(frame, [exacta, exacta + 8], [0, 1], CLAMP) }}>VÉRTEBRA EXACTA</div>
        <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= hit ? 1 : 0, scale: String(interpolate(frame, [hit, hit + 10], [0.7, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })) }}>
          <Ring size={size} progress={p * (DATA.exacta / 100)} />
          <div style={{ fontWeight: 900, fontSize: 240, letterSpacing: -10, color: COLORS.orange, textShadow: `0 0 70px ${COLORS.orange}99`, fontVariantNumeric: "tabular-nums", scale: String(interpolate(frame, [stop, stop + 3, stop + 10], [1, 1.14, 1], CLAMP)) }}>
            {value}
            <span style={{ fontSize: 110, letterSpacing: 0, marginLeft: 8 }}>%</span>
          </div>
        </div>
      </Stage>
      <div style={{ position: "absolute", inset: 0, backgroundColor: COLORS.orange, opacity: interpolate(frame, [stop, stop + 1, stop + 8], [0, 0.3, 0], CLAMP) }} />
    </Punch>
  );
};
