import { useCurrentFrame } from "remotion";
import { Cross } from "../../../components/Icons";
import { Punch, Slam } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { COLORS } from "../../../config";
import { SceneProps, wordAt, wordEnd } from "../../../timeline";
import { RenewBar } from "../Pictos";

/** Giro: el colágeno apenas se renueva en el adulto; lo que cambia tan rápido no parecen ser las fibras. */
export const Giro: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const col = wordAt(s0, "colágeno");
  const apenas = wordAt(s0, "apenas");
  const rap = wordAt(s1, "rápido");
  const fibras = wordEnd(s1, "fibras");
  return (
    <Punch dur={c.dur} shakeAt={[apenas, fibras]} amount={0.5}>
      <Stage gap={50} justify="flex-start">
        <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: 6, color: COLORS.muted, marginTop: 10 }}>VELOCIDAD DE RENOVACIÓN</div>
        <RenewBar at={col - 10} label="Proteoglicanos" value={0.92} text="días" color={COLORS.cyan} />
        <RenewBar at={col} label="Colágeno" value={frame >= apenas ? 0.04 : 0} text={frame >= apenas ? "casi nada" : "…"} color={COLORS.red} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 20, opacity: frame >= rap ? 1 : 0 }}>
          <div style={{ position: "relative" }}>
            <svg width={360} height={200} viewBox="0 0 260 140">
              {[20, 45, 70, 95, 120].map((y) => (
                <path key={y} d={`M10 ${y} C 80 ${y - 8}, 180 ${y + 8}, 250 ${y}`} stroke={COLORS.ink} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.75} />
              ))}
            </svg>
            {frame >= fibras ? (
              <div style={{ position: "absolute", left: 100, top: 20 }}>
                <Cross size={160} start={fibras} />
              </div>
            ) : null}
          </div>
          <Slam text={"NO PARECEN\nLAS FIBRAS"} at={rap} size={60} color={COLORS.ink} />
        </div>
      </Stage>
    </Punch>
  );
};
