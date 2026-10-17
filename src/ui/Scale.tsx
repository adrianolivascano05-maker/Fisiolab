import { useId } from "react";
import { cx } from "./cx";

type ScaleProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  lowLabel: string;
  highLabel: string;
};

/** Escala 1-5 del cuestionario de bienestar. Radios nativos: flechas del teclado y lector de pantalla gratis. */
export function Scale({ label, value, onChange, min = 1, max = 5, lowLabel, highLabel }: ScaleProps) {
  const name = useId();
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((n) => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span
              className={cx(
                "tap nums flex items-center justify-center rounded-md border text-base font-semibold",
                "border-border-input bg-bg text-text peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              )}
            >
              {n}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}
