import { interpolate, useCurrentFrame } from "remotion";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DayCurve, TendonScan } from "../Pictos";

/** Datos: día 0 carga alta → día 2 cambio claro pero sutil → día 4 normalidad. La curva y la ecografía avanzan con la voz. */
export const Datos: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const d0 = s0.start;
  const d2 = s1.start;
  const sutil = wordAt(s1, "sutil");
  const d4 = s2.start;
  const norm = wordAt(s2, "normalidad");
  const t = interpolate(frame, [d0, d2 + 6, d4 + 6, norm + 10], [0, 2, 3.4, 4], CLAMP);
  const swell = Math.exp(-((t - 2) ** 2) / 0.9);
  const label = t < 1 ? "DÍA 0" : t < 3 ? "DÍA 2" : "DÍA 4";
  const labelColor = t < 1 ? COLORS.ink : t < 3 ? COLORS.orange : COLORS.green;
  return (
    <Punch dur={c.dur} shakeAt={[d2 + 6, norm]} amount={0.4}>
      <Stage gap={26} justify="flex-start">
        <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.ink, marginTop: 6, opacity: interpolate(frame, [d0, d0 + 6], [0, 1], CLAMP) }}>
          {t < 1 ? <span>carga <span style={{ color: COLORS.red }}>alta</span></span> : t < 3 ? <span style={{ color: COLORS.orange }}>claro, pero {frame >= sutil ? "sutil" : "…"}</span> : <span style={{ color: COLORS.green }}>vuelve a la normalidad</span>}
        </div>
        <TendonScan at={d0} width={700} swell={swell} label={label} labelColor={labelColor} />
        <DayCurve at={d0} width={900} t={t} marks={[{ day: 0, at: d0 }, { day: 2, at: d2 }, { day: 4, at: d4 }]} />
      </Stage>
    </Punch>
  );
};
