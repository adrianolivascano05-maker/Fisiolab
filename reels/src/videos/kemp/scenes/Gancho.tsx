import { interpolate, useCurrentFrame } from "remotion";
import { Cross } from "../../../components/Icons";
import { pop } from "../../../components/Pictograms";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { Clipboard, KempFigure } from "../Pictos";

/** Gancho: la figura hace el Kemp, se anota «facetario» y cae el «ni confirma ni descarta». */
export const Gancho: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const kemp = Math.max(0, wordAt(s0, "kemp") - 4);
  const pos = wordAt(s0, "positivo");
  const anotas = wordAt(s1, "anotas");
  const fac = wordAt(s1, "facetario");
  const conf = wordAt(s2, "confirma") - 2;
  const desc = wordAt(s2, "descarta") - 1;
  const shrink = interpolate(frame, [conf, conf + 8], [1, 0.72], CLAMP);
  return (
    <Punch shakeAt={[fac, conf, desc]} amount={1.2}>
      <Stage gap={0} justify="flex-start">
        <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 10, scale: String(shrink), transformOrigin: "top center" }}>
          <div style={{ position: "relative" }}>
            <KempFigure at={kemp} size={330} pain={frame >= pos ? 1 : 0} />
            {frame >= pos ? (
              <div style={{ position: "absolute", left: 210, top: 10, fontWeight: 900, fontSize: 44, color: COLORS.ink, backgroundColor: COLORS.orange, padding: "8px 22px", borderRadius: 999, boxShadow: `0 0 40px ${COLORS.orange}aa`, scale: String(pop(frame, pos)), rotate: "-8deg", whiteSpace: "nowrap" }}>
                KEMP +
              </div>
            ) : null}
          </div>
          <Clipboard at={anotas} width={430} lines={[{ text: "facetario", at: fac, color: COLORS.orange }]} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 20 }}>
          {frame < conf ? (
            <div style={{ fontWeight: 900, fontSize: 84, color: COLORS.white, textAlign: "center", opacity: interpolate(frame, [kemp, kemp + 6], [0, 1], CLAMP) }}>
              {frame >= anotas ? <span style={{ color: COLORS.orange }}>«FACETARIO»</span> : "KEMP POSITIVO"}
            </div>
          ) : null}
          {frame >= conf ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Slam text="NI CONFIRMA" at={conf} size={118} color={COLORS.white} spacing={-4} />
              <Cross size={110} start={conf + 4} />
            </div>
          ) : null}
          {frame >= desc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Slam text="NI DESCARTA" at={desc} size={118} color={COLORS.orange} glow spacing={-4} />
              <Cross size={110} start={desc + 4} />
            </div>
          ) : null}
        </div>
      </Stage>
      <div style={{ position: "absolute", inset: 0, backgroundColor: COLORS.red, opacity: interpolate(frame, [desc, desc + 1, desc + 8], [0, 0.15, 0], CLAMP) }} />
    </Punch>
  );
};
