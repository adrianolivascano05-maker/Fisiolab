// De un cuestionario que se rellena en la app: la cita de sus autores y el aviso de que su traducción es de trabajo.
import type { QuestionForm } from "./forms";
import { citeOf, WORKING_TRANSLATION } from "./forms";

export function FormCredits({ form, refs }: { form: QuestionForm; refs?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-text-muted">
        <span className="font-semibold">Autores: </span>
        {refs ?? citeOf(form)}
      </p>
      <p className="text-xs text-warning">{WORKING_TRANSLATION}</p>
    </div>
  );
}
