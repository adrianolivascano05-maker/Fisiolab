import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Ring } from "../../../components/Ring";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SPRINGS, springAt } from "../../../motion";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { Leg4, Magnifier } from "../Pictos";

/** Gancho: 91,4 % gigante con anillo, la revisión lo atribuye al test del 4, y «no es lo que parece». */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const n0 = Math.max(0, s0.start - 4);
  const nEnd = wordEnd(s0, "ciento");
  const rev = wordAt(s1, "revisión");
  const cuatro = wordAt(s1, "cuatro");
  const orig = wordAt(s2, "original");
  const parece = wordAt(s2, "parece");
  const p = springAt(frame, n0, SPRINGS.counter);
  const value = (DATA.faber * Math.min(1, interpolate(frame, [n0, nEnd], [0, 1], CLAMP))).toFixed(1).replace(".", ",");
  const doubt = frame >= parece;
  return (
    <Punch dur={c.dur} shakeAt={[nEnd, parece]} amount={0.8}>
      <Stage gap={20} justify="flex-start">
        {/* Fila superior: revisión + test del 4 */}
        <div style={{ display: "flex", alignItems: "center", gap: 34, height: 220, marginTop: 6 }}>
          <div style={{ padding: "22px 34px", borderRadius: 24, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= rev ? 1 : 0, scale: String(pop(frame, rev)), textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.muted }}>REVISIÓN</div>
            <div style={{ fontWeight: 900, fontSize: 76, color: COLORS.cyan, lineHeight: 1 }}>2024</div>
            <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.ink }}>Life · Custers</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: frame >= cuatro ? 1 : 0 }}>
            <Leg4 at={cuatro} size={340} />
            <div style={{ fontWeight: 900, fontSize: 36, color: COLORS.orange, scale: String(pop(frame, cuatro + 4)) }}>TEST DEL 4 · FABER</div>
          </div>
        </div>
        {/* Dato */}
        <div style={{ position: "relative", width: 500, height: 500, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= n0 ? 1 : 0, scale: String(0.7 + 0.3 * springAt(frame, n0, SPRINGS.smooth)) }}>
          <Ring size={500} progress={p * (DATA.faber / 100)} color={doubt ? COLORS.red : COLORS.orange} />
          <div style={{ fontWeight: 900, fontSize: 156, letterSpacing: -6, color: doubt ? COLORS.red : COLORS.orange, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {value}
            <span style={{ fontSize: 84, marginLeft: 6 }}>{doubt ? "%?" : "%"}</span>
          </div>
          {frame >= orig ? <Magnifier at={orig} size={220} x={300} y={280} /> : null}
        </div>
        {frame >= parece ? (
          <div style={{ marginTop: -30, rotate: "-4deg" }}>
            <Slam text="NO ES LO QUE PARECE" at={parece} size={70} color={COLORS.red} />
          </div>
        ) : null}
      </Stage>
    </Punch>
  );
};
