import { interpolate, useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { Clipboard } from "../Pictos";

/** Qué hacer: la ficha con «facetario» por un solo Kemp se tacha; se anotan las cuatro piezas. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const no = wordAt(s0, "no");
  const fac = wordAt(s0, "facetario");
  const strike = wordEnd(s0, "kemp") + 2;
  const anota = wordAt(s1, "anota");
  const piezas = wordAt(s1, "piezas");
  return (
    <Punch shakeAt={[strike, piezas]} amount={0.5}>
      <Stage gap={28} justify="flex-start">
        <div style={{ marginTop: 10 }}>
          <Slam text="NO ESCRIBAS" at={no} size={64} color={COLORS.red} />
        </div>
        <Clipboard at={no} width={700} lines={[{ text: "facetario (Kemp +)", at: fac, strikeAt: strike }]} />
        {frame >= anota ? <Slam text="ANOTA LAS 4 PIEZAS" at={anota} size={64} color={COLORS.green} glow /> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 820 }}>
          {DATA.piezas.map((t, i) => {
            const at = piezas + i * 5;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 20, fontWeight: 800, fontSize: 44, color: COLORS.white, opacity: frame >= at ? 1 : 0, translate: `${interpolate(frame, [at, at + 8], [60, 0], CLAMP)}px 0px` }}>
                <div style={{ flexShrink: 0, display: "flex" }}>
                  <Check size={64} start={at} />
                </div>
                {t}
              </div>
            );
          })}
        </div>
      </Stage>
    </Punch>
  );
};
