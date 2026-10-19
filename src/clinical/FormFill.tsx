// Un cuestionario entero para rellenar en la app: sus apartados, cada pregunta con sus respuestas y, al final, la
// nota calculada con su regla (src/clinical/forms). Se puede dejar a medias: la nota sale en cuanto se puede calcular.
import { useId } from "react";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import type { Answers, FormScore, Item, QuestionForm } from "./forms";
import { NumberScale } from "./parts";

/** La nota, o por qué todavía no se puede calcular. */
export function formResult(form: QuestionForm, answers: Answers): { ok: FormScore } | { missing: string } {
  try {
    return { ok: form.score(answers) };
  } catch (e) {
    return { missing: e instanceof Error ? e.message : String(e) };
  }
}

const choiceClass = cx(
  "flex min-h-11 items-center rounded-md border px-3 py-2 text-left",
  "border-border-input bg-bg text-text peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
);

function Question({ n, item, value, compact, onChange }: { n: number; item: Item; value: number | null | undefined; compact: boolean; onChange: (v: number | null | undefined) => void }) {
  const name = useId();
  const label = `${n}. ${item.text}`;
  const na = item.na && (
    <label className="relative self-start">
      <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : undefined)} className="peer sr-only" />
      <span className={cx(choiceClass, "min-h-9 text-sm")}>No aplica</span>
    </label>
  );
  if (item.scale)
    return (
      <div className="flex flex-col gap-2">
        <NumberScale label={label} from={item.scale.from} to={item.scale.to} ends={item.scale.ends} value={typeof value === "number" ? value : null} onChange={(v) => onChange(v ?? undefined)} />
        {na}
      </div>
    );
  const options = item.options ?? [];
  // En las hojas de respuestas, solo números en fila; los extremos dicen qué es cada uno.
  if (compact) {
    const end = (i: number) => options[i]?.label.replace(/^\S+ · /, "") ?? "";
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{label}</legend>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
          {options.map((o) => (
            <label key={o.value} className="relative">
              <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" aria-label={o.label} />
              <span className={cx(choiceClass, "tap nums justify-center px-0 font-semibold")}>{o.value}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-between gap-2 text-xs text-text-muted">
          <span>{end(0)}</span>
          <span className="text-right">{end(options.length - 1)}</span>
        </div>
        {na}
      </fieldset>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">{label}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label key={`${o.value}-${o.label}`} className="relative">
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span className={choiceClass}>{o.label}</span>
          </label>
        ))}
        {na}
      </div>
    </fieldset>
  );
}

export function FormFill({ form, answers, onChange }: { form: QuestionForm; answers: Answers; onChange: (a: Answers) => void }) {
  const all = form.sections.flatMap((s) => s.items);
  const done = all.filter((i) => i.id in answers).length;
  const set = (id: string, v: number | null | undefined) => {
    const next = { ...answers };
    if (v === undefined) delete next[id];
    else next[id] = v;
    onChange(next);
  };
  let n = 0;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p>{form.instructions}</p>
        <p className="text-xs text-text-muted">{form.source}</p>
      </Card>
      {form.sections.map((s) => (
        <section key={s.title} aria-label={s.title} className="flex flex-col gap-3">
          <h2 className="text-lg">{s.title}</h2>
          {s.intro && <p className="-mt-2 text-sm text-text-muted">{s.intro}</p>}
          {s.items.map((item) => {
            n += 1;
            return (
              <Card key={item.id}>
                <Question n={n} item={item} value={answers[item.id]} compact={!!form.sheet} onChange={(v) => set(item.id, v)} />
              </Card>
            );
          })}
        </section>
      ))}
      <p className="nums text-sm text-text-muted" aria-live="polite">
        Respondidas {done} de {all.length}
      </p>
    </div>
  );
}
