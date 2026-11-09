// Lo que propone una plantilla de anamnesis al abrir un motivo de consulta (docs/anamnesis-adaptable.md, fase 2): sus
// cuestionarios de la app (o de la clínica) y sus mediciones. Salen primero en «Valorar»; la clínica los cambia en la
// plantilla. Solo son atajos: no se pasa ni se mide nada solo.
import { getKind } from "./questionnaires";

/** Las mediciones que se pueden proponer (su pantalla en la ficha: /pacientes/:id/test/<id>). */
export const MEASURES: { id: string; label: string }[] = [
  { id: "saltos", label: "Saltos" },
  { id: "fuerza", label: "Fuerza" },
  { id: "sprint", label: "Sprint y cambio de dirección" },
  { id: "carrera", label: "Carrera" },
  { id: "isquios", label: "Nórdico (isquiotibiales)" },
  { id: "movilidad", label: "Movilidad" },
];
export const measureLabel = (id: string) => MEASURES.find((m) => m.id === id)?.label ?? id;
/** Los cuestionarios propuestos que la app conoce ahora (los que se retiraron o se archivaron, no). */
export const proposedQuestionnaires = (ids: string[]) => ids.map((id) => getKind(id)).filter((k): k is NonNullable<typeof k> => !!k && !k.retired && !k.archived);
