import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Cross } from "../components/Icons";
import { Punch, Slam } from "../components/Punch";
import { Stage } from "../components/Stage";
import { CLAMP, COLORS } from "../config";
import { wordAt } from "../timeline";
import { SceneProps } from "./types";

const Card: React.FC<{ label: string; at: number; crossAt: number; dim: number }> = ({ label, at, crossAt, dim }) => {
  const frame = useCurrentFrame();
  const crossed = frame >= crossAt;
  return (
    <div
      style={{
        width: 280,
        height: 200,
        borderRadius: 28,
        border: `4px solid ${crossed ? COLORS.red : "rgba(255,255,255,0.35)"}`,
        backgroundColor: crossed ? "rgba(255,77,94,0.12)" : "rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontWeight: 900,
        fontSize: 56,
        color: crossed ? COLORS.red : COLORS.white,
        boxShadow: crossed ? `0 0 40px ${COLORS.red}66` : undefined,
        opacity: 1 - dim * 0.7,
        scale: String(interpolate(frame, [at, at + 12], [0, 1], { ...CLAMP, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }) * (1 - dim * 0.25) * interpolate(frame, [crossAt, crossAt + 3, crossAt + 10], [1, 1.1, 1], CLAMP)),
      }}
    >
      <div style={{ height: 70, display: "flex", alignItems: "center" }}>{crossed ? <Cross size={70} start={crossAt} /> : null}</div>
      {label}
    </div>
  );
};

/** Giro: IMC ✗, edad ✗, sexo ✗ → tarjeta «QUIÉN PALPABA» con zoom. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const at = wordAt(s0, "cambiaba") - 4;
  const x1 = wordAt(s1, "peso");
  const x2 = wordAt(s1, "edad");
  const x3 = s1.end + 4;
  const who = s2.start + 2;
  const dim = interpolate(frame, [who, who + 8], [0, 1], CLAMP);
  return (
    <Punch shakeAt={[x1, x2, x3, who + 6]} amount={0.7}>
      <Stage gap={60}>
        <Slam text="LO MÁS INCÓMODO:" at={s0.start} size={76} color={COLORS.white} />
        <div style={{ fontWeight: 700, fontSize: 46, color: COLORS.muted, opacity: interpolate(frame, [at, at + 8], [0, 1], CLAMP), marginTop: -30 }}>lo que más cambiaba el resultado...</div>
        <div style={{ display: "flex", gap: 24 }}>
          <Card label="IMC" at={at} crossAt={x1} dim={dim} />
          <Card label="EDAD" at={at + 4} crossAt={x2} dim={dim} />
          <Card label="SEXO" at={at + 8} crossAt={x3} dim={dim} />
        </div>
        {frame >= who ? (
          <div
            style={{
              marginTop: 10,
              padding: "36px 56px",
              borderRadius: 36,
              backgroundColor: COLORS.orange,
              color: COLORS.ink,
              fontWeight: 900,
              fontSize: 92,
              letterSpacing: -2,
              textAlign: "center",
              lineHeight: 1,
              boxShadow: `0 0 90px ${COLORS.orange}aa`,
              scale: String(interpolate(frame, [who, who + 12], [3.2, 1], { ...CLAMP, easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" })),
              opacity: interpolate(frame, [who, who + 3], [0, 1], CLAMP),
              rotate: `${interpolate(frame, [who, who + 12], [-6, -2], CLAMP)}deg`,
            }}
          >
            QUIÉN
            <br />
            PALPABA
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
