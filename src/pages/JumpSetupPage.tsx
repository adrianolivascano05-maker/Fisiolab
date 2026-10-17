import { CircleQuestionMark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import type { JumpType } from "../calc/results";
import { jumpLabels, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { JumpHelp } from "./JumpHelp";

const types: JumpType[] = ["cmj", "sj", "dj"];
const detail: Record<JumpType, string> = {
  cmj: "Bajar y subir sin pausa, manos en la cintura.",
  sj: "Desde sentadilla a 90°, quieto 2-3 s, sin rebote.",
  dj: "Caer de un cajón y rebotar lo más rápido y alto posible.",
};

/** S05 Configuración del test de salto */
export function JumpSetupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [type, setType] = useState<JumpType>("cmj");
  const [load, setLoad] = useState("");
  const [drop, setDrop] = useState("");
  const [errors, setErrors] = useState<{ load?: string; drop?: string }>({});
  const [help, setHelp] = useState(false);

  function next(e: FormEvent) {
    e.preventDefault();
    const l = parseDecimal(load) ?? 0;
    const d = parseDecimal(drop);
    const errs: typeof errors = {};
    if (Number.isNaN(l) || l < 0 || l > 300) errs.load = "La carga debe estar entre 0 y 300 kg.";
    if (type === "dj" && (d === null || Number.isNaN(d) || d <= 0 || d > 150)) errs.drop = "Indica la altura del cajón (1-150 cm).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const q = new URLSearchParams({ tipo: type, carga: String(l) });
    if (type === "dj" && d) q.set("caida", String(d));
    navigate(`/pacientes/${id}/test/saltos/video?${q}`);
  }

  return (
    <Page title="Saltos" backTo={`/pacientes/${id}/test`}>
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Tipo de salto</legend>
          {types.map((t) => (
            <label key={t} className="relative">
              <input type="radio" name="tipo" value={t} checked={type === t} onChange={() => setType(t)} className="peer sr-only" />
              <span
                className={cx(
                  "flex flex-col rounded-lg border p-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                  type === t ? "border-accent bg-accent-soft" : "border-border bg-bg",
                )}
              >
                <span className="font-semibold">{jumpLabels[t].long}</span>
                <span className="text-sm text-text-muted">{detail[t]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {type === "dj" && <NumberField label="Altura del cajón" unit="cm" value={drop} onChange={(e) => setDrop(e.target.value)} error={errors.drop} />}
        {type !== "dj" && (
          <NumberField
            label="Carga extra"
            unit="kg"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            error={errors.load}
            hint="Déjalo vacío si salta sin peso. Se usa para el perfil fuerza-velocidad."
          />
        )}
        <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
          Cómo grabar y marcar
        </Button>
        <Button type="submit" size="lg" block>
          Continuar
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title={`Cómo medir un ${jumpLabels[type].short}`}>
        <JumpHelp type={type} />
      </Sheet>
    </Page>
  );
}
