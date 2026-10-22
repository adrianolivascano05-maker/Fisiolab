// Las banderas amarillas de la anamnesis (src/clinical/yellowFlags.ts): lo que se ha escrito que las sugiere, qué
// preguntar y el cuestionario de la app que las mide.
import { ClipboardList } from "lucide-react";
import { Link } from "react-router";
import type { Answers } from "../data/clinical";
import { getKind } from "./questionnaires";
import { findYellowFlags } from "./yellowFlags";

export function YellowFlagPanel({ answers, labelOf, patientId, links = true }: { answers: Answers; labelOf: (fieldId: string) => string; patientId: string; links?: boolean }) {
  const hits = findYellowFlags(answers, labelOf);
  if (!hits.length) return null;
  return (
    <section aria-labelledby="h-amarillas" className="flex flex-col gap-3 rounded-lg border-2 border-warning bg-bg p-4">
      <h3 id="h-amarillas" className="text-lg">
        Banderas amarillas: {hits.length === 1 ? "1 factor" : `${hits.length} factores`} a valorar
      </h3>
      <p className="text-sm text-text-muted">Factores psicológicos y sociales que pueden alargar el dolor. Pregunta y, si se confirma, mídelo con su cuestionario.</p>
      <ul className="flex flex-col gap-3">
        {hits.map((h) => (
          <li key={h.flag.id} className="flex flex-col gap-1 rounded-md bg-warning-soft p-3">
            <span className="font-semibold">{h.flag.label}</span>
            <span className="text-xs text-text-muted">
              En «{h.field}»: «{h.quote}»
            </span>
            <span className="text-sm">{h.flag.ask}</span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {h.flag.measure.map((q) =>
                links ? (
                  <Link key={q} to={`/pacientes/${patientId}/cuestionarios/nuevo?tipo=${q}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent">
                    <ClipboardList aria-hidden="true" className="size-4" /> {getKind(q)?.name ?? q}
                  </Link>
                ) : (
                  <span key={q} className="text-sm">
                    Cuestionario: {getKind(q)?.name ?? q}
                  </span>
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">
        No etiqueta al paciente: es para preguntar y medir. Fuente:{" "}
        <a className="font-semibold text-accent underline" href="https://doi.org/10.2522/ptj.20100224" target="_blank" rel="noreferrer">
          Nicholas et al., Phys Ther 2011
        </a>
        .
      </p>
    </section>
  );
}
