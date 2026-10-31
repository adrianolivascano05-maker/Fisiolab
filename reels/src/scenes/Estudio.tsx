import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Hand, Marker, Person, pop } from "../components/Pictograms";
import { Punch } from "../components/Punch";
import { Spine } from "../components/Spine";
import { CLAMP, COLORS, DATA } from "../config";
import { LAYOUT, SAFE } from "../theme";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** Estudio: 5 fisios, mano, rotulador, L1-L3-L5 que caen al nombrarlos, contador de 75 pacientes, dolor, piel y radiografía. */
export const Estudio: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const cinco = wordAt(s0, "cinco");
  const manual = wordAt(s0, "manual");
  const marcaron = wordAt(s0, "marcaron");
  const markers = DATA.niveles.map((lv) => ({ level: Number(lv[1]) - 1, at: wordAt(s0, lv) - 7 }));
  const setenta = wordAt(s0, "setenta");
  const pacientes = wordEnd(s0, "pacientes");
  const lumbalgia = wordAt(s0, "lumbalgia");
  const marcador = wordAt(s1, "marcador");
  const piel = wordAt(s1, "piel");
  const xrayAt = wordAt(s1, "radiografía") - 3;
  const xray = interpolate(frame, [xrayAt, xrayAt + 26], [0, 1], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const n = Math.round(interpolate(frame, [setenta, pacientes], [0, DATA.pacientes], { ...CLAMP, easing: Easing.bezier(0.1, 0.9, 0.2, 1) }));
  return (
    <Punch shakeAt={[...markers.map((m) => m.at + 9), xrayAt]} amount={0.5}>
      {/* Fila superior: fisios + mano + rotulador */}
      <div style={{ position: "absolute", top: LAYOUT.headTop - 10, left: SAFE.side, right: SAFE.side, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
        {new Array(DATA.fisios).fill(0).map((_, i) => (
          <Person key={i} at={cinco} delay={i * 2} size={84} coat />
        ))}
        <div style={{ width: 20 }} />
        <Hand at={manual} size={110} />
        <Marker at={marcaron} size={100} />
      </div>
      {/* Contador de pacientes */}
      <div style={{ position: "absolute", top: LAYOUT.headTop + 110, left: SAFE.side, right: SAFE.side, display: "flex", justifyContent: "center", gap: 20, opacity: frame >= setenta ? 1 : 0, scale: String(pop(frame, setenta)) }}>
        <div style={{ fontWeight: 900, fontSize: 46, color: COLORS.ink, backgroundColor: COLORS.cyan, padding: "12px 34px", borderRadius: 999, boxShadow: `0 0 40px ${COLORS.cyan}88`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {n} pacientes
        </div>
        {frame >= lumbalgia ? (
          <div style={{ fontWeight: 900, fontSize: 46, color: COLORS.white, backgroundColor: COLORS.red, padding: "12px 34px", borderRadius: 999, boxShadow: `0 0 40px ${COLORS.red}88`, scale: String(pop(frame, lumbalgia)), whiteSpace: "nowrap" }}>
            con lumbalgia
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", top: LAYOUT.headTop + 210, left: 0, right: 0, display: "flex", justifyContent: "center", scale: String(interpolate(frame, [marcador, marcador + 8], [1, 1.06], CLAMP)) }}>
        <Spine start={cinco} xray={frame >= xrayAt ? xray : 0} markers={markers} skinAt={piel} painAt={lumbalgia} />
      </div>
      {frame >= marcador ? (
        <div style={{ position: "absolute", top: LAYOUT.headTop + 260, left: 700 }}>
          <Marker at={marcador} size={150} />
        </div>
      ) : null}
    </Punch>
  );
};
