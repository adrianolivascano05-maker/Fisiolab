import { useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";

/** Matiz: lo útil del estudio — según los autores, un test suelto vale poco; la batería, más. */
export const Matiz: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0] = c.s;
  const aut = wordAt(s0, "útil");
  const suelto = wordAt(s0, "suelto");
  const poco = wordAt(s0, "poco");
  const bat = wordAt(s0, "batería");
  const mas = wordAt(s0, "más");
  return (
    <Punch dur={c.dur} shakeAt={[mas]} amount={0.5}>
      <Stage gap={34} justify="flex-start">
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 34, letterSpacing: 6, color: COLORS.muted, opacity: frame >= aut ? 1 : 0 }}>LO ÚTIL · SEGÚN LOS AUTORES</div>
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: frame >= suelto ? 1 : 0, scale: String(pop(frame, suelto)) }}>
          <div style={{ padding: "18px 30px", borderRadius: 16, fontWeight: 800, fontSize: 52, color: COLORS.ink, backgroundColor: COLORS.paper, border: `2px solid ${COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= poco ? 0.45 : 1 }}>1 test</div>
          <div style={{ fontWeight: 900, fontSize: 64, color: COLORS.red, opacity: frame >= poco ? 1 : 0 }}>vale poco</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: frame >= bat ? 1 : 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 280px)", gap: 12 }}>
            {DATA.tests.map((t, i) => (
              <div key={t} style={{ padding: "14px 0", borderRadius: 16, textAlign: "center", fontWeight: 800, fontSize: 32, color: COLORS.ink, backgroundColor: COLORS.paper, border: `2px solid ${frame >= mas ? COLORS.green : COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= bat + i * 2 ? 1 : 0, scale: String(pop(frame, bat + i * 2)) }}>
                {t}
              </div>
            ))}
          </div>
          {frame >= mas ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Check size={80} start={mas} />
              <Slam text="LA BATERÍA, MÁS" at={mas} size={64} color={COLORS.green} />
            </div>
          ) : null}
        </div>
      </Stage>
    </Punch>
  );
};
