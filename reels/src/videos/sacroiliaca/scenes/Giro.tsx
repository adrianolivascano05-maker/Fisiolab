import { useCurrentFrame } from "remotion";
import { Cross } from "../../../components/Icons";
import { Person, pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { Syringe } from "../Pictos";

const Missing: React.FC<{ at: number; crossAt: number; label: string; children: React.ReactNode }> = ({ at, crossAt, label, children }) => {
  const frame = useCurrentFrame();
  const crossed = frame >= crossAt;
  return (
    <div style={{ position: "relative", width: 400, height: 330, borderRadius: 28, backgroundColor: COLORS.paper, border: `2px ${crossed ? "solid" : "dashed"} ${crossed ? COLORS.red : COLORS.line}`, boxShadow: STICKER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ opacity: crossed ? 0.35 : 1 }}>{children}</div>
      <div style={{ fontWeight: 900, fontSize: 34, color: crossed ? COLORS.red : COLORS.ink, textAlign: "center", lineHeight: 1.1, whiteSpace: "pre-line" }}>{label}</div>
      {crossed ? (
        <div style={{ position: "absolute", left: 130, top: 40 }}>
          <Cross size={140} start={crossAt} />
        </div>
      ) : null}
    </div>
  );
};

/** Giro: sin infiltración de referencia y sin gente sin diagnóstico → no es una sensibilidad. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const comp = wordAt(s0, "comparó");
  const inf = wordAt(s0, "infiltración");
  const infX = wordEnd(s0, "infiltración") + 2;
  const gente = wordAt(s0, "gente");
  const diagX = wordEnd(s0, "diagnóstico") + 2;
  const sens = wordAt(s1, "sensibilidad");
  return (
    <Punch dur={c.dur} shakeAt={[infX, diagX, sens]} amount={0.6}>
      <Stage gap={34} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="LO QUE FALTA" at={comp} size={78} color={COLORS.ink} />
        </div>
        <div style={{ display: "flex", gap: 30 }}>
          <Missing at={inf} crossAt={infX} label={"INFILTRACIÓN\nDE REFERENCIA"}>
            <Syringe at={inf} size={170} />
          </Missing>
          <Missing at={gente} crossAt={diagX} label={"GENTE SIN\nDIAGNÓSTICO"}>
            <Person at={gente} size={150} color="rgba(11,18,32,0.35)" />
          </Missing>
        </div>
        {frame >= sens ? (
          <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "26px 40px", borderRadius: 28, backgroundColor: COLORS.red, color: COLORS.paper, boxShadow: STICKER, scale: String(pop(frame, sens)), rotate: "-2deg" }}>
            <span style={{ fontWeight: 900, fontSize: 76 }}>91,4 %</span>
            <span style={{ fontWeight: 900, fontSize: 76 }}>≠</span>
            <span style={{ fontWeight: 900, fontSize: 56 }}>SENSIBILIDAD</span>
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
