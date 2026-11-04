// Un campo de la anamnesis para rellenar: texto, fecha, escala del dolor, opciones o número. Lo usan la ficha
// (src/clinical/AnamnesisPage.tsx) y la página que rellena el paciente desde su móvil (src/patientForm).
import type { AnswerValue } from "../data/clinical";
import { NumberField, TextField } from "../ui/Field";
import { NO_ANSWER, regionLabel, type Field } from "./anamnesis";
import { CifPicker } from "./cif/CifPicker";
import { Chips, PainScale, TextArea } from "./parts";

const OTHER = "Otro";
const isOther = (x: string) => x === OTHER || x.startsWith(`${OTHER}: `);

/**
 * Un campo para rellenar. Las preguntas delicadas llevan «Prefiero no responder» debajo; las de opciones con «Otro»,
 * un texto corto que se guarda «Otro: …»; «Sí/No con detalle» se guarda «No» o «Sí: …».
 */
type Props = {
  field: Field;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  /** El formulario del paciente: opciones en una columna y textos con tope de 500 caracteres. */
  patient?: boolean;
};

/** Tope de los textos que escribe el paciente. */
export const PATIENT_TEXT_MAX = 500;

export function FieldInput({ field, value, onChange, patient }: Props) {
  if (!field.sensitive) return <Input field={field} value={value} onChange={onChange} patient={patient} />;
  const declined = value === NO_ANSWER;
  return (
    <div className="flex flex-col gap-1">
      {declined ? (
        <p className="text-sm">
          <span className="font-semibold">{field.label}</span>: {NO_ANSWER.toLowerCase()}
        </p>
      ) : (
        <Input field={field} value={value} onChange={onChange} patient={patient} />
      )}
      <button type="button" aria-pressed={declined} onClick={() => onChange(declined ? null : NO_ANSWER)} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent">
        {declined ? "Contestar" : NO_ANSWER}
      </button>
    </div>
  );
}

function Input({ field, value, onChange, patient }: Props) {
  const s = typeof value === "string" ? value : "";
  const max = patient ? PATIENT_TEXT_MAX : undefined;
  switch (field.type) {
    case "text":
      return patient ? (
        <TextArea label={field.label} hint={field.hint} value={s} rows={2} maxLength={max} onChange={onChange} />
      ) : (
        <TextField label={field.label} hint={field.hint} value={s} inputMode={field.inputMode} onChange={(e) => onChange(e.target.value)} />
      );
    case "date":
      return <TextField label={field.label} hint={field.hint} type="date" value={s} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <TextArea label={field.label} hint={field.hint} value={s} rows={field.rows ?? 3} maxLength={max} onChange={onChange} />;
    case "scale":
      return <PainScale label={field.label} hint={field.hint} value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "choice":
    case "multi": {
      const list = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
      const other = list.find(isOther);
      // Lo elegido que ya no es una opción (la clínica la retiró, o «Otro: …»): se sigue viendo y se puede quitar.
      const options = [...field.options, ...list.filter((x) => !field.options.includes(x) && !isOther(x)), ...(field.other ? [OTHER] : [])];
      const shown = list.map((x) => (isOther(x) ? OTHER : x));
      const put = (v: string[]) => onChange(field.type === "multi" ? v : (v[0] ?? null));
      return (
        <div className="flex flex-col gap-2">
          <Chips
            label={field.label}
            hint={field.hint}
            options={options}
            multiple={field.type === "multi"}
            value={shown}
            onChange={(v) => put(v.map((x) => (x === OTHER ? (other ?? `${OTHER}: `) : x)))}
            render={field.id === "regiones" ? regionLabel : undefined}
            column={patient}
          />
          {other !== undefined && (
            <TextField
              label="¿Cuál?"
              maxLength={200}
              value={other.replace(/^Otro:? ?/, "")}
              onChange={(e) => put(list.map((x) => (isOther(x) ? `${OTHER}: ${e.target.value}` : x)))}
            />
          )}
        </div>
      );
    }
    case "yesno_detail": {
      const yes = s === "Sí" || s.startsWith("Sí: ");
      return (
        <div className="flex flex-col gap-2">
          <Chips column={patient} label={field.label} hint={field.hint} options={["No", "Sí"]} value={s ? [yes ? "Sí" : s] : []} onChange={(v) => onChange(v[0] === "Sí" ? (yes ? s : "Sí") : (v[0] ?? null))} />
          {yes && <TextField label={field.detail ?? "¿Cuál?"} maxLength={PATIENT_TEXT_MAX} value={s.replace(/^Sí:? ?/, "")} onChange={(e) => onChange(e.target.value.trim() ? `Sí: ${e.target.value}` : "Sí")} />}
        </div>
      );
    }
    case "cif":
      return <CifPicker label={field.label} hint={field.hint} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    case "number":
      return <NumberField label={field.label} unit={field.unit} hint={field.hint} value={typeof value === "number" ? String(value).replace(".", ",") : s} onChange={(e) => onChange(e.target.value)} />;
    default: {
      // Un tipo de pregunta de una versión más nueva: como texto, sin borrar lo que haya.
      const f = field as Field;
      return <TextArea label={f.label} hint={f.hint} value={typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value)} onChange={onChange} />;
    }
  }
}
