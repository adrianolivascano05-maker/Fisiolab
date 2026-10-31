import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Check } from "../components/Icons";
import { Person, Target } from "../components/Pictograms";
import { Punch } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { SentenceClock, wordAt, wordEnd } from "../timeline";
import { SceneProps } from "./types";

/** Bocadillo que se escribe palabra a palabra al ritmo de la voz. */
const TypedBubble: React.FC<{ s: SentenceClock; words: string[]; color: string; strikeAt?: number; at: number }> = ({ s, words, color, strikeAt, at }) => {
  const frame = useCurrentFrame();
  const struck = strikeAt !== undefined && frame >= strikeAt;
  return (
    <div
      style={{
        position: "relative",
        padding: "30px 48px",
        borderRadius: 40,
        borderBottomLeftRadius: 8,
        backgroundColor: struck ? "rgba(255,77,94,0.15)" : `${color}1f`,
        border: `4px solid ${struck ? COLORS.red : color}`,
        fontWeight: 800,
        fontSize: 60,
        color: struck ? COLORS.red : COLORS.white,
        textAlign: "center",
        minWidth: 760,
        minHeight: 110,
        display: "flex",
        justifyContent: "center",
        gap: 18,
        flexWrap: "wrap",
        scale: String(interpolate(frame, [at, at + 12], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })),
        rotate: `${strikeAt !== undefined ? interpolate(frame, [strikeAt, strikeAt + 8], [0, -4], CLAMP) : 0}deg`,
        boxShadow: struck ? `0 0 50px ${COLORS.red}66` : `0 0 30px ${color}44`,
      }}
    >
      <span style={{ opacity: 0.5 }}>«</span>
      {words.map((w, i) => {
        const t = wordAt(s, w, w === "zona" ? 0 : 0);
        return (
          <span key={i} style={{ opacity: frame >= t ? 1 : 0, scale: String(interpolate(frame, [t, t + 6], [1.4, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })) }}>
            {w}
          </span>
        );
      })}
      <span style={{ opacity: 0.5 }}>»</span>
      {strikeAt !== undefined ? (
        <div style={{ position: "absolute", left: "-4%", width: "108%", height: 14, top: "50%", marginTop: -7, borderRadius: 7, backgroundColor: COLORS.red, boxShadow: `0 0 20px ${COLORS.red}`, rotate: "-7deg", transformOrigin: "left center", scale: `${interpolate(frame, [strikeAt, strikeAt + 7], [0, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1) })} 1` }} />
      ) : null}
    </div>
  );
};

/** Qué hacer: la frase prohibida se escribe y se tacha; la buena se escribe en verde; el paciente reconoce su dolor. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const deja = wordAt(s0, "deja");
  const tienes = wordAt(s0, "tienes") - 4;
  const strike = wordEnd(s0, "bloqueada") + 2;
  const di = wordAt(s1, "di") - 2;
  const busca = wordAt(s1, "busca");
  const dolor = wordAt(s1, "dolor");
  const pac = wordAt(s1, "paciente");
  const rec = wordAt(s1, "reconoce");
  const nod = frame >= rec ? Math.sin((frame - rec) / 3) * 6 * Math.max(0, 1 - (frame - rec) / 40) : 0;
  return (
    <Punch shakeAt={[strike, rec]} amount={0.5}>
      <Stage gap={30} justify="flex-start">
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 44, letterSpacing: 6, color: COLORS.red, opacity: interpolate(frame, [deja, deja + 6], [0, 1], CLAMP) }}>DEJA DE DECIR</div>
        <TypedBubble s={s0} words={["tienes", "L4-L5", "bloqueada"]} color="rgba(255,255,255,0.5)" strikeAt={strike} at={tienes} />
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: COLORS.green, opacity: interpolate(frame, [di, di + 6], [0, 1], CLAMP), marginTop: 10 }}>DI</div>
        {frame >= di ? <TypedBubble s={s1} words={["zona", "lumbar", "baja"]} color={COLORS.green} at={di} /> : null}
        <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 10, opacity: frame >= busca ? 1 : 0 }}>
          <Target at={busca} size={120} color={frame >= dolor ? COLORS.red : COLORS.cyan} />
          <div style={{ translate: `0px ${nod}px` }}>
            <Person at={pac} size={130} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 44, color: COLORS.white, lineHeight: 1.1, opacity: interpolate(frame, [dolor, dolor + 6], [0, 1], CLAMP) }}>
            el dolor que
            <br />
            <span style={{ color: frame >= rec ? COLORS.green : COLORS.white }}>el paciente reconoce</span>
          </div>
          {frame >= rec ? <Check size={90} start={rec} /> : null}
        </div>
      </Stage>
    </Punch>
  );
};
