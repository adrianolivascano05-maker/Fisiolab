import { useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { TendonScan } from "../Pictos";

/** Qué hacer: antes de mirar una ecografía, pregunta cuándo fue la última carga alta; el día 2 y el día 4 no muestran el mismo tendón. */
export const QueHacer: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const preg = wordAt(s0, "pregunta");
  const carga = wordAt(s0, "carga");
  const d2 = wordAt(s1, "dos");
  const d4 = wordAt(s1, "cuatro");
  const mismo = wordAt(s1, "mismo");
  return (
    <Punch dur={c.dur} shakeAt={[mismo]} amount={0.4}>
      <Stage gap={26} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="MAÑANA EN CONSULTA" at={s0.start} size={62} color={COLORS.ink} />
        </div>
        <div style={{ width: 900, padding: "26px 34px", borderRadius: 26, backgroundColor: COLORS.paper, border: `2px solid ${frame >= carga ? COLORS.orange : COLORS.line}`, boxShadow: STICKER, opacity: frame >= preg ? 1 : 0, scale: String(pop(frame, preg)) }}>
          <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.muted }}>ANTES DE MIRAR LA ECO</div>
          <div style={{ fontWeight: 900, fontSize: 50, color: COLORS.ink, marginTop: 6 }}>
            última carga alta: <span style={{ color: COLORS.orange, opacity: frame >= carga ? 1 : 0 }}>hace ___ días</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
          <TendonScan at={d2} width={430} swell={1} label="DÍA 2" labelColor={COLORS.orange} />
          <TendonScan at={d4} width={430} swell={0} label="DÍA 4" labelColor={COLORS.green} />
        </div>
        {frame >= mismo ? <Slam text="NO ES EL MISMO TENDÓN" at={mismo} size={58} color={COLORS.ink} /> : null}
      </Stage>
    </Punch>
  );
};
