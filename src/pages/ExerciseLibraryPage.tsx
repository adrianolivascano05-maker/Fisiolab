// Ajustes → Biblioteca de ejercicios (src/data/exercises.ts): los ejercicios de la clínica, por zona, con su dosis y
// cómo se hacen. Se usan para las hojas de ejercicios de cada paciente. Empieza vacía; hay ejemplos para editar.
import { Plus, Sparkles, Trash } from "lucide-react";
import { useState } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { BODY_REGIONS, regionLabel } from "../clinical/anamnesis";
import { TextArea } from "../clinical/parts";
import { addStarterExercises, deleteExercise, listExercises, saveExercise, STARTER_EXERCISES, type Exercise, type ExerciseInput } from "../data/exercises";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const EMPTY: ExerciseInput = {
  title: "",
  region: "",
  dose: "",
  instructions: "",
};

export function ExerciseLibraryPage() {
  const toast = useToast();
  const version = useDataVersion();
  const data = useAsync(() => listExercises(getDb()), [version]);
  const [editing, setEditing] = useState<(ExerciseInput & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = data.data ?? [];
  const allStarters = STARTER_EXERCISES.every((x) => list.some((e) => e.title.toLowerCase() === x.title.toLowerCase()));
  const groups = [...BODY_REGIONS, { id: "", label: "Otros" }].map((r) => ({ r, items: list.filter((e) => e.region === r.id) })).filter((g) => g.items.length);

  return (
    <Page title="Ejercicios" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Los ejercicios de la clínica para las hojas de ejercicios para casa de cada paciente (en su ficha). Los ve todo el equipo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => (setEditing({ ...EMPTY }), setError(null))}>
          Nuevo ejercicio
        </Button>
        {!allStarters && (
          <Button
            variant="secondary"
            icon={<Sparkles aria-hidden="true" className="size-5" />}
            onClick={async () => {
              const n = await addStarterExercises(getDb());
              bumpData();
              toast(n ? `${n} ejemplos añadidos: revísalos y adáptalos` : "Ya tienes todos los ejemplos", "success");
            }}
          >
            Añadir ejemplos para empezar
          </Button>
        )}
      </div>
      {data.data && !list.length && <p className="text-sm text-text-muted">Todavía no hay ejercicios.</p>}
      {groups.map(({ r, items }) => (
        <section key={r.id} aria-labelledby={`h-ej-${r.id || "otros"}`} className="flex flex-col gap-2">
          <h2 id={`h-ej-${r.id || "otros"}`} className="text-lg">
            {r.label}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
            {items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full flex-col items-start px-3 py-2 text-left hover:bg-surface"
                  onClick={() => (setEditing(e), setError(null))}
                >
                  <span className="font-semibold">{e.title}</span>
                  {e.dose && <span className="text-sm text-text-muted">{e.dose}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Cambiar el ejercicio" : "Nuevo ejercicio"}>
        {editing && (
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={async (ev) => {
              ev.preventDefault();
              try {
                await saveExercise(getDb(), editing, editing.id);
                setEditing(null);
                bumpData();
                toast("Ejercicio guardado", "success");
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            <TextField label="Nombre" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <SelectField label="Zona" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })}>
              <option value="">Otros</option>
              {BODY_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {regionLabel(r.id)}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Dosis"
              value={editing.dose}
              placeholder="3 series de 10, una vez al día"
              onChange={(e) => setEditing({ ...editing, dose: e.target.value })}
            />
            <TextArea label="Cómo se hace" value={editing.instructions} rows={4} onChange={(v) => setEditing({ ...editing, instructions: v })} />
            <TextField
              label="Vídeo (enlace, opcional)"
              inputMode="url"
              value={editing.video ?? ""}
              placeholder="https://…"
              onChange={(e) => setEditing({ ...editing, video: e.target.value })}
              hint="Un vídeo tuyo o de confianza (YouTube, la web de la clínica…). En la hoja sale con su código QR."
            />
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" block>
              Guardar
            </Button>
            {editing.id && (
              <Button
                variant="ghost"
                className="text-danger"
                block
                icon={<Trash aria-hidden="true" className="size-4" />}
                onClick={async () => {
                  await deleteExercise(getDb(), (editing as Exercise).id);
                  setEditing(null);
                  bumpData();
                  toast("Ejercicio borrado de la biblioteca (las hojas ya dadas no cambian)", "success");
                }}
              >
                Borrar de la biblioteca
              </Button>
            )}
          </form>
        )}
      </Sheet>
    </Page>
  );
}
