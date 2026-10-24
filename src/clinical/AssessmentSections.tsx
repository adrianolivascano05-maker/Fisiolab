// Dos de los tres bloques de Valoración (la página y la exploración están en ExplorationPages.tsx): los cuestionarios
// (pasar uno aquí o mandarlo al móvil) y las mediciones.
import { HeartPulse, ListChecks, Plus, Send } from "lucide-react";
import { Link } from "react-router";
import { fmtDate } from "../app/format";
import type { Questionnaire } from "../data/clinical";
import type { Patient, TestSummary, WellnessEntry } from "../data/repo";
import { wellnessTotal } from "../calc/wellness";
import { Alert } from "../ui/Alert";
import { AnalysisNav, TestList } from "./measureParts";
import { QuestionnaireTiles, SymmetryPanel } from "./outcomeParts";
import { LSI_REFERENCE, symmetryRows } from "./symmetry";

// ---------- Valoración: cuestionarios y mediciones ----------
// Son dos de los tres bloques de la pestaña Valoración (la página está en ExplorationPages.tsx, con la exploración).

/** Valoración › Cuestionarios: pasar uno aquí o mandarlo al móvil, sus tarjetas con la evolución y el bienestar diario. */
export function QuestionnairesSection({ id, questionnaires, wellness, waiting }: { id: string; questionnaires: Questionnaire[]; wellness: WellnessEntry | null; waiting: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <Link to={`/pacientes/${id}/cuestionarios/nuevo`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
          <ListChecks aria-hidden="true" className="size-5" /> Nuevo cuestionario
        </Link>
        <Link to={`/pacientes/${id}/formularios?enviar=elegir`} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-border bg-bg px-3 text-center text-sm font-semibold hover:bg-surface">
          <Send aria-hidden="true" className="size-4 shrink-0" /> Enviar al móvil
        </Link>
      </div>
      {waiting > 0 && (
        <Link to={`/pacientes/${id}/formularios`} className="text-sm font-semibold text-accent">
          {waiting === 1 ? "1 formulario esperando su respuesta" : `${waiting} formularios esperando su respuesta`} ›
        </Link>
      )}
      {questionnaires.length ? (
        <QuestionnaireTiles patientId={id} items={questionnaires} />
      ) : (
        <p className="text-sm text-text-muted">Sin cuestionarios todavía. Se rellenan aquí pregunta a pregunta y la nota sale sola; si lo hizo en papel, puedes anotar solo la puntuación.</p>
      )}
      <Link to={`/pacientes/${id}/bienestar`} className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2 hover:bg-surface">
        <HeartPulse aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">Bienestar diario</span>
          <span className="text-sm text-text-muted">{wellness ? `El último: ${wellnessTotal(wellness)}/25 · ${fmtDate(wellness.performedAt)}` : "Sueño, fatiga, estrés, dolor muscular y ánimo"}</span>
        </span>
      </Link>
    </div>
  );
}

/** Valoración › Mediciones: medir, los análisis, la simetría entre lados y todas las mediciones. */
export function MeasurementsSection({ id, patient, tests }: { id: string; patient: Patient; tests: TestSummary[] }) {
  const symmetry = symmetryRows(tests);
  const above = symmetry.filter((r) => r.lsi >= LSI_REFERENCE).length;
  return (
    <div className="flex flex-col gap-3">
      <Link to={`/pacientes/${id}/test`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
        <Plus aria-hidden="true" className="size-5" /> Nueva medición
      </Link>
      {(!patient.bodyMassKg || !patient.pushOffDistanceCm) && tests.some((t) => JUMP_TYPES.has(t.type)) && (
        <Alert tone="info" title="Faltan datos para fuerza y potencia">
          Añade el peso y la distancia de empuje en <Link className="underline" to={`/pacientes/${id}/editar`}>Editar</Link>. La altura del salto se calcula igualmente.
        </Alert>
      )}
      <AnalysisNav id={id} tests={tests} />
      {symmetry.length > 0 && (
        <section aria-labelledby="simetria" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="simetria" className="text-base">
              Simetría entre lados
            </h3>
            <span className="nums text-sm text-text-muted">
              {above} de {symmetry.length} en el {LSI_REFERENCE} % o más
            </span>
          </div>
          <p className="-mt-1 text-sm text-text-muted">
            Lado peor entre lado mejor, con la última medición de cada lado. La raya marca el {LSI_REFERENCE} %, la referencia que se suele pedir para volver al deporte.
          </p>
          <SymmetryPanel rows={symmetry} />
        </section>
      )}
      {tests.length === 0 ? (
        <p className="text-sm text-text-muted">Sin mediciones todavía: saltos, fuerza, sprint, carrera, movilidad o nórdico, con «Nueva medición».</p>
      ) : (
        <>
          <h3 className="text-base">Todas las mediciones</h3>
          <TestList tests={tests} />
        </>
      )}
    </div>
  );
}

/** Saltos: los que usan el peso y la distancia de empuje para la fuerza y la potencia. */
const JUMP_TYPES = new Set<string>(["cmj", "sj", "cmj_arms", "dj", "single_leg", "rj_10_5"]);
