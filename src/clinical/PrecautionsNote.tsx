// Las precauciones y alergias apuntadas en la anamnesis (Antecedentes personales), a la vista en la cabecera de la ficha
// y al apuntar una sesión: es justo cuando se va a aplicar un tratamiento. Solo enseña lo que escribió el fisio, tal
// cual; no deduce ni avisa de nada por su cuenta (src/app/purpose.ts).
import { TriangleAlert } from "lucide-react";
import { useDataVersion } from "../app/dataVersion";
import { useAsync } from "../app/useAsync";
import { getAnamnesis } from "../data/clinical";
import { getDb } from "../data/db";
import { cx } from "../ui/cx";

/** «Marcapasos · Anticoagulantes» y las alergias, o nada si no hay nada apuntado. */
export function precautionsOf(answers: Record<string, unknown>): { precautions: string[]; allergies: string } {
  const p = answers.precauciones;
  const precautions = Array.isArray(p) ? p.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const a = answers.alergias;
  const allergies = typeof a === "string" ? a.trim() : "";
  // «No», «ninguna», «no conocidas»: no es una alergia que haya que ver.
  return { precautions, allergies: /^(no|ninguna?s?|no conocidas?|nada|-)\.?$/i.test(allergies) ? "" : allergies };
}

export function PrecautionsNote({ patientId, className }: { patientId: string; className?: string }) {
  const version = useDataVersion();
  const data = useAsync(async () => precautionsOf((await getAnamnesis(getDb(), patientId))?.answers ?? {}), [patientId, version]);
  if (!data.data || (!data.data.precautions.length && !data.data.allergies)) return null;
  const { precautions, allergies } = data.data;
  return (
    <p role="note" aria-label="Precauciones" className={cx("flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm", className)}>
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {precautions.length > 0 && (
          <>
            <b>Precauciones:</b> {precautions.join(" · ")}
          </>
        )}
        {precautions.length > 0 && allergies && <br />}
        {allergies && (
          <>
            <b>Alergias:</b> {allergies}
          </>
        )}
      </span>
    </p>
  );
}
