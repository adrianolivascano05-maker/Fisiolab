import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Check, Cross } from "../components/Icons";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Matiz: barra 47 % «exacta» que crece hasta 72 % «±1 nivel»; zona ✓, vértebra ✗. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const grow = wordAt(s0, "cuatro") - 2;
  const p = interpolate(frame, [grow, grow + 26], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const value = Math.round(DATA.exacta + (DATA.unNivel - DATA.exacta) * p);
  const zone = wordAt(s1, "zona") - 4;
  const vert = wordAt(s2, "vértebra") - 4;
  const W = 900;
  return (
    <Punch shakeAt={[grow + 26, vert]} amount={0.6}>
      <Stage gap={44}>
        <Slam text="LA BUENA NOTICIA" at={s0.start} size={74} color={COLORS.green} glow />
        <div style={{ width: W, display: "flex", flexDirection: "column", gap: 18, opacity: interpolate(frame, [s0.start + 6, s0.start + 14], [0, 1], CLAMP) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontWeight: 800, fontSize: 44, color: COLORS.white }}>
            <span style={{ color: p > 0.02 ? COLORS.green : COLORS.orange }}>{p > 0.02 ? "exacta o a 1 nivel" : "vértebra exacta"}</span>
            <span style={{ fontSize: 110, fontWeight: 900, color: p > 0.02 ? COLORS.green : COLORS.orange, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value} %</span>
          </div>
          <div style={{ height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${DATA.exacta + (DATA.unNivel - DATA.exacta) * p}%`, borderRadius: 32, background: `linear-gradient(90deg, ${COLORS.orange} 0%, ${COLORS.orange} ${(DATA.exacta / (DATA.exacta + (DATA.unNivel - DATA.exacta) * p)) * 100}%, ${COLORS.green} 100%)`, boxShadow: `0 0 40px ${p > 0.02 ? COLORS.green : COLORS.orange}88` }} />
            <div style={{ position: "absolute", left: `${DATA.exacta}%`, top: 0, bottom: 0, width: 4, backgroundColor: "rgba(255,255,255,0.7)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 32, color: COLORS.muted }}>
            <span>{DATA.exacta} % exacta</span>
            <span style={{ opacity: p }}>{DATA.unNivel} % exacta o a ±1 nivel</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 10 }}>
          {frame >= zone ? (
            <div style={{ display: "flex", alignItems: "center", gap: 24, fontWeight: 900, fontSize: 62, whiteSpace: "nowrap", color: COLORS.green, scale: String(interpolate(frame, [zone, zone + 10], [0.6, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })) }}>
              <Check size={84} start={zone} /> TE LLEVA A LA ZONA
            </div>
          ) : null}
          {frame >= vert ? (
            <div style={{ display: "flex", alignItems: "center", gap: 24, fontWeight: 900, fontSize: 62, whiteSpace: "nowrap", color: COLORS.red, scale: String(interpolate(frame, [vert, vert + 10], [0.6, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })) }}>
              <Cross size={84} start={vert} /> NO A LA VÉRTEBRA
            </div>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
