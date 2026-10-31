import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Check, Cross } from "../components/Icons";
import { Bubble } from "../components/Pictograms";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, HEIGHT, WIDTH } from "../config";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** Prueba: «opinión» tachada, «comprobaron» ✓, «radiografía» con fogonazo y barrido. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const op = wordAt(s0, "opinión");
  const opX = wordEnd(s0, "opinión");
  const comp = wordAt(s0, "comprobaron");
  const rx = wordAt(s0, "radiografía") - 2;
  const sweep = interpolate(frame, [rx, rx + 22], [-200, HEIGHT + 200], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const fade = interpolate(frame, [rx, rx + 6], [1, 0.15], CLAMP);
  return (
    <Punch shakeAt={[opX, rx]} amount={0.8}>
      <AbsoluteFill style={{ backgroundColor: "white", opacity: interpolate(frame, [0, 1, 10], [1, 1, 0], CLAMP) }} />
      <AbsoluteFill style={{ backgroundColor: COLORS.cyan, opacity: interpolate(frame, [rx, rx + 1, rx + 10], [0, 0.6, 0], CLAMP) }} />
      <Stage gap={30}>
        <div style={{ display: "flex", gap: 40, alignItems: "center", opacity: fade, scale: String(0.6 + 0.4 * fade) }}>
          <div style={{ position: "relative" }}>
            <Bubble at={op} size={220} width={150} text="OPINIÓN" />
            {frame >= opX ? <div style={{ position: "absolute", left: 100, top: 40 }}><Cross size={150} start={opX} /></div> : null}
          </div>
          {frame >= comp ? <Check size={170} start={comp} /> : null}
        </div>
        <Slam text="NO ES UNA OPINIÓN." at={s0.start} size={76} color={COLORS.white} />
        <div style={{ opacity: frame >= rx ? 1 : 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 38, letterSpacing: 10, color: COLORS.muted, opacity: interpolate(frame, [rx + 4, rx + 12], [0, 1], CLAMP) }}>LO COMPROBARON CON</div>
          <Slam text="RADIOGRAFÍA" at={rx} size={128} color={COLORS.cyan} glow spacing={-3} />
        </div>
      </Stage>
      <div style={{ position: "absolute", left: 0, width: WIDTH, top: sweep - 90, height: 180, background: `linear-gradient(180deg, rgba(79,209,255,0) 0%, rgba(79,209,255,0.5) 50%, rgba(79,209,255,0) 100%)`, opacity: frame >= rx && frame < rx + 24 ? 1 : 0 }} />
    </Punch>
  );
};
