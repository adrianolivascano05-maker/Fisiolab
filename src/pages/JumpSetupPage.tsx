import { CircleQuestionMark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import type { JumpType } from "../calc/results";
import { jumpLabels, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { getDb } from "../data/db";
import { createHorizontalTest, type Side } from "../data/repo";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { JumpHelp } from "./JumpHelp";

const types: JumpType[] = ["cmj", "sj", "dj", "cmj_arms", "single_leg", "rj_10_5", "horizontal"];
const detail: Record<JumpType, string> = {
  cmj: "Bajar y subir sin pausa, manos en la cintura.",
  cmj_arms: "Como el CMJ, pero con impulso libre de brazos.",
  sj: "Desde sentadilla a 90°, quieto 2-3 s, sin rebote.",
  dj: "Caer de un cajón y rebotar lo más rápido y alto posible.",
  single_leg: "CMJ apoyando una sola pierna. Mide las dos para ver la asimetría.",
  rj_10_5: "10 rebotes seguidos, con el mínimo contacto y la máxima altura.",
  horizontal: "Salto hacia delante a pies juntos. Se mide con cinta métrica, sin vídeo.",
};

/** S05 Configuración del test de salto */
export function JumpSetupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<JumpType>("cmj");
  const [load, setLoad] = useState("");
  const [drop, setDrop] = useState("");
  const [side, setSide] = useState<Side>("left");
  const [distance, setDistance] = useState("");
  const [errors, setErrors] = useState<{ load?: string; drop?: string; distance?: string }>({});
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  const usesLoad = type === "cmj" || type === "sj";

  async function next(e: FormEvent) {
    e.preventDefault();
    const l = usesLoad ? (parseDecimal(load) ?? 0) : 0;
    const d = parseDecimal(drop);
    const dist = parseDecimal(distance);
    const errs: typeof errors = {};
    if (Number.isNaN(l) || l < 0 || l > 300) errs.load = "La carga debe estar entre 0 y 300 kg.";
    if (type === "dj" && (d === null || Number.isNaN(d) || d <= 0 || d > 150)) errs.drop = "Indica la altura del cajón (1-150 cm).";
    if (type === "horizontal" && (dist === null || Number.isNaN(dist) || dist <= 0 || dist >= 500)) {
      errs.distance = "Indica la distancia en centímetros (1-499).";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (type === "horizontal") {
      setSaving(true);
      try {
        const testId = await createHorizontalTest(getDb(), id, dist!);
        navigate(`/tests/${testId}`, { replace: true });
      } catch (err) {
        toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
        setSaving(false);
      }
      return;
    }
    const q = new URLSearchParams({ tipo: type, carga: String(l) });
    if (type === "dj" && d) q.set("caida", String(d));
    if (type === "single_leg") q.set("lado", side);
    navigate(`/pacientes/${id}/test/saltos/video?${q}`);
  }

  return (
    <Page title="Saltos" backTo={`/pacientes/${id}/test`} tabs={false}>
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
        {usesLoad && (
          <NumberField
            label="Carga extra"
            unit="kg"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            error={errors.load}
            hint="Déjalo vacío si salta sin peso. Con 2 o más cargas distintas se puede hacer el perfil fuerza-velocidad."
          />
        )}
        {type === "single_leg" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Pierna de apoyo</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["left", "right"] as const).map((s) => (
                <label key={s} className="relative">
                  <input type="radio" name="lado" value={s} checked={side === s} onChange={() => setSide(s)} className="peer sr-only" />
                  <span
                    className={cx(
                      "tap flex items-center justify-center rounded-md border font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                      side === s ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
                    )}
                  >
                    {s === "left" ? "Izquierda" : "Derecha"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {type === "horizontal" && (
          <NumberField
            label="Distancia"
            unit="cm"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            error={errors.distance}
            hint="De la línea de salida al talón más retrasado al caer."
          />
        )}

        {type !== "horizontal" && (
          <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
            Cómo grabar y marcar
          </Button>
        )}
        <Button type="submit" size="lg" block loading={saving}>
          {type === "horizontal" ? "Guardar salto" : "Continuar"}
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title={`Cómo medir un ${jumpLabels[type].short}`}>
        <JumpHelp type={type} />
      </Sheet>
    </Page>
  );
}
