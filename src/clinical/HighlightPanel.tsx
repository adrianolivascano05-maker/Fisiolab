// Lo destacado de la anamnesis (fase 2, docs/anamnesis-adaptable.md): las respuestas que la clínica marcó para
// destacar en sus preguntas de opciones o Sí/No. Se ve como los síntomas que marca el paciente, con el texto literal
// de la opción, sin recuentos, aparte de las banderas rojas del tronco y sin interpretar nada.
import { highlights, type Field } from "./anamnesis";

export function HighlightPanel({ answers, fields }: { answers: Record<string, unknown>; fields: Field[] }) {
  const list = highlights(answers, fields);
  if (!list.length) return null;
  return (
    <section aria-labelledby="h-destacado" className="flex flex-col gap-2 rounded-lg border-2 border-border bg-bg p-4">
      <h3 id="h-destacado" className="text-lg">
        Destacado
      </h3>
      <ul className="flex flex-col gap-1">
        {list.map((h) => (
          <li key={h.id} className="rounded-md bg-surface px-2 py-1.5 text-sm">
            <span className="text-text-muted">{h.label}:</span> <span className="font-semibold">{h.values.join(", ")}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">Destacado según la configuración de tu clínica.</p>
    </section>
  );
}
