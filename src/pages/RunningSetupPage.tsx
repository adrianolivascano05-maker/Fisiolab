import { CircleQuestionMark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import type { Side } from "../data/repo";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { SpeedHelp } from "./SpeedHelp";

/** S18 Carrera: velocidad de la cinta y con qué pie es el primer apoyo; después, el vídeo. */
export function RunningSetupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [speed, setSpeed] = useState("");
  const [first, setFirst] = useState<Side>("left");
  const [error, setError] = useState<string>();
  const [help, setHelp] = useState(false);

  function next(e: FormEvent) {
    e.preventDefault();
    const v = parseDecimal(speed);
    if (v !== null && (Number.isNaN(v) || v <= 0 || v > 40)) {
      setError("Escribe la velocidad en km/h (1-40) o déjala vacía.");
      return;
    }
    const q = new URLSearchParams({ tipo: "running", pie: first });
    if (v !== null) q.set("velocidad", String(v));
    navigate(`/pacientes/${id}/test/carrera/video?${q}`);
  }

  return (
    <Page title="Carrera" backTo={`/pacientes/${id}/test`}>
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <NumberField
          label="Velocidad de la cinta (opcional)"
          unit="km/h"
          value={speed}
          onChange={(e) => {
            setSpeed(e.target.value);
            setError(undefined);
          }}
          error={error}
          hint="Con ella se calcula la longitud del paso."
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Primer apoyo que vas a marcar</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["left", "right"] as const).map((s) => (
              <label key={s} className="relative">
                <input type="radio" name="pie" value={s} checked={first === s} onChange={() => setFirst(s)} className="peer sr-only" />
                <span
                  className={cx(
                    "tap flex items-center justify-center rounded-md border font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                    first === s ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
                  )}
                >
                  {s === "left" ? "Pie izquierdo" : "Pie derecho"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
          Cómo grabar y marcar
        </Button>
        <Button type="submit" size="lg" block>
          Continuar
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title="Cómo grabar y marcar la carrera">
        <SpeedHelp type="running" />
      </Sheet>
    </Page>
  );
}
