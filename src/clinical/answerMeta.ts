// Claves internas de las respuestas de una anamnesis (docs/anamnesis-adaptable.md). Empiezan por «__» y no son
// preguntas: no se enseñan como respuestas, no se copian a otro motivo de consulta ni salen en la exportación como
// datos del paciente.
// - `__tpl`: «<plantilla>@<huella>», la plantilla con la que se hizo (src/data/anamnesisTemplates.ts).
// - `__src`: quién contestó cada pregunta y cuándo (texto JSON: { [pregunta]: { by, who?, at, form? } }).
// - `__respondent`: en un menor, quién rellenó el formulario (el propio paciente o su madre, padre o tutor).
import type { Answers } from "../data/clinical";

export const TPL = "__tpl";
export const SRC = "__src";
export const RESPONDENT = "__respondent";

/** De dónde salió una respuesta: el paciente desde su enlace o el fisioterapeuta en la ficha. */
export type Source = { by: "patient" | "clinician"; who?: string; at: string; form?: string };

/** Quién contestó cada pregunta (lo que no se entienda, fuera). */
export function readSources(a: Answers): Record<string, Source> {
  const raw = a[SRC];
  if (typeof raw !== "string") return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, Source> = {};
    for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
      if (!s || typeof s !== "object") continue;
      const { by, who, at, form } = s as Record<string, unknown>;
      if ((by !== "patient" && by !== "clinician") || typeof at !== "string") continue;
      out[k] = { by, at, ...(typeof who === "string" ? { who } : {}), ...(typeof form === "string" ? { form } : {}) };
    }
    return out;
  } catch {
    return {};
  }
}

/** Las respuestas con «quién y cuándo» apuntado para estas preguntas (las demás, como estaban). */
export function stampSources(a: Answers, ids: string[], src: Source): Answers {
  if (!ids.length) return a;
  const all = readSources(a);
  for (const id of ids) all[id] = src;
  return { ...a, [SRC]: JSON.stringify(all) };
}

/** «El paciente, el 4 nov» o «ana@clinica.es, el 4 nov», para leerlo en la ficha. */
export function sourceText(s: Source): string {
  const day = new Date(s.at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });
  return `${s.by === "patient" ? "El paciente" : (s.who ?? "En la clínica")}, el ${day}`;
}
