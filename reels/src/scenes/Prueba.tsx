import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, HEIGHT, WIDTH } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Prueba: fogonazo blanco de rayos X y «RADIOGRAFÍA» en cian brillante con barrido. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const rx = wordAt(s0, "radiografía") - 3;
  const sweep = interpolate(frame, [rx, rx + 22], [-200, HEIGHT + 200], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  return (
    <Punch shakeAt={[rx]} amount={0.8}>
      <AbsoluteFill style={{ backgroundColor: "white", opacity: interpolate(frame, [0, 1, 10], [1, 1, 0], CLAMP) }} />
      <AbsoluteFill style={{ backgroundColor: COLORS.cyan, opacity: interpolate(frame, [rx, rx + 1, rx + 10], [0, 0.55, 0], CLAMP) }} />
      <Stage gap={40}>
        <Slam text="NO ES UNA OPINIÓN." at={s0.start} size={84} color={COLORS.white} />
        <div style={{ opacity: frame >= rx ? 1 : 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 40, letterSpacing: 10, color: COLORS.muted, opacity: interpolate(frame, [rx + 4, rx + 12], [0, 1], CLAMP) }}>LO COMPROBARON CON</div>
          <Slam text="RADIOGRAFÍA" at={rx} size={132} color={COLORS.cyan} glow spacing={-3} />
        </div>
      </Stage>
      {/* Banda de barrido */}
      <div style={{ position: "absolute", left: 0, width: WIDTH, top: sweep - 90, height: 180, background: `linear-gradient(180deg, rgba(79,209,255,0) 0%, rgba(79,209,255,0.45) 50%, rgba(79,209,255,0) 100%)`, opacity: frame >= rx && frame < rx + 24 ? 1 : 0 }} />
    </Punch>
  );
};
