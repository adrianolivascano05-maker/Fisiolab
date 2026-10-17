import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { decimalText, parseDecimal } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { getDb } from "../data/db";
import { createPatient, deletePatient, getPatient, updatePatient, type PatientInput, type Sex } from "../data/repo";
import { Button } from "../ui/Button";
import { NumberField, SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

type Form = {
  name: string;
  birthDate: string;
  sex: Sex | "";
  bodyMassKg: string;
  heightCm: string;
  legLengthCm: string;
  pushOffDistanceCm: string;
  notes: string;
};

const empty: Form = { name: "", birthDate: "", sex: "", bodyMassKg: "", heightCm: "", legLengthCm: "", pushOffDistanceCm: "", notes: "" };

// Mismos rangos que la base de datos (src/data/migrations/001_init.sql).
const ranges = {
  bodyMassKg: [10, 300, "La masa debe estar entre 10 y 300 kg."],
  heightCm: [50, 250, "La estatura debe estar entre 50 y 250 cm."],
  legLengthCm: [30, 150, "La longitud de pierna debe estar entre 30 y 150 cm."],
  pushOffDistanceCm: [5, 80, "La distancia de empuje debe estar entre 5 y 80 cm."],
} as const;

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): { errors: Errors; input?: PatientInput } {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = "Escribe el nombre.";
  const nums: Record<string, number | null> = {};
  for (const [key, [min, max, msg]] of Object.entries(ranges)) {
    const v = parseDecimal(f[key as keyof Form]);
    if (v !== null && (Number.isNaN(v) || v < min || v > max)) errors[key as keyof Form] = msg;
    nums[key] = v;
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      name: f.name.trim(),
      birthDate: f.birthDate || null,
      sex: f.sex || null,
      bodyMassKg: nums.bodyMassKg ?? null,
      heightCm: nums.heightCm ?? null,
      legLengthCm: nums.legLengthCm ?? null,
      pushOffDistanceCm: nums.pushOffDistanceCm ?? null,
      notes: f.notes,
    },
  };
}

/** S03 Nuevo paciente / editar */
export function PatientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(id ? null : empty);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPatient(getDb(), id).then(
      (p) =>
        p
          ? setForm({
              name: p.name,
              birthDate: p.birthDate ?? "",
              sex: p.sex ?? "",
              bodyMassKg: decimalText(p.bodyMassKg),
              heightCm: decimalText(p.heightCm),
              legLengthCm: decimalText(p.legLengthCm),
              pushOffDistanceCm: decimalText(p.pushOffDistanceCm),
              notes: p.notes,
            })
          : setLoadError(new Error("Este paciente no existe.")),
      setLoadError,
    );
  }, [id]);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { errors, input } = validate(form);
    setErrors(errors);
    if (!input) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setSaving(true);
    try {
      const pid = id ?? (await createPatient(getDb(), input));
      if (id) await updatePatient(getDb(), id, input);
      toast(id ? "Cambios guardados" : "Paciente creado", "success");
      navigate(`/pacientes/${pid}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    await deletePatient(getDb(), id);
    toast("Paciente borrado", "success");
    navigate("/", { replace: true });
  }

  const title = id ? "Editar paciente" : "Nuevo paciente";
  if (loadError) return <Page title={title} backTo="/"><LoadError error={loadError} /></Page>;
  if (!form) return <Page title={title} backTo="/"><Loading /></Page>;

  return (
    <Page title={title} backTo={id ? `/pacientes/${id}` : "/"}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="Nombre" autoComplete="off" value={form.name} onChange={set("name")} error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={set("birthDate")} />
          <SelectField label="Sexo" value={form.sex} onChange={set("sex")}>
            <option value="">Sin indicar</option>
            <option value="female">Mujer</option>
            <option value="male">Hombre</option>
            <option value="other">Otro</option>
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Masa" unit="kg" value={form.bodyMassKg} onChange={set("bodyMassKg")} error={errors.bodyMassKg} />
          <NumberField label="Estatura" unit="cm" value={form.heightCm} onChange={set("heightCm")} error={errors.heightCm} />
        </div>
        <NumberField
          label="Longitud de pierna"
          unit="cm"
          value={form.legLengthCm}
          onChange={set("legLengthCm")}
          error={errors.legLengthCm}
          hint="Del trocánter mayor a la punta del pie en flexión plantar, tumbado."
        />
        <NumberField
          label="Distancia de empuje"
          unit="cm"
          value={form.pushOffDistanceCm}
          onChange={set("pushOffDistanceCm")}
          error={errors.pushOffDistanceCm}
          hint="Longitud de pierna menos la altura del trocánter en sentadilla a 90°. Hace falta, con la masa, para calcular fuerza y potencia."
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-sm font-semibold">
            Notas
          </label>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={set("notes")}
            className="w-full rounded-md border border-border-input bg-bg px-3 py-2 text-base"
          />
        </div>
        <Button type="submit" size="lg" block loading={saving}>
          {id ? "Guardar cambios" : "Crear paciente"}
        </Button>
        {id && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Borrar paciente
          </Button>
        )}
      </form>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Borrar este paciente?">
        <p>Se borrarán {form.name} y todos sus tests. No se puede deshacer.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar para siempre
        </Button>
        <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
