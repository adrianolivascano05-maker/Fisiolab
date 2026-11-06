// Cuestionarios propios: las preguntas que se siguen «con su línea» en la evolución (docs/cuestionarios-propios.md,
// decisión 10). Cada pase se lee con la versión con la que se hizo (su huella); la pregunta se reconoce por su id, que
// no cambia entre versiones. «Más/menos es mejor» solo orienta: no colorea ni interpreta nada.
import type { Questionnaire } from "../data/clinical";
import { answerText, trackValue, type OwnFormSpec, type OwnItem } from "./forms/own";
import { ownSpec } from "./ownCatalog";
import type { QDetails } from "./questionnaires";

export type TrackLine = {
  id: string;
  text: string;
  better?: "higher" | "lower";
  /** Sus valores, del pase más antiguo al último (sin los que no contestó). */
  values: number[];
  /** La última respuesta, en texto («7», «Sí», «Prefiero no responder»). */
  last: string;
};

const itemsOf = (spec: OwnFormSpec | undefined) => new Map((spec?.sections.flatMap((s) => s.items) ?? []).map((it) => [it.id, it] as const));

/**
 * Las líneas de un cuestionario propio: las preguntas que la versión del último pase marca para seguir, con sus
 * valores en cada pase. `items`: los pases, el más reciente primero (como en la ficha).
 */
export function trackLines(items: Questionnaire[], specOf: (id: string, hash?: string) => OwnFormSpec | undefined = ownSpec): TrackLine[] {
  const latest = items[0];
  const own = (latest?.details as QDetails | undefined)?.own;
  if (!latest || !own) return [];
  const tracked = [...itemsOf(specOf(latest.kind, own.hash)).values()].filter((it) => it.track);
  if (!tracked.length) return [];
  const passes = [...items].reverse().map((q) => {
    const d = q.details as QDetails;
    return { answers: d.answers ?? {}, texts: d.texts ?? {}, items: itemsOf(d.own ? specOf(q.kind, d.own.hash) : undefined) };
  });
  return tracked.map((it) => {
    const values: number[] = [];
    let last = "";
    for (const p of passes) {
      const item: OwnItem = p.items.get(it.id) ?? it;
      const v = p.answers[it.id];
      if (v === undefined) continue;
      last = answerText(item, v, p.texts[it.id]);
      const n = trackValue(item, v);
      if (n !== null) values.push(n);
    }
    return { id: it.id, text: it.text, ...(it.track!.better ? { better: it.track!.better } : {}), values, last: last || "Sin responder" };
  });
}
