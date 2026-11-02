import { interpolate, useCurrentFrame } from "remotion";
import { Cross } from "../../../components/Icons";
import { Person, pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { Detector, Flame, Smoke, Syringe } from "../Pictos";

const Missing: React.FC<{ at: number; crossAt: number; label: string; children: React.ReactNode }> = ({ at, crossAt, label, children }) => {
  const frame = useCurrentFrame();
  const crossed = frame >= crossAt;
  return (
    <div style={{ position: "relative", width: 400, height: 270, borderRadius: 28, backgroundColor: COLORS.paper, border: `2px ${crossed ? "solid" : "dashed"} ${crossed ? COLORS.red : COLORS.line}`, boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ opacity: crossed ? 0.35 : 1 }}>{children}</div>
      <div style={{ fontWeight: 900, fontSize: 32, color: crossed ? COLORS.red : COLORS.ink, textAlign: "center", lineHeight: 1.1, whiteSpace: "pre-line" }}>{label}</div>
      {crossed ? (
        <div style={{ position: "absolute", left: 140, top: 30 }}>
          <Cross size={120} start={crossAt} />
        </div>
      ) : null}
    </div>
  );
};

/** Giro: la analogía del detector de humo (el test decide en parte si «había fuego») y lo que falta para saber cuánto acierta. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const det = wordAt(s0, "detector", 0);
  const humo = wordAt(s0, "humo");
  const mismo = wordAt(s0, "mismo");
  const fuego = wordAt(s0, "fuego");
  const inf = wordAt(s1, "infiltración");
  const infX = wordEnd(s1, "infiltración") + 2;
  const pac = wordAt(s1, "pacientes");
  const probX = wordEnd(s1, "problema") + 2;
  const acierta = wordAt(s1, "acierta");
  const shrink = interpolate(frame, [s1.start - 4, s1.start + 8], [1, 0.5], CLAMP);
  const loopP = interpolate(frame, [mismo, mismo + 14], [0, 1], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[fuego, infX, probX, acierta]} amount={0.6}>
      <Stage gap={18} justify="flex-start">
        {/* Analogía: detector → decide si hay fuego */}
        <div style={{ position: "relative", width: 900, height: 700, scale: String(shrink), transformOrigin: "top center", marginTop: 4, marginBottom: -700 * (1 - shrink) }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, textAlign: "center", fontWeight: 900, fontSize: 60, color: COLORS.ink, opacity: frame >= det ? 1 : 0, scale: String(pop(frame, det)) }}>
            ES COMO UN DETECTOR DE HUMO
          </div>
          <div style={{ position: "absolute", left: 20, top: 120 }}>
            <Detector at={det} size={400} alarm={mismo} />
          </div>
          <div style={{ position: "absolute", left: 120, top: 440 }}>
            <Smoke at={humo} size={200} />
          </div>
          {/* Flecha del detector al fuego */}
          <svg width={900} height={700} style={{ position: "absolute", inset: 0 }}>
            <path d="M430 260 C 600 200, 720 300, 700 420" fill="none" stroke={COLORS.orange} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - loopP} />
            {loopP > 0.95 ? <path d="M676 400 L700 430 L716 396" fill="none" stroke={COLORS.orange} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /> : null}
          </svg>
          <div style={{ position: "absolute", left: 590, top: 440 }}>
            <Flame at={fuego} size={240} question />
          </div>
          <div style={{ position: "absolute", left: 300, top: 330, width: 330, textAlign: "center", fontWeight: 900, fontSize: 42, color: COLORS.orange, opacity: frame >= mismo ? 1 : 0, scale: String(pop(frame, mismo)) }}>
            el mismo detector decide
          </div>
          <div style={{ position: "absolute", left: 540, top: 680, width: 340, textAlign: "center", fontWeight: 900, fontSize: 44, color: COLORS.ink, opacity: frame >= fuego ? 1 : 0 }}>¿había fuego?</div>
        </div>
        {/* Lo que falta */}
        <div style={{ display: "flex", gap: 30, marginTop: 10, opacity: frame >= s1.start ? 1 : 0 }}>
          <Missing at={inf} crossAt={infX} label={"INFILTRACIÓN\nDE REFERENCIA"}>
            <Syringe at={inf} size={140} />
          </Missing>
          <Missing at={pac} crossAt={probX} label={"PACIENTES\nSIN EL PROBLEMA"}>
            <Person at={pac} size={120} color="rgba(11,18,32,0.35)" />
          </Missing>
        </div>
        {frame >= acierta ? (
          <div style={{ padding: "20px 36px", borderRadius: 26, backgroundColor: COLORS.red, color: COLORS.paper, boxShadow: STICKER, fontWeight: 900, fontSize: 44, whiteSpace: "nowrap", scale: String(pop(frame, acierta)), rotate: "-2deg" }}>
            ¿CUÁNTO ACIERTA? NO LO SABEMOS
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
