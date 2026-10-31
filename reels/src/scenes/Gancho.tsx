import { interpolate, useCurrentFrame } from "remotion";
import { Cross } from "../components/Icons";
import { Hand, Person, Vertebra, pop } from "../components/Pictograms";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS, DATA } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

/** Gancho: cada palabra dispara un pictograma; «MÁS DE LA MITAD FALLÓ» entra de golpe con temblor. */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const fisios = Math.max(0, wordAt(s0, "fisios") - 2);
  const expertos = wordAt(s0, "expertos");
  const palpando = wordAt(s1, "palpando");
  const lumbares = wordAt(s1, "lumbares");
  const mitad = wordAt(s2, "mitad") - 2;
  const fallo = wordAt(s2, "equivocaron");
  const vert = wordAt(s2, "vértebra");
  const press = frame >= palpando ? 0.5 + 0.5 * Math.sin((frame - palpando) / 5) : 0;
  const wrong = DATA.fisios - Math.floor(DATA.fisios / 2); // «más de la mitad» = 3 de 5
  return (
    <Punch shakeAt={[mitad, fallo]} amount={1.3}>
      <Stage gap={0} justify="flex-start">
        {/* Fila de fisios */}
        <div style={{ display: "flex", gap: 22, marginTop: 10, alignItems: "flex-end" }}>
          {new Array(DATA.fisios).fill(0).map((_, i) => (
            <div key={i} style={{ position: "relative" }}>
              <Person at={fisios} delay={i * 2} size={128} coat color={frame >= mitad && i < wrong ? COLORS.red : COLORS.white} />
              {frame >= fallo && i < wrong ? <div style={{ position: "absolute", left: 24, top: 10 }}><Cross size={80} start={fallo + i * 2} /></div> : null}
            </div>
          ))}
        </div>
        <div style={{ height: 70, marginTop: -28, opacity: frame >= expertos ? 1 : 0, scale: String(pop(frame, expertos)), rotate: `${interpolate(frame, [expertos, expertos + 10], [-12, -4], CLAMP)}deg` }}>
          <div style={{ fontWeight: 900, fontSize: 40, letterSpacing: 6, color: COLORS.ink, backgroundColor: COLORS.orange, padding: "10px 30px", borderRadius: 12, boxShadow: `0 0 40px ${COLORS.orange}88` }}>EXPERTOS</div>
        </div>
        {/* Mano que palpa sobre tres vértebras */}
        <div style={{ position: "relative", height: 300, width: 560, marginTop: 14 }}>
          <div style={{ position: "absolute", left: 20, top: 10, display: "flex", flexDirection: "column" }}>
            {["L3", "L4", "L5"].map((lv, i) => (
              <div key={lv} style={{ marginTop: i === 0 ? 0 : -34 }}>
                <Vertebra at={palpando} size={116} label={lv} color={frame >= lumbares ? COLORS.cyan : COLORS.white} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 150, top: -30 }}>
            <Hand at={palpando} size={290} press={press} />
          </div>
          {frame >= fallo ? <div style={{ position: "absolute", left: -20, top: 20 }}><Cross size={220} start={fallo} /></div> : null}
          {frame >= vert ? (
            <div style={{ position: "absolute", left: 400, top: 120 }}>
              <Vertebra at={vert} size={140} label="?" color={COLORS.orange} />
            </div>
          ) : null}
        </div>
        {/* Titular */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 10 }}>
          {frame >= mitad ? <Slam text="MÁS DE LA MITAD" at={mitad} size={92} color={COLORS.white} /> : null}
          {frame >= fallo ? <Slam text="FALLÓ" at={fallo} size={200} color={COLORS.orange} glow spacing={-6} /> : null}
          {frame < mitad ? (
            <div style={{ fontWeight: 900, fontSize: 84, color: COLORS.white, opacity: interpolate(frame, [fisios, fisios + 6], [0, 1], CLAMP), scale: String(pop(frame, fisios)) }}>
              {frame >= palpando ? <span style={{ color: COLORS.cyan }}>PALPANDO LUMBARES</span> : "FISIOS EXPERTOS"}
            </div>
          ) : null}
        </div>
      </Stage>
      <div style={{ position: "absolute", inset: 0, backgroundColor: COLORS.red, opacity: interpolate(frame, [fallo, fallo + 1, fallo + 8], [0, 0.35, 0], CLAMP) }} />
    </Punch>
  );
};
