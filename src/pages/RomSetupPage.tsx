import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getMovement, jointLabels, movements, type RomJoint } from "../calc/rom";
import { Page } from "../app/Page";
import type { Side } from "../data/repo";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";

const joints = Object.keys(jointLabels) as RomJoint[];
const option = (on: boolean) =>
  cx(
    "flex rounded-lg border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
    on ? "border-accent bg-accent-soft" : "border-border bg-bg",
  );

/** S19 Movilidad: elegir articulación, movimiento y lado. */
export function RomSetupPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = getMovement(params.get("mov") ?? "") ?? movements[0]!;
  const [joint, setJoint] = useState<RomJoint>(initial.joint);
  const [movementId, setMovementId] = useState(initial.id);
  const [side, setSide] = useState<Side>(params.get("lado") === "right" ? "right" : "left");
  const options = movements.filter((m) => m.joint === joint);
  const movement = getMovement(movementId)!;

  function next(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ mov: movement.id });
    if (movement.sided) q.set("lado", side);
    navigate(`/pacientes/${id}/test/movilidad/medir?${q}`);
  }

  return (
    <Page title="Movilidad" backTo={`/pacientes/${id}/test`}>
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Articulación</legend>
          <div className="grid grid-cols-2 gap-2">
            {joints.map((j) => (
              <label key={j} className="relative">
                <input
                  type="radio"
                  name="articulacion"
                  value={j}
                  checked={joint === j}
                  onChange={() => {
                    setJoint(j);
                    setMovementId(movements.find((m) => m.joint === j)!.id);
                  }}
                  className="peer sr-only"
                />
                <span className={cx(option(joint === j), "tap items-center justify-center font-semibold")}>{jointLabels[j]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Movimiento</legend>
          {options.map((m) => (
            <label key={m.id} className="relative">
              <input type="radio" name="movimiento" value={m.id} checked={movementId === m.id} onChange={() => setMovementId(m.id)} className="peer sr-only" />
              <span className={cx(option(movementId === m.id), "flex-col")}>
                <span className="font-semibold">{m.label}</span>
                <span className="text-sm text-text-muted">{m.position.split(". ")[0]}.</span>
              </span>
            </label>
          ))}
        </fieldset>

        {movement.sided && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Lado</legend>
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
                    {s === "left" ? "Izquierdo" : "Derecho"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Button type="submit" size="lg" block>
          Continuar
        </Button>
      </form>
    </Page>
  );
}
