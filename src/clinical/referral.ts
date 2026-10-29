// Lo que la carta de derivación (src/clinical/ReferralPage.tsx) dice del funcionamiento del paciente con la CIF y
// de sus cuestionarios: frases cortas con el calificador de cada código y la última nota de cada cuestionario con
// cómo se lee y qué valora, dicho con las categorías de la CIF.
import type { Questionnaire } from "../data/clinical";
import { formatCoded, readEntry, type Coded } from "./cif/cif";
import { mergeLeads, phraseParts } from "./cif/prose";
import { cifLinks, informs } from "./cif/questionnaireLinks";
import { displayName, kindOf, scoreText, type QDetails } from "./questionnaires";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listText = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

/**
 * Los códigos con un problema calificado (1 a 4), en frases: «deficiencia grave en dolor en la espalda (b28013.3)»,
 * «dificultad moderada para andar (d450.2)»; seguidas y con la misma gravedad, sin repetirla («para vestirse
 * (d540.2)»). Los «sin especificar», «no aplicable» y «no hay problema» no se dicen aquí (sí salen en el perfil).
 */
export function cifPhrases(entries: string[]): string[] {
  return mergeLeads(
    entries
      .map(readEntry)
      .filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e && e.coded.q !== null && e.coded.q >= 1 && e.coded.q <= 4)
      .map(({ coded, title }) => phraseParts(coded, title)!),
  );
}

/**
 * Qué valora un cuestionario, con las palabras de la CIF y, si el perfil tiene ese código, con su calificador:
 * «dolor en la espalda (b28013.3), cambiar las posturas corporales básicas (d410.3) y andar (d450)».
 */
export function informsText(codes: string[], titleOf: (code: string) => string | undefined, profile: Coded[]): string {
  const parts = codes.map((code) => {
    // Lo que tiene el perfil: el mismo código o, si el cuestionario es más general («b280»), uno más concreto suyo.
    const mine = profile.find((c) => c.code === code) ?? profile.find((c) => informs([code], c.code));
    const at = mine?.code ?? code;
    const title = (titleOf(at) ?? at).replace(/[“”"]/g, "");
    return `${lowerFirst(title)} (${mine && mine.q !== null ? formatCoded(mine) : at})`;
  });
  return listText([...new Set(parts)]);
}

export type QuestionnaireLine = { key: string; name: string; at: string; score: string; codes: string[] };

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
    out.push({ key, name: displayName(q.kind, d), at: q.performedAt, score: scoreText(k, q.score), codes: cifLinks(q.kind, d.subscale) });
  }
  return out;
}
