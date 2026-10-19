import { CircleQuestionMark, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { exercises, getExercise, type ExerciseId } from "../calc/strength";
import { decimalText, fmt, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { getDb } from "../data/db";
import { createVbtTest, lastRomCm, saveVbtVelocities, type VbtMethod } from "../data/repo";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { StrengthHelp } from "./StrengthHelp";

const option = (on: boolean) =>
  cx(
    "flex rounded-lg border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
    on ? "border-accent bg-accent-soft" : "border-border bg-bg",
  );

/** S13 Velocidad de barra: ejercicio, carga y cómo medir (vídeo o velocidades de un encoder). */
export function StrengthSetupPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [exercise, setExercise] = useState<ExerciseId>(getExercise(params.get("ejercicio") ?? "")?.id ?? "squat");
  const [load, setLoad] = useState(params.get("carga") ?? "");
  const [rom, setRom] = useState("");
  const [method, setMethod] = useState<VbtMethod>("video");
  const [rep, setRep] = useState("");
  const [reps, setReps] = useState<number[]>([]);
  const [errors, setErrors] = useState<{ load?: string; rom?: string; rep?: string; reps?: string }>({});
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  // El recorrido de la barra cambia poco: se propone el último del paciente en ese ejercicio.
  useEffect(() => {
    let alive = true;
    void lastRomCm(getDb(), id, exercise).then((cm) => alive && setRom(cm === null ? "" : decimalText(cm)));
    return () => {
      alive = false;
    };
  }, [id, exercise]);

  function addRep() {
    const v = parseDecimal(rep);
    if (v === null || Number.isNaN(v) || v <= 0 || v > 3) {
      setErrors((e) => ({ ...e, rep: "Escribe la velocidad en m/s (por ejemplo 0,85)." }));
      return;
    }
    setReps((r) => [...r, v]);
    setRep("");
    setErrors((e) => ({ ...e, rep: undefined, reps: undefined }));
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    const l = parseDecimal(load);
    const r = parseDecimal(rom);
    const errs: typeof errors = {};
    if (l === null || Number.isNaN(l) || l < 0 || l > 500) errs.load = "Indica la carga de la barra en kg (0-500).";
    if (method === "video" && (r === null || Number.isNaN(r) || r < 5 || r > 150)) errs.rom = "Indica el recorrido de la barra en cm (5-150).";
    if (method === "manual" && reps.length === 0) errs.reps = "Añade al menos una repetición.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (method === "video") {
      const q = new URLSearchParams({ tipo: "vbt", ejercicio: exercise, carga: String(l), recorrido: String(r) });
      navigate(`/pacientes/${id}/test/fuerza/video?${q}`);
      return;
    }
    setSaving(true);
    try {
      const db = getDb();
      const testId = await createVbtTest(db, { patientId: id, exercise, loadKg: l!, romCm: null, method: "manual" });
      await saveVbtVelocities(db, testId, reps);
      navigate(`/tests/${testId}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  const ex = getExercise(exercise)!;

  return (
    <Page title="Fuerza" backTo={`/pacientes/${id}/test`} tabs={false}>
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Ejercicio</legend>
          <div className="grid grid-cols-2 gap-2">
            {exercises.map((x) => (
              <label key={x.id} className="relative">
                <input type="radio" name="ejercicio" value={x.id} checked={exercise === x.id} onChange={() => setExercise(x.id)} className="peer sr-only" />
                <span className={cx(option(exercise === x.id), "min-h-12 items-center justify-center text-center font-semibold")}>{x.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <NumberField
          label="Carga en la barra"
          unit="kg"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          error={errors.load}
          hint="Barra y discos. Para el perfil carga-velocidad, mide 3 o 4 cargas, de ligera a pesada."
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Cómo medir</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["video", "Vídeo", "Marcar cada subida"],
                ["manual", "Encoder", "Escribir las velocidades"],
              ] as const
            ).map(([m, title, detail]) => (
              <label key={m} className="relative">
                <input type="radio" name="metodo" value={m} checked={method === m} onChange={() => setMethod(m)} className="peer sr-only" />
                <span className={cx(option(method === m), "flex-col")}>
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-text-muted">{detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === "video" ? (
          <>
            <NumberField label="Recorrido de la barra" unit="cm" value={rom} onChange={(e) => setRom(e.target.value)} error={errors.rom} hint={ex.rom} />
            <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
              Cómo grabar y marcar
            </Button>
          </>
        ) : (
          <section aria-labelledby="h-reps" className="flex flex-col gap-2">
            <h2 id="h-reps" className="text-sm font-semibold">
              Velocidad media de cada repetición
            </h2>
            {reps.length > 0 && (
              <ul className="flex flex-col gap-1">
                {reps.map((v, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-border px-3">
                    <span>
                      {i + 1}.ª: <span className="nums font-semibold">{fmt(v, 2)} m/s</span>
                    </span>
                    <IconButton label={`Borrar la repetición ${i + 1}`} onClick={() => setReps((rs) => rs.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden="true" className="size-5" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <NumberField
                  label={`Repetición ${reps.length + 1}`}
                  unit="m/s"
                  value={rep}
                  onChange={(e) => setRep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRep();
                    }
                  }}
                  error={errors.rep ?? errors.reps}
                />
              </div>
              <Button variant="secondary" className="mt-6" onClick={addRep}>
                Añadir
              </Button>
            </div>
          </section>
        )}

        <Button type="submit" size="lg" block loading={saving}>
          {method === "video" ? "Continuar" : "Guardar serie"}
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title="Cómo grabar y marcar la barra">
        <StrengthHelp exercise={exercise} />
      </Sheet>
    </Page>
  );
}
