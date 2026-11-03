import { interpolate, useCurrentFrame } from "remotion";
import { Check } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { CaseFile, WristHand } from "../Pictos";

/** Gancho: paciente con fibromialgia y dolor en la muñeca → encaja con un túnel carpiano → ¿caso cerrado? */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const fib = wordAt(s0, "fibromialgia");
  const mun = wordAt(s0, "muñeca");
  const tun = wordAt(s1, "túnel");
  const cerr = wordAt(s2, "cerrado");
  const pain = interpolate(frame, [mun - 2, mun + 10], [0, 1], CLAMP);
  const showFile = frame >= tun;
  return (
    <Punch dur={c.dur} shakeAt={[mun, cerr]} amount={0.6}>
      <Stage gap={24} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4, padding: "14px 30px", borderRadius: 999, backgroundColor: COLORS.paper, border: `3px solid ${COLORS.orange}`, boxShadow: STICKER_SM, opacity: frame >= fib ? 1 : 0, scale: String(pop(frame, fib)) }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: COLORS.orange }} />
          <span style={{ fontWeight: 900, fontSize: 46, color: COLORS.ink }}>
            Paciente con <span style={{ color: COLORS.orange }}>fibromialgia</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ translate: `${interpolate(frame, [tun, tun + 12], [200, 0], { ...CLAMP })}px 0px` }}>
            <WristHand at={Math.max(0, s0.start - 2)} size={showFile ? 300 : 340} pain={pain} tunnel={interpolate(frame, [tun, tun + 8], [0, 1], CLAMP)} nerve={interpolate(frame, [tun + 4, tun + 20], [0, 1], CLAMP)} />
          </div>
          {showFile ? (
            <div style={{ position: "relative" }}>
              <CaseFile at={tun} stampAt={cerr} width={400} />
              {frame < cerr ? (
                <div style={{ position: "absolute", right: 24, bottom: 18 }}>
                  <Check size={90} start={wordAt(s1, "carpiano") + 4} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div style={{ height: 110, display: "flex", alignItems: "center" }}>
          {frame >= cerr ? <Slam text="¿CASO CERRADO?" at={cerr} size={86} color={COLORS.red} /> : frame >= tun ? <Slam text="ENCAJA" at={tun} size={76} color={COLORS.ink} /> : frame >= mun ? <Slam text="LE DUELE LA MUÑECA" at={mun} size={64} color={COLORS.ink} /> : null}
        </div>
      </Stage>
    </Punch>
  );
};
