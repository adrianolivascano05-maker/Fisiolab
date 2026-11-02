import { interpolate, useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { Clipboard } from "../../kemp/Pictos";
import { DATA } from "../config";

/** Qué hacer: no etiquetes por un solo test del 4; haz la batería y cuenta positivos. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const no = wordAt(s0, "no");
  const etiq = wordAt(s0, "etiquetes");
  const strike = wordEnd(s0, "cuatro") + 2;
  const haz = wordAt(s0, "haz");
  const cuenta = wordAt(s0, "cuenta");
  const end = wordEnd(s0, "positivos");
  const n = Math.round(interpolate(frame, [cuenta, end + 6], [0, DATA.criterio.pos], CLAMP));
  return (
    <Punch dur={c.dur} shakeAt={[strike, end]} amount={0.5}>
      <Stage gap={26} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="NO ETIQUETES" at={no} size={64} color={COLORS.red} />
        </div>
        <Clipboard at={etiq} width={720} lines={[{ text: "sacroilíaca (test del 4 +)", at: etiq + 4, strikeAt: strike }]} />
        {frame >= haz ? <Slam text="HAZ LA BATERÍA" at={haz} size={64} color={COLORS.green} /> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 760, opacity: frame >= haz ? 1 : 0 }}>
          {DATA.tests.map((t, i) => {
            const at = haz + 3 + i * 3;
            const ticked = i < n;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 18, fontWeight: 800, fontSize: 38, color: COLORS.ink, opacity: frame >= at ? 1 : 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, border: `2px solid ${ticked ? COLORS.green : COLORS.line}`, backgroundColor: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {ticked ? <Check size={44} start={cuenta + i * 6} /> : null}
                </div>
                {t}
              </div>
            );
          })}
        </div>
        <div style={{ fontWeight: 900, fontSize: 52, color: COLORS.ink, opacity: frame >= cuenta ? 1 : 0 }}>
          positivos: <span style={{ color: COLORS.green, fontVariantNumeric: "tabular-nums" }}>{n}</span> de 6
        </div>
      </Stage>
    </Punch>
  );
};
