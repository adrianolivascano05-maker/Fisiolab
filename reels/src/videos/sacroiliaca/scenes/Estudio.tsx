import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { DATA } from "../config";
import { DotGrid } from "../Pictos";

/** Estudio: 117 pacientes ya diagnosticados; el diagnóstico = 3 de 6 tests positivos; y el test del 4 estaba en esa batería. */
export const Estudio: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const n0 = wordAt(s0, "ciento");
  const n1 = wordEnd(s0, "pacientes");
  const todos = wordAt(s0, "todos");
  const diag = wordAt(s0, "diagnosticados");
  const como = wordAt(s1, "cómo");
  const seis = wordAt(s1, "seis");
  const tres = wordAt(s1, "tres");
  const era = wordAt(s1, "sacroilíaca");
  const cuatro = wordAt(s2, "cuatro");
  const misma = wordAt(s2, "misma");
  const count = Math.round(interpolate(frame, [n0, n1], [0, DATA.pacientes], CLAMP));
  return (
    <Punch dur={c.dur} shakeAt={[diag, era, cuatro]} amount={0.5}>
      <Stage gap={14} justify="flex-start">
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 4, opacity: frame >= n0 ? 1 : 0 }}>
          <span style={{ fontWeight: 900, fontSize: 92, color: COLORS.orange, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</span>
          <span style={{ fontWeight: 800, fontSize: 48, color: COLORS.ink }}>pacientes</span>
        </div>
        <DotGrid n={DATA.pacientes} cols={13} from={n0} to={n1} tintAt={diag} size={26} gap={9} />
        <div style={{ fontWeight: 900, fontSize: 36, color: COLORS.paper, backgroundColor: COLORS.orange, padding: "10px 28px", borderRadius: 999, opacity: frame >= todos ? 1 : 0, scale: String(pop(frame, todos)) }}>TODOS YA DIAGNOSTICADOS</div>
        {/* Cómo se diagnosticaron: 3 de 6 tests positivos */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 2, opacity: frame >= como ? 1 : 0 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 280px)", gap: 12 }}>
            {DATA.tests.map((t, i) => {
              const on = i < DATA.criterio.pos && frame >= tres + i * 4;
              const at = seis + i * 2;
              const faber = i === 0 && frame >= cuatro;
              const pulse = faber ? 1 + 0.06 * Math.max(0, Math.sin((frame - cuatro) / 4)) : 1;
              return (
                <div key={t} style={{ position: "relative", padding: "10px 0", borderRadius: 14, textAlign: "center", fontWeight: 800, fontSize: 30, backgroundColor: on ? COLORS.green : COLORS.paper, color: on ? COLORS.paper : COLORS.ink, border: `${faber ? 5 : 2}px solid ${faber ? COLORS.orange : on ? COLORS.green : COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= at ? 1 : 0, scale: String(pop(frame, at) * pulse) }}>
                  {faber ? "TEST DEL 4" : t}
                </div>
              );
            })}
          </div>
          <div style={{ fontWeight: 900, fontSize: 42, color: COLORS.ink, opacity: frame >= era ? 1 : 0, scale: String(pop(frame, era)) }}>
            <span style={{ color: COLORS.green }}>3 o más</span> = sacroilíaca
          </div>
          {frame >= misma ? (
            <div style={{ fontWeight: 900, fontSize: 40, color: COLORS.paper, backgroundColor: COLORS.orange, padding: "8px 24px", borderRadius: 999, scale: String(pop(frame, misma)) }}>EL TEST DEL 4 ESTABA DENTRO</div>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
