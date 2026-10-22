// Lo que la carta de derivación (src/clinical/ReferralPage.tsx) dice del funcionamiento del paciente con la CIF y
// de sus cuestionarios: frases cortas con el calificador de cada código y la última nota de cada cuestionario con
// cómo se lee y qué códigos CIF informa.
import type { Questionnaire } from "../data/clinical";
import { qualifierLabel, readEntry, type Component } from "./cif/cif";
import { cifLinks } from "./cif/questionnaireLinks";
import { bandText, displayName, kindOf, scoreText, type QDetails } from "./questionnaires";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Los códigos con un problema calificado (1 a 4), en frases: «deficiencia GRAVE en dolor en la espalda (b28013.3)».
 * Los «sin especificar», «no aplicable» y «no hay problema» no se dicen aquí (sí salen en el perfil).
 */
export function cifPhrases(entries: string[]): string[] {
  return entries
    .map(readEntry)
    .filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e && e.coded.q !== null && e.coded.q >= 1 && e.coded.q <= 4)
    .map(({ coded: c, title }) => {
      const k = c.code[0] as Component;
      const label = qualifierLabel(k, c.q!, { facilitator: c.facilitator }).toLowerCase();
      const notation = `${c.code}${k === "e" && c.facilitator ? "+" : "."}${c.q}${k === "d" && c.capacity !== null ? c.capacity : ""}`;
      return k === "e" ? `${label}: ${lowerFirst(title)} (${notation})` : `${label} en ${lowerFirst(title)} (${notation})`;
    });
}

export type QuestionnaireLine = { key: string; name: string; at: string; score: string; reading: string | null; codes: string[] };

/** La última nota de cada cuestionario (y subescala) de los últimos `days` días, del más reciente al más antiguo. */
export function latestQuestionnaires(all: Questionnaire[], now = Date.now(), days = 180): QuestionnaireLine[] {
  const seen = new Set<string>();
  const out: QuestionnaireLine[] = [];
  for (const q of [...all].sort((a, b) => b.performedAt.localeCompare(a.performedAt))) {
    if (Date.parse(q.performedAt) < now - days * 86_400_000) continue;
    const d = q.details as QDetails;
    const key = `${q.kind}|${d.subscale ?? ""}|${d.name ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const k = kindOf(q.kind, d);
    out.push({ key, name: displayName(q.kind, d), at: q.performedAt, score: scoreText(k, q.score), reading: d.text ?? bandText(k, q.score), codes: cifLinks(q.kind, d.subscale) });
  }
  return out;
}
