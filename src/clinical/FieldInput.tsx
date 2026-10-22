// Un campo de la anamnesis para rellenar: texto, fecha, escala del dolor, opciones o número. Lo usan la ficha
// (src/clinical/ClinicalPages.tsx) y la página que rellena el paciente desde su móvil (src/patientForm).
import type { AnswerValue } from "../data/clinical";
import { NumberField, TextField } from "../ui/Field";
import { regionLabel, type Field } from "./anamnesis";
import { CifPicker } from "./cif/CifPicker";
import { Chips, PainScale, TextArea } from "./parts";

export function FieldInput({ field, value, onChange }: { field: Field; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const s = typeof value === "string" ? value : "";
  switch (field.type) {
    case "text":
      return <TextField label={field.label} hint={field.hint} value={s} inputMode={field.inputMode} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <TextField label={field.label} hint={field.hint} type="date" value={s} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <TextArea label={field.label} hint={field.hint} value={s} rows={field.rows ?? 3} onChange={onChange} />;
    case "scale":
      return <PainScale label={field.label} hint={field.hint} value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "choice":
    case "multi":
      return (
        <Chips
          label={field.label}
          hint={field.hint}
          options={field.options}
          multiple={field.type === "multi"}
          value={Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []}
          onChange={(v) => onChange(field.type === "multi" ? v : (v[0] ?? null))}
          render={field.id === "regiones" ? regionLabel : undefined}
        />
      );
    case "cif":
      return <CifPicker label={field.label} hint={field.hint} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    case "number":
      return <NumberField label={field.label} unit={field.unit} hint={field.hint} value={typeof value === "number" ? String(value).replace(".", ",") : s} onChange={(e) => onChange(e.target.value)} />;
  }
}
