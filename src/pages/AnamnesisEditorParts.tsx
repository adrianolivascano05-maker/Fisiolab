// Piezas del editor de Ajustes › Anamnesis de la clínica (src/pages/CustomFieldsPage.tsx): interruptor, chips de una
// elección, «Así se ve», las opciones de una pregunta, el apartado que se pliega y la fila de cada pregunta.
import { ChevronDown, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { whoOf, type Field, type Who } from "../clinical/anamnesis";
import { FieldInput } from "../clinical/FieldInput";
import { patientSections } from "../clinical/patientForms";
import { LIMITS, type EditorItem } from "../data/anamnesisTemplates";
import type { AnswerValue } from "../data/clinical";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";

export const WHO: { id: Who; label: string }[] = [
  { id: "clinician", label: "Tú" },
  { id: "patient", label: "Paciente" },
  { id: "both", label: "Los dos" },
];
export const whoText: Record<Who, string> = { clinician: "Solo tú", patient: "Paciente", both: "Los dos" };
export const TYPE_TEXT: Record<string, string> = {
  text: "Texto",
  textarea: "Texto largo",
  date: "Fecha",
  number: "Número",
  scale: "Escala de 0 a 10",
  choice: "Una opción",
  multi: "Varias opciones",
  yesno: "Sí/No",
  yesno_detail: "Sí/No con detalle",
  zones: "Zonas del cuerpo",
  cif: "Códigos de la CIF",
};
export const clean = (t: string) => t.replace(/^\d+\.\s*/, "");

/** Un interruptor de 44 px (role="switch"). */
export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill disabled:opacity-40"
    >
      <span aria-hidden="true" className={cx("relative inline-block h-7 w-11 rounded-pill transition-colors", on ? "bg-accent" : "bg-border-input")}>
        <span className={cx("absolute top-0.5 left-0 size-6 rounded-pill bg-bg shadow-card transition-transform", on ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/** Chips de una sola elección (tipo de pregunta, quién la contesta, apartado). */
export function Pick<T extends string>({ label, options, value, onChange, hint }: { label: string; options: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; hint?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", value === o.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-surface")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Chips de varias elecciones (destacar, las respuestas de una condición). */
export function PickMany({ label, options, value, onChange, hint }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", on ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-surface")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Un interruptor con su texto (dentro de las hojas). */
export function Toggle({ label, hint, on, onChange, disabled }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-sm text-text-muted">{hint}</span>}
      </span>
      <Switch on={on} label={label} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** «Así se ve»: la pregunta con el campo de verdad, para probarlo (no se guarda nada). */
export function Preview({ field }: { field: Field }) {
  const [v, setV] = useState<AnswerValue>(null);
  const patient = patientSections([{ id: "x", title: "x", fields: [field] }])[0]?.fields[0];
  return (
    <section aria-label="Así se ve" className="flex flex-col gap-3 rounded-md bg-surface p-3">
      <p className="text-sm font-semibold text-text-muted">Así se ve</p>
      <FieldInput field={field} value={v} onChange={setV} />
      {patient && patient.label !== field.label && <p className="text-sm text-text-muted">Al paciente: «{patient.label}»</p>}
    </section>
  );
}

// ---------- Opciones (añadir y retirar, nunca renombrar) ----------

const PRESETS: { label: string; options: string[] }[] = [
  { label: "Sí / No", options: ["Sí", "No"] },
  { label: "Derecho / Izquierdo / Los dos", options: ["Derecho", "Izquierdo", "Los dos"] },
  { label: "Nunca · A veces · A menudo · Siempre", options: ["Nunca", "A veces", "A menudo", "Siempre"] },
  { label: "Nada … Mucho (0-4)", options: ["0 Nada", "1 Poco", "2 Algo", "3 Bastante", "4 Mucho"] },
];

/** Las opciones de una pregunta: una fila por opción con «×» y «+ Otra opción». `locked`: las que ya existían
 * (se pueden retirar, no reescribir: lo respondido siempre significa lo que decía la opción). */
export function Options({ value, locked, onChange }: { value: string[]; locked: Set<string>; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">Opciones</legend>
      {!value.length && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => onChange(p.options)} className="min-h-11 rounded-pill border border-border-input bg-bg px-3 text-sm hover:bg-surface">
              {p.label}
            </button>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {value.map((o, i) => (
          <li key={o} className="flex items-center gap-1">
            {locked.has(o) ? (
              <span className="min-w-0 flex-1 rounded-md border border-border px-3 py-2">{o}</span>
            ) : (
              <input
                aria-label={`Opción ${i + 1}`}
                maxLength={LIMITS.label}
                value={o}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3"
              />
            )}
            <button type="button" aria-label={`Quitar la opción ${o}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface">
              <X aria-hidden="true" className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1">
        <input
          aria-label="Otra opción"
          placeholder="Otra opción"
          maxLength={LIMITS.label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3"
        />
        <Button variant="secondary" size="sm" icon={<Plus aria-hidden="true" className="size-4" />} onClick={add}>
          Añadir
        </Button>
      </div>
      {locked.size > 0 && <p className="text-sm text-text-muted">Las opciones ya guardadas no se reescriben: si no te vale una, quítala y añade otra. Lo ya respondido no cambia.</p>}
    </fieldset>
  );
}

/** Un apartado que se pliega: el título, lo que lleva y el contenido. */
export function Fold({ id, title, count, open, tag, children }: { id: string; title: string; count: string; open: boolean; tag?: string; children: ReactNode }) {
  return (
    <details id={id} open={open || undefined} className="group scroll-mt-20 rounded-lg border border-border bg-bg shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold break-words text-brand-ink">{title}</span>
          <span className="text-sm text-text-muted">
            {tag && <span className="font-semibold">{tag} · </span>}
            {count}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-3 sm:px-4">{children}</div>
    </details>
  );
}

/** La fila de una pregunta: su texto y, debajo, el tipo, quién la contesta y de dónde sale. */
export function Row({ item, moduleName, isNew }: { item: EditorItem; moduleName?: string; isNew?: boolean }) {
  const f = item.field;
  return (
    <>
      <span className={cx("flex items-center gap-1.5 font-semibold", item.hidden && "text-text-muted line-through decoration-1")}>
        {item.changed && <span aria-label="Cambiada" role="img" className="inline-block size-2 shrink-0 rounded-pill bg-accent" />}
        <span className="min-w-0 break-words">{f.label}</span>
      </span>
      <span className="text-sm text-text-muted">
        {TYPE_TEXT[f.type] ?? "Texto"} · {f.type === "cif" ? "Solo tú" : whoText[whoOf(f)]}
        {item.own ? " · propia" : ""}
        {moduleName ? ` · ${moduleName}` : ""}
        {f.required ? " · necesaria" : ""}
        {f.showIf ? " · con condición" : ""}
        {f.highlight?.length ? " · destaca" : ""}
        {item.hidden ? " · oculta" : ""}
        {isNew ? " · nueva" : ""}
      </span>
    </>
  );
}
