// La ficha de anamnesis de la clínica: la de OmniClin con los cambios de la clínica (Ajustes → Anamnesis de la
// clínica, src/data/anamnesisTemplates.ts).
import { useAsync } from "../app/useAsync";
import { currentTemplate, emptyDelta, getSnapshot, GENERAL, resolveTemplate, type Resolved, type ResolvedTemplate } from "../data/anamnesisTemplates";
import { getDb } from "../data/db";
import { BASE_VERSION, type Section } from "./anamnesis";

/** Mientras carga: el tronco tal cual. */
const FALLBACK: Resolved = resolveTemplate({ v: 1, id: GENERAL, name: "General", base: BASE_VERSION, delta: emptyDelta() });

/** La plantilla de la clínica, resuelta y con su huella (null mientras carga). */
export function useAnamnesisTemplate(): ResolvedTemplate | null {
  const t = useAsync(() => currentTemplate(getDb()), [], { tables: ["settings"] });
  return t.data ?? null;
}

/** El tronco tal cual (mientras carga la plantilla de la clínica). */
export const BASE_SECTIONS = FALLBACK.sections;

export function useAnamnesisSections(): Section[] {
  return useAnamnesisTemplate()?.sections ?? FALLBACK.sections;
}

/** La instantánea de la plantilla con la que se hizo una anamnesis («__tpl»), o null. */
export function useSnapshot(ref: unknown): ResolvedTemplate | null {
  const s = useAsync(() => getSnapshot(getDb(), ref), [ref], { tables: ["settings"] });
  return s.data ?? null;
}
