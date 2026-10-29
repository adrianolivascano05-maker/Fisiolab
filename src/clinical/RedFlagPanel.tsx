// Las banderas rojas de la anamnesis (src/clinical/redFlags.ts): los síntomas confirmados y los que están por
// confirmar (los marcó el paciente o salen en lo escrito), en rojo. Solo la lista: sin agruparlos en enfermedades,
// sin urgencia y sin decir qué hacer. Al editar se ven mientras se escribe y cada uno se marca en un toque.
import { Check, FileText } from "lucide-react";
import { Link } from "react-router";
import type { Answers } from "../data/clinical";
import { Button } from "../ui/Button";
import { redFlagReview, type FlagHit } from "./redFlags";

const origin = (h: FlagHit) => (h.from === "paciente" ? "La marcó el paciente en su formulario." : h.from === "texto" ? `En «${h.field}»: «${h.quote}»` : "");

export function RedFlagPanel({
  answers,
  labelOf,
  patientId,
  onMark,
}: {
  answers: Answers;
  labelOf: (fieldId: string) => string;
  patientId: string;
  /** Al editar: marcar una bandera por confirmar en «Banderas rojas». */
  onMark?: (label: string) => void;
}) {
  const { hits } = redFlagReview(answers, labelOf);
  if (!hits.length) return null;
  const pending = hits.filter((h) => h.from !== "marcada");
  const marked = hits.filter((h) => h.from === "marcada");
  return (
    <section id="alarmas" aria-labelledby="h-alarmas" className="flex flex-col gap-3 rounded-lg border-2 border-danger/40 bg-bg p-4">
      <h3 id="h-alarmas" className="text-lg text-danger">
        Banderas rojas: {hits.length}
      </h3>
      {marked.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Confirmadas</p>
          <ul className="flex flex-col gap-1">
            {marked.map((h) => (
              <li key={h.flag.id} className="rounded-md bg-danger-soft px-2 py-1.5 text-sm font-semibold text-danger">
                {h.flag.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Por confirmar al preguntar</p>
          <ul className="flex flex-col gap-2">
            {pending.map((h) => (
              <li key={h.flag.id} className="flex items-start justify-between gap-2 rounded-md bg-surface p-2">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-danger">{h.flag.label}</span>
                  <span className="text-xs text-text-muted">{origin(h)}</span>
                </span>
                {onMark && (
                  <Button size="sm" variant="secondary" icon={<Check aria-hidden="true" className="size-4" />} onClick={() => onMark(h.flag.label)}>
                    Confirmar<span className="sr-only">: {h.flag.label}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-text-muted">Lista de lo referido o anotado, para no pasar nada por alto. No es un diagnóstico.</p>
      {!onMark && (
        <Link to={`/pacientes/${patientId}/derivacion`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-accent">
          <FileText aria-hidden="true" className="size-4" /> Carta de derivación a su médico
        </Link>
      )}
    </section>
  );
}
