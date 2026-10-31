import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Punch, Slam } from "../components/Punch";
import { Spine } from "../components/Spine";
import { CLAMP, COLORS, DATA } from "../config";
import { LAYOUT, SAFE } from "../theme";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

const Chip: React.FC<{ text: string; at: number; color: string }> = ({ text, at, color }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontWeight: 900,
        fontSize: 52,
        color: COLORS.ink,
        backgroundColor: color,
        padding: "16px 36px",
        borderRadius: 999,
        boxShadow: `0 0 40px ${color}88`,
        scale: String(interpolate(frame, [at, at + 12], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })),
        rotate: `${interpolate(frame, [at, at + 12], [-10, 0], CLAMP)}deg`,
      }}
    >
      {text}
    </div>
  );
};

/** Estudio: chips, columna lumbar esquemática, 3 marcadores que caen, barrido de rayos X y «¿Acertaron?». */
export const Estudio: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const chip1 = wordAt(s0, "Cinco");
  const chip2 = wordAt(s0, "setenta");
  const markers = DATA.niveles.map((lv) => ({ level: Number(lv[1]) - 1, at: wordAt(s0, lv) - 8 }));
  const xrayAt = wordAt(s1, "radiografía") - 4;
  const xray = interpolate(frame, [xrayAt, xrayAt + 26], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const askAt = Math.min(xrayAt + 28, s1.end - 10);
  return (
    <Punch shakeAt={[...markers.map((m) => m.at + 9), xrayAt]} amount={0.5}>
      <div style={{ position: "absolute", top: LAYOUT.headTop - 20, left: SAFE.side, right: SAFE.side, display: "flex", justifyContent: "center", gap: 28 }}>
        <Chip text={`${DATA.fisios} fisios`} at={chip1} color={COLORS.orange} />
        <Chip text={`${DATA.pacientes} pacientes`} at={chip2} color={COLORS.cyan} />
      </div>
      <div style={{ position: "absolute", top: LAYOUT.headTop + 120, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: interpolate(frame, [askAt, askAt + 6], [1, 0.25], CLAMP) }}>
        <Spine start={4} xray={frame >= xrayAt ? xray : 0} markers={markers} />
      </div>
      {frame >= askAt ? (
        <div style={{ position: "absolute", top: LAYOUT.headTop + 300, left: SAFE.side, right: SAFE.side, display: "flex", justifyContent: "center" }}>
          <Slam text="¿ACERTARON?" at={askAt} size={112} color={COLORS.white} glow spacing={-3} />
        </div>
      ) : null}
    </Punch>
  );
};
