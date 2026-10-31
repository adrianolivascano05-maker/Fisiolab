import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Check, Cross } from "../components/Icons";
import { Hand, Person, Vertebra } from "../components/Pictograms";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** Matiz: 3 de 4 personas en verde, barra 47→72 %, ±1 nivel, la mano llega a la zona pero no a la vértebra. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const buena = wordAt(s0, "buena");
  const tres = wordAt(s0, "tres");
  const cuatro = wordAt(s0, "cuatro");
  const acert = wordAt(s0, "acertaban");
  const nivel = wordAt(s0, "nivel");
  const grow = acert;
  const p = interpolate(frame, [grow, wordEnd(s0, "nivel")], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const value = Math.round(DATA.exacta + (DATA.unNivel - DATA.exacta) * p);
  const palp = wordAt(s1, "palpación");
  const zona = wordAt(s1, "zona");
  const vert = wordAt(s2, "vértebra");
  const W = 900;
  const handY = interpolate(frame, [palp, zona], [-60, 40], { ...CLAMP, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  return (
    <Punch shakeAt={[wordEnd(s0, "nivel"), vert]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="LA BUENA NOTICIA" at={buena} size={74} color={COLORS.green} glow />
        </div>
        <div style={{ display: "flex", gap: 18, height: 130 }}>
          {[0, 1, 2].map((i) => (
            <Person key={i} at={tres} delay={i * 2} size={120} color={COLORS.green} />
          ))}
          <Person at={cuatro} size={120} color="rgba(255,255,255,0.35)" />
        </div>
        <div style={{ width: W, display: "flex", flexDirection: "column", gap: 14, opacity: interpolate(frame, [acert - 4, acert + 4], [0, 1], CLAMP) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontWeight: 800, fontSize: 40, color: COLORS.white }}>
            <span style={{ color: p > 0.02 ? COLORS.green : COLORS.orange }}>{p > 0.02 ? "exacta o a ±1 nivel" : "vértebra exacta"}</span>
            <span style={{ fontSize: 100, fontWeight: 900, color: p > 0.02 ? COLORS.green : COLORS.orange, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value} %</span>
          </div>
          <div style={{ height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${DATA.exacta + (DATA.unNivel - DATA.exacta) * p}%`, borderRadius: 28, background: `linear-gradient(90deg, ${COLORS.orange} 0%, ${COLORS.orange} ${(DATA.exacta / (DATA.exacta + (DATA.unNivel - DATA.exacta) * p)) * 100}%, ${COLORS.green} 100%)`, boxShadow: `0 0 40px ${p > 0.02 ? COLORS.green : COLORS.orange}88` }} />
            <div style={{ position: "absolute", left: `${DATA.exacta}%`, top: 0, bottom: 0, width: 4, backgroundColor: "rgba(255,255,255,0.7)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 30, color: COLORS.muted }}>
            <span>{DATA.exacta} % exacta</span>
            <span style={{ opacity: frame >= nivel ? 1 : 0, color: COLORS.green }}>{DATA.unNivel} % exacta o a ±1 nivel</span>
          </div>
        </div>
        {/* Mano que llega a la zona (3 vértebras) pero no a la vértebra */}
        <div style={{ position: "relative", width: 900, height: 260, marginTop: 6, opacity: frame >= palp ? 1 : 0 }}>
          <div style={{ position: "absolute", left: 40, top: 20, display: "flex", gap: -20, padding: 14, borderRadius: 40, border: `5px solid ${frame >= zona ? COLORS.green : "transparent"}`, boxShadow: frame >= zona ? `0 0 50px ${COLORS.green}66` : undefined }}>
            {["L3", "L4", "L5"].map((lv) => (
              <Vertebra key={lv} at={palp} size={130} label={lv} color={frame >= vert && lv === "L4" ? COLORS.red : COLORS.white} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 470, top: handY }}>
            <Hand at={palp} size={180} />
          </div>
          {frame >= zona ? (
            <div style={{ position: "absolute", left: 630, top: 30, display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 48, color: COLORS.green }}>
              <Check size={70} start={zona} /> ZONA
            </div>
          ) : null}
          {frame >= vert ? (
            <div style={{ position: "absolute", left: 630, top: 130, display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 48, color: COLORS.red }}>
              <Cross size={70} start={vert} /> VÉRTEBRA
            </div>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
