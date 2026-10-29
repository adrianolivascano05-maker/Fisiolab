import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { decimalText, fmtDate, parseDecimal } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { getDb } from "../data/db";
import { formStatus, listSentForms } from "../data/patientForms";
import { getToken } from "../cloud/auth";
import { useCloud } from "../cloud/cloudContext";
import { clinicalRecord, getClinic, keepUntil } from "../data/privacy";
import { createPatient, deletePatient, getPatient, updatePatient, type PatientInput, type Sex } from "../data/repo";
import { SEED_PREFIX } from "../data/seed";
import { Alert } from "../ui/Alert";
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
  phone: string;
  email: string;
  address: string;
  dni: string;
};

const empty: Form = { name: "", birthDate: "", sex: "", bodyMassKg: "", heightCm: "", legLengthCm: "", pushOffDistanceCm: "", notes: "", phone: "", email: "", address: "", dni: "" };

// Mismos rangos que la base de datos (src/data/migrations/001_init.sql).
const ranges = {
  bodyMassKg: [10, 300, "El peso debe estar entre 10 y 300 kg."],
  heightCm: [50, 250, "La estatura debe estar entre 50 y 250 cm."],
  legLengthCm: [30, 150, "La longitud de pierna debe estar entre 30 y 150 cm."],
  pushOffDistanceCm: [5, 80, "La distancia de empuje debe estar entre 5 y 80 cm."],
} as const;

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): { errors: Errors; input?: PatientInput } {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = "Escribe el nombre.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = "Ese correo no parece completo.";
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
      phone: f.phone,
      email: f.email,
      address: f.address,
      dni: f.dni,
    },
  };
}

/** S03 Nuevo paciente / editar */
export function PatientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const cloud = useCloud();
  const [form, setForm] = useState<Form | null>(id ? null : empty);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Al pedir borrar: hasta cuándo obliga la ley a conservar su historia (null si no hay nada que conservar).
  const [keep, setKeep] = useState<{ until: Date; last: string; years: number } | null>(null);
  const [keepAck, setKeepAck] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);

  // Tras un envío con errores, el foco va al primer campo marcado (ya pintado con su mensaje).
  useEffect(() => {
    if (failedSubmits) document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [failedSubmits]);

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
              phone: p.phone,
              email: p.email,
              address: p.address,
              dni: p.dni,
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
      setFailedSubmits((n) => n + 1);
      return;
    }
    setSaving(true);
    try {
      const pid = id ?? (await createPatient(getDb(), input));
      if (id) await updatePatient(getDb(), id, input);
      toast(id ? "Cambios guardados" : "Paciente añadido", "success");
      navigate(`/pacientes/${pid}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  async function askDelete() {
    if (!id || !form) return;
    const db = getDb();
    const [record, clinic] = await Promise.all([clinicalRecord(db, id), getClinic(db)]);
    const until = record.last ? keepUntil(record.last, clinic.retentionYears) : null;
    setKeep(record.records && until && until > new Date() && !form.name.startsWith(SEED_PREFIX) ? { until, last: record.last!, years: clinic.retentionYears } : null);
    setKeepAck(false);
    setConfirmDelete(true);
  }

  async function remove() {
    if (!id) return;
    // Sus enlaces de formularios sin responder dejan de valer (si no se puede ahora, caducan solos).
    const token = getToken();
    if (token && cloud?.clinic && cloud.clinics) {
      for (const f of (await listSentForms(getDb(), id)).filter((x) => formStatus(x) === "pending"))
        await cloud.clinics.forms.remove(token, cloud.clinic.id, f.id).catch(() => {});
    }
    await deletePatient(getDb(), id);
    toast("Paciente borrado", "success");
    navigate("/", { replace: true });
  }

  const title = id ? "Editar paciente" : "Nuevo paciente";
  if (loadError) return <Page title={title} backTo="/"><LoadError error={loadError} /></Page>;
  if (!form) return <Page title={title} backTo="/"><Loading /></Page>;

  return (
    <Page title={title} backTo={id ? `/pacientes/${id}` : "/"} tabs={false}>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Teléfono" type="tel" autoComplete="off" value={form.phone} onChange={set("phone")} />
          <TextField label="Email" type="email" autoComplete="off" value={form.email} onChange={set("email")} error={errors.email} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Dirección" autoComplete="off" value={form.address} onChange={set("address")} />
          <TextField label="DNI o NIE" autoComplete="off" value={form.dni} onChange={set("dni")} hint="Opcional. Sale en justificantes y consentimientos." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Peso" unit="kg" value={form.bodyMassKg} onChange={set("bodyMassKg")} error={errors.bodyMassKg} />
          <NumberField label="Estatura" unit="cm" value={form.heightCm} onChange={set("heightCm")} error={errors.heightCm} />
        </div>
        {/* Solo hacen falta para la fuerza y la potencia de los saltos: plegados salvo que ya tengan algo (o un error). */}
        <details
          open={!!(form.legLengthCm || form.pushOffDistanceCm || errors.legLengthCm || errors.pushOffDistanceCm) || undefined}
          className="rounded-md border border-border bg-bg p-3 [&[open]>summary]:mb-3"
        >
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Datos para saltos</summary>
          <div className="flex flex-col gap-4">
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
              hint="Longitud de pierna menos la altura del trocánter en sentadilla a 90°. Hace falta, con el peso, para calcular fuerza y potencia."
            />
          </div>
        </details>
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
          <Button variant="ghost" className="text-danger" onClick={() => void askDelete()}>
            Borrar paciente
          </Button>
        )}
      </form>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Borrar este paciente?">
        <p>Se borrarán {form.name} y toda su historia: anamnesis, sesiones, exploración y mediciones. No se puede deshacer.</p>
        {keep && (
          <>
            <Alert tone="warning" title={`Hay que conservar su historia clínica hasta el ${fmtDate(keep.until.toISOString())}`}>
              La ley obliga a guardarla al menos {keep.years} años desde la última atención ({fmtDate(keep.last)}), aunque el paciente pida borrarla (Ley
              41/2002 y art. 17.3 del RGPD). Si lo que quiere es que no se use, anótalo en sus notas en lugar de borrarla.
            </Alert>
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={keepAck} onChange={(e) => setKeepAck(e.target.checked)} />
              <span>Lo borro igualmente: está duplicado, es un error o la clínica guarda su historia en otro sitio.</span>
            </label>
          </>
        )}
        <Button variant="danger" block disabled={!!keep && !keepAck} onClick={remove}>
          Borrar para siempre
        </Button>
        <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
