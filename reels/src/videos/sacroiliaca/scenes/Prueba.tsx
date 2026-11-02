import { useCurrentFrame } from "remotion";
import { Check, Cross } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";

const YearCard: React.FC<{ label: string; year: string; at: number; color: string; children?: React.ReactNode }> = ({ label, year, at, color, children }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: 400, padding: "30px 0", borderRadius: 28, backgroundColor: COLORS.paper, border: `2px solid ${color}`, boxShadow: STICKER, textAlign: "center", opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.muted }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 130, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{year}</div>
      {children}
    </div>
  );
};

/** Prueba: la revisión fecha el estudio en 2008; el original es de 2018. */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const err = wordAt(s0, "error");
  const ocho = wordAt(s0, "dos", 0);
  const ochoX = wordEnd(s0, "ocho") + 4;
  const dieci = wordAt(s0, "dos", 1);
  const ok = wordEnd(s0, "dieciocho");
  return (
    <Punch dur={c.dur} shakeAt={[ochoX, ok]} amount={0.6}>
      <Stage gap={40} justify="flex-start">
        <div style={{ marginTop: 20 }}>
          <Slam text="PRIMER ERROR" at={err} size={96} color={COLORS.red} />
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 20 }}>
          <YearCard label="LA REVISIÓN DICE" year="2008" at={ocho} color={frame >= ochoX ? COLORS.red : COLORS.ink}>
            {frame >= ochoX ? (
              <div style={{ position: "absolute", left: 125, top: 40 }}>
                <Cross size={150} start={ochoX} />
              </div>
            ) : null}
          </YearCard>
          <YearCard label="EL ORIGINAL" year="2018" at={dieci} color={COLORS.green}>
            {frame >= ok ? (
              <div style={{ position: "absolute", right: -30, top: -30 }}>
                <Check size={110} start={ok} />
              </div>
            ) : null}
          </YearCard>
        </div>
        <div style={{ fontWeight: 800, fontSize: 40, color: COLORS.ink, textAlign: "center", lineHeight: 1.25, opacity: frame >= dieci ? 1 : 0, scale: String(pop(frame, dieci + 6)) }}>
          Telli, Telli y Topal
          <br />
          <span style={{ color: COLORS.muted, fontWeight: 700, fontSize: 34 }}>Pain Physician · retrospectivo · una clínica</span>
        </div>
      </Stage>
    </Punch>
  );
};
