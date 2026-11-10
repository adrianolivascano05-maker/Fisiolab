// «Base · Ampliada»: la anamnesis corta (lo mínimo) o entera. Lo usan la ficha (src/clinical/AnamnesisPage.tsx) y el
// envío al paciente (src/patientForm/SendFormsPage.tsx).
import { cx } from "../ui/cx";

export function LevelSwitch({ wide, onChange, base, full, label = "Anamnesis" }: { wide: boolean; onChange: (wide: boolean) => void; base: string; full: string; label?: string }) {
  const item = (on: boolean, title: string, detail: string) => (
    <button
      type="button"
      aria-pressed={wide === on}
      onClick={() => onChange(on)}
      className={cx(
        "flex min-h-12 flex-1 flex-col items-center justify-center rounded-md px-3 py-1 text-sm leading-tight font-semibold",
        wide === on ? "bg-accent text-on-accent" : "text-text hover:bg-bg",
      )}
    >
      {title}
      <span className={cx("text-xs font-normal", wide === on ? "text-on-accent" : "text-text-muted")}>{detail}</span>
    </button>
  );
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-lg border border-border bg-surface p-1">
      {item(false, "Base", base)}
      {item(true, "Ampliada", full)}
    </div>
  );
}
