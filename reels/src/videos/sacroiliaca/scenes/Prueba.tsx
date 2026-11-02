import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Ring } from "../../../components/Ring";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SPRINGS, springAt } from "../../../motion";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { Magnifier } from "../Pictos";

const Card: React.FC<{ at: number; label: string; year: string; sub: string; color: string }> = ({ at, label, year, sub, color }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ padding: "18px 30px", borderRadius: 22, backgroundColor: COLORS.paper, border: `2px solid ${color}`, boxShadow: STICKER_SM, textAlign: "center", opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)), minWidth: 330 }}>
      <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 5, color: COLORS.muted }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 70, color, lineHeight: 1 }}>{year}</div>
      <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.ink }}>{sub}</div>
    </div>
  );
};

/** Prueba: la revisión le atribuye un 91,4 %; vamos al original y el número «cuenta otra historia». */
export const Prueba: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const rev = wordAt(s0, "revisión");
  const n0 = wordAt(s0, "noventa");
  const n1 = wordEnd(s0, "ciento");
  const orig = wordAt(s1, "original");
  const dieci = wordAt(s1, "dos");
  const otra = wordAt(s2, "otra");
  const doubt = frame >= otra;
  const p = springAt(frame, n0, SPRINGS.counter);
  const value = (DATA.faber * interpolate(frame, [n0, n1], [0, 1], CLAMP)).toFixed(1).replace(".", ",");
  return (
    <Punch dur={c.dur} shakeAt={[n1, otra]} amount={0.7}>
      <Stage gap={26} justify="flex-start">
        <div style={{ display: "flex", gap: 30, marginTop: 6, height: 170 }}>
          <Card at={rev} label="LA REVISIÓN" year="2024" sub="Life · Custers" color={COLORS.cyan} />
          {frame >= orig ? <Card at={orig} label="EL ORIGINAL" year={frame >= dieci ? "2018" : "····"} sub="Pain Physician · Telli" color={COLORS.green} /> : null}
        </div>
        <div style={{ fontWeight: 800, fontSize: 38, color: COLORS.muted, opacity: frame >= rev + 6 ? 1 : 0 }}>«el test del 4 detecta el…»</div>
        <div style={{ position: "relative", width: 480, height: 480, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= n0 ? 1 : 0, scale: String(0.7 + 0.3 * springAt(frame, n0, SPRINGS.smooth)) }}>
          <Ring size={480} progress={p * (DATA.faber / 100)} color={doubt ? COLORS.red : COLORS.orange} />
          <div style={{ fontWeight: 900, fontSize: 150, letterSpacing: -6, color: doubt ? COLORS.red : COLORS.orange, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {value}
            <span style={{ fontSize: 76, marginLeft: 6 }}>{doubt ? "%?" : "%"}</span>
          </div>
          {frame >= orig ? <Magnifier at={orig} size={210} x={290} y={270} /> : null}
        </div>
        {doubt ? (
          <div style={{ marginTop: -20, rotate: "-3deg" }}>
            <Slam text="OTRA HISTORIA" at={otra} size={70} color={COLORS.red} />
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
