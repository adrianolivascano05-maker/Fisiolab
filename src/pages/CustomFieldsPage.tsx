// Ajustes → Anamnesis de la clínica (src/data/customFields.ts): las preguntas propias que la clínica añade a cada
// apartado de la anamnesis, y paquetes de ejemplo por especialidad para empezar. Las ve y usa todo el equipo.
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash } from "lucide-react";
import { useState } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { ANAMNESIS } from "../clinical/anamnesis";
import { addCustomPack, CUSTOM_PACKS, CUSTOM_TYPES, getCustomFields, newCustomId, saveCustomFields, type CustomField, type CustomFieldType } from "../data/customFields";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { TextArea } from "../clinical/parts";

const sectionTitle = (id: string) => ANAMNESIS.find((s) => s.id === id)?.title.replace(/^\d+\.\s*/, "") ?? id;
const typeLabel = (t: CustomFieldType) => CUSTOM_TYPES.find((x) => x.id === t)?.label ?? t;

export function CustomFieldsPage() {
  const toast = useToast();
  const version = useDataVersion();
  const data = useAsync(() => getCustomFields(getDb()), [version]);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const fields = data.data ?? [];

  async function save(next: CustomField[], done: string) {
    await saveCustomFields(getDb(), next);
    bumpData();
    toast(done, "success");
  }
  const move = (f: CustomField, by: -1 | 1) => {
    const same = fields.filter((x) => x.section === f.section);
    const i = same.findIndex((x) => x.id === f.id);
    const other = same[i + by];
    if (!other) return;
    const a = fields.indexOf(f);
    const b = fields.indexOf(other);
    const next = [...fields];
    [next[a], next[b]] = [next[b]!, next[a]!];
    void save(next, "Orden cambiado");
  };

  return (
    <Page title="Anamnesis de la clínica" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Añade tus propias preguntas a la anamnesis: salen al final de su apartado, para todo el equipo y en el informe. Quitar una no borra lo que ya se respondió.
      </p>
      <Button icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setEditing({ id: newCustomId(), section: "motivo", label: "", type: "text" })}>
        Añadir una pregunta
      </Button>

      {ANAMNESIS.filter((s) => fields.some((f) => f.section === s.id)).map((s) => (
        <section key={s.id} aria-labelledby={`h-cf-${s.id}`} className="flex flex-col gap-2">
          <h2 id={`h-cf-${s.id}`} className="text-lg">
            {sectionTitle(s.id)}
          </h2>
          <ul aria-label={`Preguntas propias: ${sectionTitle(s.id)}`} className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
            {fields
              .filter((f) => f.section === s.id)
              .map((f, i, same) => (
                <li key={f.id} className="flex items-center gap-1 py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{f.label}</span>
                    <span className="block text-sm text-text-muted">
                      {typeLabel(f.type)}
                      {f.options?.length ? `: ${f.options.join(", ")}` : ""}
                    </span>
                  </span>
                  <button type="button" aria-label={`Subir ${f.label}`} disabled={i === 0} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface disabled:opacity-30" onClick={() => move(f, -1)}>
                    <ArrowUp aria-hidden="true" className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar ${f.label}`}
                    disabled={i === same.length - 1}
                    className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface disabled:opacity-30"
                    onClick={() => move(f, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-5" />
                  </button>
                  <button type="button" aria-label={`Cambiar ${f.label}`} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface" onClick={() => setEditing(f)}>
                    <Pencil aria-hidden="true" className="size-5" />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {data.data && !fields.length && <p className="text-sm text-text-muted">Todavía no hay preguntas propias.</p>}

      <section aria-labelledby="h-cf-paquetes" className="flex flex-col gap-2">
        <h2 id="h-cf-paquetes" className="text-lg">
          Para empezar, por especialidad
        </h2>
        <p className="text-sm text-text-muted">Unas preguntas habituales de ejemplo; después cámbialas o quita las que no uses.</p>
        <div className="flex flex-wrap gap-2">
          {CUSTOM_PACKS.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              icon={<Sparkles aria-hidden="true" className="size-5" />}
              onClick={async () => {
                const n = await addCustomPack(getDb(), p.id);
                bumpData();
                toast(n ? `${p.title}: ${n === 1 ? "1 pregunta añadida" : `${n} preguntas añadidas`}` : `${p.title}: ya estaban`, "success");
              }}
            >
              {p.title}
            </Button>
          ))}
        </div>
      </section>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && fields.some((f) => f.id === editing.id) ? "Cambiar la pregunta" : "Nueva pregunta"}>
        {editing && (
          <FieldForm
            initial={editing}
            exists={fields.some((f) => f.id === editing.id)}
            onSave={async (f) => {
              const exists = fields.some((x) => x.id === f.id);
              await save(exists ? fields.map((x) => (x.id === f.id ? f : x)) : [...fields, f], exists ? "Pregunta cambiada" : "Pregunta añadida a la anamnesis");
              setEditing(null);
            }}
            onDelete={async () => {
              await save(
                fields.filter((x) => x.id !== editing.id),
                "Pregunta quitada (lo respondido se guarda)",
              );
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

function FieldForm({ initial, exists, onSave, onDelete }: { initial: CustomField; exists: boolean; onSave: (f: CustomField) => Promise<void>; onDelete: () => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [options, setOptions] = useState((initial.options ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const withOptions = f.type === "choice" || f.type === "multi";
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await onSave({ ...f, options: withOptions ? options.split("\n") : undefined });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <SelectField label="Apartado" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
        {ANAMNESIS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </SelectField>
      <TextField label="Pregunta" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Por ejemplo: Horas sentado al día" />
      <SelectField label="Respuesta" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomFieldType })}>
        {CUSTOM_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </SelectField>
      {withOptions && <TextArea label="Opciones (una por línea)" value={options} rows={4} onChange={setOptions} />}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block>
        Guardar
      </Button>
      {exists && (
        <Button variant="ghost" className="text-danger" block icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => void onDelete()}>
          Quitar la pregunta
        </Button>
      )}
    </form>
  );
}
