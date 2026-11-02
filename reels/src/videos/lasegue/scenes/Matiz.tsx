import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Magnifier } from "../../sacroiliaca/Pictos";

const Row: React.FC<{ test: string; says: string; real: string; at: number; swapAt: number; color: string }> = ({ test, says, real, at, swapAt, color }) => {
  const frame = useCurrentFrame();
  const sw = interpolate(frame, [swapAt, swapAt + 12], [0, 1], CLAMP);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, width: 920, padding: "30px 30px", borderRadius: 24, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at)) }}>
      <div style={{ width: 230, fontWeight: 900, fontSize: 52, color: COLORS.ink }}>{test}</div>
      <div style={{ position: "relative", flex: 1, height: 110 }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", fontWeight: 800, fontSize: 42, lineHeight: 1.15, color: COLORS.red, opacity: 1 - sw, translate: `0px ${-30 * sw}px` }}>
          revisión: «{says}»
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", fontWeight: 900, fontSize: 54, color, opacity: sw, translate: `0px ${30 * (1 - sw)}px` }}>
          números: {real}
        </div>
      </div>
    </div>
  );
};

/** Matiz: la revisión lo escribe al revés (se ve su frase y se gira a lo que dicen sus números). Lección: lee los números. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rev = wordAt(s0, "revisión");
  const reves = wordAt(s0, "revés");
  const num = wordAt(s1, "números");
  const concl = wordAt(s1, "conclusión");
  return (
    <Punch dur={c.dur} shakeAt={[reves]} amount={0.6}>
      <Stage gap={26} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="AL REVÉS" at={reves} size={110} color={COLORS.red} spacing={-3} />
        </div>
        <Row test="Lasègue" says="sirve para confirmar" real="descarta si −" at={rev} swapAt={reves + 4} color={COLORS.green} />
        <Row test="Cruzado" says="sirve para descartar" real="confirma si +" at={rev + 6} swapAt={reves + 10} color={COLORS.cyan} />
        <div style={{ position: "relative", height: 260, width: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: frame >= num ? 1 : 0 }}>
          <Magnifier at={num} size={220} x={60} y={20} />
          <div style={{ marginLeft: 200, fontWeight: 900, fontSize: 56, color: COLORS.ink, lineHeight: 1.1 }}>
            lee los <span style={{ color: COLORS.orange }}>números</span>
            <div style={{ fontSize: 40, color: COLORS.muted, opacity: frame >= concl ? 1 : 0 }}>no solo la conclusión</div>
          </div>
        </div>
      </Stage>
    </Punch>
  );
};
