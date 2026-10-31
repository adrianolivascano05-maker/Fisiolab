import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Punch } from "../components/Punch";
import { Ring } from "../components/Ring";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Hallazgo: silencio dramático → 47 % gigante con anillo y contador que frena en seco. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const hit = wordAt(s0, "cuarenta") - 2;
  const p = interpolate(frame, [hit, hit + 22], [0, 1], { ...CLAMP, easing: Easing.bezier(0.1, 0.9, 0.2, 1) });
  const value = Math.round(DATA.exacta * p);
  const size = 640;
  return (
    <Punch shakeAt={[hit + 22]} amount={1.6}>
      <Stage gap={26}>
        <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: 8, color: COLORS.muted, opacity: interpolate(frame, [s0.start, s0.start + 8], [0, 1], CLAMP) }}>VÉRTEBRA EXACTA</div>
        <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= hit ? 1 : 0, scale: String(interpolate(frame, [hit, hit + 10], [0.7, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })) }}>
          <Ring size={size} progress={p * (DATA.exacta / 100)} />
          <div style={{ fontWeight: 900, fontSize: 250, letterSpacing: -10, color: COLORS.orange, textShadow: `0 0 70px ${COLORS.orange}99`, fontVariantNumeric: "tabular-nums", scale: String(interpolate(frame, [hit + 22, hit + 25, hit + 32], [1, 1.12, 1], CLAMP)) }}>
            {value}
            <span style={{ fontSize: 120, letterSpacing: 0, marginLeft: 8 }}>%</span>
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 40, color: COLORS.white, textAlign: "center", width: 760, lineHeight: 1.2, opacity: interpolate(frame, [hit + 26, hit + 34], [0, 1], CLAMP) }}>marcadores justo sobre la espinosa indicada</div>
      </Stage>
    </Punch>
  );
};
