import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Cross } from "../components/Icons";
import { Calendar, Gauge, Hand, Person, Scale, Sex } from "../components/Pictograms";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

const Item: React.FC<{ label: string; at: number; crossAt: number; dim: number; children: React.ReactNode }> = ({ label, at, crossAt, dim, children }) => {
  const frame = useCurrentFrame();
  const crossed = frame >= crossAt;
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 200, opacity: 1 - dim * 0.7, scale: String((1 - dim * 0.2) * interpolate(frame, [crossAt, crossAt + 3, crossAt + 10], [1, 1.12, 1], CLAMP)) }}>
      {children}
      <div style={{ fontWeight: 900, fontSize: 36, color: crossed ? COLORS.red : COLORS.white, opacity: interpolate(frame, [at, at + 6], [0, 1], CLAMP) }}>{label}</div>
      {crossed ? <div style={{ position: "absolute", left: 40, top: 0 }}><Cross size={120} start={crossAt} /></div> : null}
    </div>
  );
};

/** Giro: medidor, y lo que NO cambiaba el resultado se tacha al nombrarlo; «quién palpaba» con zoom. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const inc = wordAt(s0, "incómodo");
  const camb = wordAt(s0, "cambiaba");
  const pac = wordAt(s0, "paciente");
  const pacX = wordEnd(s0, "paciente");
  const peso = wordAt(s1, "peso");
  const edad = wordAt(s1, "edad");
  const sexo = wordEnd(s1, "edad") + 6;
  const quien = wordAt(s2, "quién");
  const palp = wordAt(s2, "palpaba");
  const dim = interpolate(frame, [quien, quien + 8], [0, 1], CLAMP);
  const needle = frame < camb ? 0 : 0.5 + 0.45 * Math.sin((frame - camb) / 6);
  return (
    <Punch shakeAt={[inc, pacX, peso, edad, sexo, palp]} amount={0.8}>
      <Stage gap={24} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="LO MÁS INCÓMODO" at={inc} size={80} color={COLORS.white} />
        </div>
        <div style={{ opacity: 1 - dim }}>
          <Gauge at={camb} size={300} needle={needle} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 40, color: COLORS.muted, opacity: interpolate(frame, [camb, camb + 6], [0, 1 - dim], CLAMP), marginTop: -40 }}>lo que más cambiaba el resultado</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Item label="PACIENTE" at={pac} crossAt={pacX} dim={dim}><Person at={pac} size={120} /></Item>
          <Item label="PESO" at={peso} crossAt={peso + 4} dim={dim}><Scale at={peso} size={120} /></Item>
          <Item label="EDAD" at={edad} crossAt={edad + 4} dim={dim}><Calendar at={edad} size={120} text="65" /></Item>
          <Item label="SEXO" at={sexo} crossAt={sexo + 4} dim={dim}><Sex at={sexo} size={120} /></Item>
        </div>
        {frame >= quien ? (
          <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 10, scale: String(interpolate(frame, [quien, quien + 12], [2.6, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" })), opacity: interpolate(frame, [quien, quien + 3], [0, 1], CLAMP) }}>
            <Hand at={quien} size={220} />
            {frame >= palp ? (
              <div style={{ padding: "28px 44px", borderRadius: 32, backgroundColor: COLORS.orange, color: COLORS.ink, fontWeight: 900, fontSize: 80, lineHeight: 1, boxShadow: `0 0 90px ${COLORS.orange}aa`, scale: String(interpolate(frame, [palp, palp + 10], [1.8, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })), rotate: "-3deg" }}>
                QUIÉN
                <br />
                PALPABA
              </div>
            ) : null}
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
