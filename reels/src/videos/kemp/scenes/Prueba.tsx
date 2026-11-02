import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";

const Paper: React.FC<{ at: number; dx: number; dy: number; rot: number; label: string }> = ({ at, dx, dy, rot, label }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 14], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 150, height: 190, borderRadius: 14, backgroundColor: COLORS.paper, border: `3px solid ${COLORS.ink}`, boxShadow: "4px 4px 0 #14181F", opacity: frame >= at ? 1 : 0, translate: `${dx * (1 - p)}px ${dy * (1 - p)}px`, rotate: `${rot * (1 - p)}deg`, display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 22, color: COLORS.ink }}>{label}</div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(20,24,31,0.2)", width: `${70 + ((i * 37) % 30)}%` }} />
      ))}
    </div>
  );
};

/** Prueba: tarjeta de la revisión (Life 2024) a la que llegan los estudios que midieron el test. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const rev = wordAt(s0, "revisión");
  const year = wordAt(s0, "dos");
  const datos = wordAt(s0, "reunió");
  const mid = wordAt(s0, "midieron");
  return (
    <Punch shakeAt={[year]} amount={0.6}>
      <AbsoluteFill style={{ backgroundColor: COLORS.cyan, opacity: interpolate(frame, [0, 1, 10], [0, 0.3, 0], CLAMP) }} />
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="NO ES UNA OPINIÓN" at={0} size={70} color={COLORS.white} />
        </div>
        <div style={{ position: "relative", width: 900, height: 420 }}>
          {/* Tarjeta de la revisión */}
          <div style={{ position: "absolute", left: 250, top: 40, width: 400, height: 360, borderRadius: 30, border: `5px solid ${COLORS.cyan}`, backgroundColor: "rgba(58,134,255,0.12)", boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)) }}>
            <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 6, color: COLORS.muted }}>REVISIÓN</div>
            <div style={{ fontWeight: 900, fontSize: 92, color: COLORS.cyan, lineHeight: 1, opacity: frame >= year ? 1 : 0, scale: String(pop(frame, year)) }}>2024</div>
            <div style={{ fontWeight: 800, fontSize: 36, color: COLORS.white }}>Life · Custers et al.</div>
            <div style={{ fontWeight: 600, fontSize: 26, color: COLORS.muted, opacity: interpolate(frame, [mid, mid + 6], [0, 1], CLAMP) }}>narrativa · cita a Stuber 2014</div>
          </div>
          {/* Estudios que llegan a la tarjeta */}
          <Paper at={datos} dx={-520} dy={-200} rot={-30} label="Estudio 1" />
          <div style={{ position: "absolute", left: 0, top: 0, translate: "60px 230px" }}>
            <Paper at={datos + 4} dx={-520} dy={200} rot={25} label="Estudio 2" />
          </div>
          <div style={{ position: "absolute", left: 0, top: 0, translate: "740px 120px" }}>
            <Paper at={datos + 8} dx={520} dy={-120} rot={30} label="Estudio 3" />
          </div>
        </div>
        <div style={{ fontWeight: 900, fontSize: 56, color: COLORS.white, opacity: interpolate(frame, [mid, mid + 6], [0, 1], CLAMP) }}>
          los estudios que <span style={{ color: COLORS.cyan }}>midieron el Kemp</span>
        </div>
      </Stage>
    </Punch>
  );
};
