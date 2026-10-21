// Recoger las respuestas de los pacientes (src/clinical/patientForms.ts): las que el servidor tiene ya contestadas se
// descifran con la clave de cada envío, se ponen en la ficha y se borran del servidor. Lo que llega de un envío que
// este dispositivo aún no conoce (lo hizo un compañero y no ha llegado por la sincronización) se deja para después.
import { getAnamnesisOf, saveAnamnesisOf } from "../data/clinical";
import type { Db } from "../data/db";
import { currentEpisode } from "../data/episodes";
import { getSentForm, markImported } from "../data/patientForms";
import type { Section } from "../clinical/anamnesis";
import { ANAMNESIS_KIND, cleanFormAnswers, mergeAnamnesis, saveAnsweredQuestionnaire, unseal, type FormResponse } from "../clinical/patientForms";

/** Días que se guardan en el servidor unas respuestas de un envío que este dispositivo no conoce. */
const ORPHAN_DAYS = 7;

export type FormsApi = {
  answered: () => Promise<{ id: string; response: string; answeredAt: string }[]>;
  remove: (formId: string) => Promise<void>;
};

/** Lo que se ha puesto en la ficha: de quién, qué y cuántas respuestas no se pusieron porque ya había algo. */
export type Collected = { patientId: string; name: string; kind: string; skipped: number; incomplete: boolean };

/** El motivo al que se mandó; si se ha borrado desde entonces, el que va ahora. */
async function episodeFor(db: Db, patientId: string, episodeId: string): Promise<string> {
  if (episodeId === patientId) return episodeId;
  const [row] = await db.query("select 1 from episodes where id = ?", [episodeId]);
  return row ? episodeId : currentEpisode(db, patientId);
}

export async function collectAnswered(db: Db, api: FormsApi, template: Section[]): Promise<Collected[]> {
  const out: Collected[] = [];
  for (const f of await api.answered()) {
    const sent = await getSentForm(db, f.id);
    if (!sent) {
      // De un envío que aquí no está: de un compañero cuya copia aún no ha llegado, o de un paciente borrado. Pasada
      // una semana se descarta, para que no se acumulen y tapen las demás.
      if (Date.parse(f.answeredAt) < Date.now() - ORPHAN_DAYS * 86_400_000) await api.remove(f.id);
      continue;
    }
    if (sent.importedAt || sent.cancelledAt) {
      await api.remove(f.id);
      continue;
    }
    let response: FormResponse;
    try {
      response = await unseal<FormResponse>(f.response, sent.key);
    } catch {
      // No se puede leer con su clave: no viene del enlace que se mandó. Se descarta.
      await api.remove(f.id);
      continue;
    }
    const incoming = typeof response?.answers === "object" && response.answers !== null ? response.answers : {};
    const episode = await episodeFor(db, sent.patientId, sent.episodeId);
    const [patient] = await db.query<{ name: string }>("select name from patients where id = ?", [sent.patientId]);
    let skipped: string[] = [];
    let incomplete = false;
    if (sent.kind === ANAMNESIS_KIND) {
      const current = (await getAnamnesisOf(db, sent.patientId, episode))?.answers ?? {};
      const m = mergeAnamnesis(current, incoming, template);
      if (m.filled.length) await saveAnamnesisOf(db, sent.patientId, episode, m.merged);
      skipped = m.skipped;
      await markImported(db, f.id, { answeredAt: f.answeredAt, answers: m.clean, skipped });
    } else {
      const answers = cleanFormAnswers(sent.kind, incoming);
      incomplete = (await saveAnsweredQuestionnaire(db, sent.patientId, episode, sent.kind, answers, f.answeredAt, f.id)) === 0;
      await markImported(db, f.id, { answeredAt: f.answeredAt, answers, skipped: [] });
    }
    await api.remove(f.id);
    out.push({ patientId: sent.patientId, name: patient?.name ?? "", kind: sent.kind, skipped: skipped.length, incomplete });
  }
  return out;
}
