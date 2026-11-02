import { useCurrentFrame } from "remotion";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { RangeBar } from "../../kemp/Pictos";
import { DATA } from "../config";
import { LegRaise, RuleCard } from "../Pictos";

const fmt = (v: number) => (v === 1 ? "1" : v.toFixed(2).replace(".", ","));

/** Giro: el cruzado es al revés — se eleva la pierna sana y duele la otra; especificidad hasta 0,98; muy específico + positivo = confirma. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1, s2] = c.s;
  const cruz = wordAt(s0, "cruzado");
  const lev = wordAt(s0, "levantas");
  const otra = wordAt(s0, "otra");
  const esp = wordAt(s1, "especificidad");
  const max = wordAt(s1, "cero");
  const espec = wordAt(s2, "específico");
  const pos = wordAt(s2, "positivo");
  const conf = wordAt(s2, "confirma");
  return (
    <Punch dur={c.dur} shakeAt={[otra, conf]} amount={0.6}>
      <Stage gap={20} justify="flex-start">
        <div style={{ marginTop: 6 }}>
          <Slam text="LASÈGUE CRUZADO" at={cruz} size={76} color={COLORS.cyan} />
        </div>
        {frame >= lev ? <LegRaise at={lev} size={380} mode="cruzado" painAt={otra} /> : null}
        <div style={{ height: 24 }} />
        {frame >= esp ? <RangeBar label="Especificidad" at={esp} min={DATA.cruzado.spec.min} max={DATA.cruzado.spec.max} minAt={max - 6} maxAt={max} color={COLORS.cyan} fmt={fmt} width={880} /> : null}
        {frame >= espec ? <RuleCard at={espec} quality="MUY ESPECÍFICO" result="POSITIVO" verdict="CONFIRMA" color={COLORS.cyan} stepAt={[espec, pos, conf]} /> : null}
      </Stage>
    </Punch>
  );
};
