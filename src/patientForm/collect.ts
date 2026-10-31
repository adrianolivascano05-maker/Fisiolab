// Recoger las respuestas de los pacientes (src/clinical/patientForms.ts): las que el servidor tiene ya contestadas se
// descifran con la clave de cada envío, se ponen en la ficha y se borran del servidor. Los archivos que ha subido (sus
// informes y pruebas) se quedan en el servidor: la clínica se los guarda y se apuntan en sus archivos. Lo que llega de un envío que
// este dispositivo aún no conoce (lo hizo un compañero y no ha llegado por la sincronización) se deja para después.
// Las firmas por enlace (la hoja de protección de datos o un consentimiento) se retiraron el 30-10-2026: si llega una
// respuesta de un enlace de esos, no se guarda nada, el envío queda anulado y se avisa para firmarlo en la clínica. Lo
// firmado así antes de esa fecha sigue en la ficha tal cual.
import { getAnamnesisOf, saveAnamnesisOf } from "../data/clinical";
import type { Db } from "../data/db";
import { currentEpisode } from "../data/episodes";
import { cancelSentForm, getSentForm, markImported } from "../data/patientForms";
import { recordIntake } from "../data/privacy";
import { addDocument, cleanName, getDocument, MAX_DOC_BYTES } from "../data/documents";
import { ServerError } from "../cloud/remote";
import type { Section } from "../clinical/anamnesis";
import { ANAMNESIS_KIND, cleanFormAnswers, DOCS_KIND, DOCS_PER_LINK, isSignKind, mergeAnamnesis, saveAnsweredQuestionnaire, unseal, type FormResponse, type SentDoc } from "../clinical/patientForms";

/** Días que se guardan en el servidor unas respuestas de un envío que este dispositivo no conoce. */
const ORPHAN_DAYS = 7;

export type FormsApi = {
  answered: () => Promise<{ id: string; response: string; answeredAt: string }[]>;
  remove: (formId: string) => Promise<void>;
  /** Quedarse en el servidor con un archivo que subió el paciente («<formulario>.<n>»); si no, se borra al recoger. */
  keepDoc: (docId: string) => Promise<void>;
};

/** Lo que se ha puesto en la ficha: de quién, qué y cuántas respuestas no se pusieron porque ya había algo. `files`:
 * archivos que ha enviado. `refused`: firmó por un enlace de los que ya no se recogen; no se ha guardado nada. */
export type Collected = { patientId: string; name: string; kind: string; skipped: number; incomplete: boolean; files?: number; refused?: boolean };

/**
 * Anula los enlaces de firma que sigan pendientes (ya no se recogen): en la ficha y, si hay conexión, en el servidor.
 * Corre al abrir la app y antes de cada recogida, para que un enlace mandado con la versión anterior deje de valer.
 * Devuelve cuántos ha anulado.
 */
export async function cancelSignLinks(db: Db, remove: (id: string) => Promise<void>): Promise<number> {
  const rows = await db.query<{ id: string; kind: string }>("select id, kind from patient_forms where imported_at is null and cancelled_at is null");
  let n = 0;
  for (const r of rows) {
    if (!isSignKind(r.kind)) continue;
    await cancelSentForm(db, r.id);
    try {
      await remove(r.id);
    } catch {
      /* sin conexión: el servidor lo caduca solo; aquí ya queda anulado */
    }
    n++;
  }
  return n;
}

/** Los archivos que dice haber subido, limpios: cada número una vez, del 1 al máximo del enlace. */
function sentDocs(answers: Record<string, unknown>): SentDoc[] {
  const list = Array.isArray(answers.docs) ? answers.docs : [];
  const seen = new Set<number>();
  const out: SentDoc[] = [];
  for (const d of list) {
    if (typeof d !== "object" || d === null) continue;
    const { n, name, size } = d as Record<string, unknown>;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > DOCS_PER_LINK || seen.has(n)) continue;
    seen.add(n);
    out.push({ n, name: cleanName(typeof name === "string" ? name : ""), size: typeof size === "number" && size > 0 && size <= MAX_DOC_BYTES ? Math.round(size) : 0 });
  }
  return out;
}

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
    if (sent.kind === DOCS_KIND) {
      // Cada archivo: la clínica se lo guarda en el servidor y se apunta en su ficha (ya subido, cifrado con la clave
      // del enlace). Si uno ya no está en el servidor, se deja fuera; si falla otra cosa, se vuelve a intentar después.
      const docs = sentDocs(incoming);
      const kept: SentDoc[] = [];
      for (const d of docs) {
        const docId = `${f.id}.${d.n}`;
        try {
          await api.keepDoc(docId);
        } catch (e) {
          if (e instanceof ServerError && e.status === 404) continue;
          throw e;
        }
        kept.push(d);
        if (await getDocument(db, docId)) continue;
        await addDocument(db, {
          id: docId,
          patientId: sent.patientId,
          episodeId: episode,
          name: d.name,
          mime: "application/pdf",
          size: d.size,
          key: sent.key,
          source: "patient",
          formId: f.id,
          uploadedAt: f.answeredAt,
          createdAt: f.answeredAt,
        });
      }
      await markImported(db, f.id, { answeredAt: f.answeredAt, answers: { docs: kept }, skipped: [] });
      await api.remove(f.id);
      out.push({ patientId: sent.patientId, name: patient?.name ?? "", kind: sent.kind, skipped: 0, incomplete: false, files: kept.length });
      continue;
    }
    if (isSignKind(sent.kind)) {
      // Firmó en su móvil por un enlace de los que ya no se recogen: no se guarda nada; el envío queda anulado, se
      // borra del servidor y se avisa para firmarlo en la clínica.
      await cancelSentForm(db, f.id);
      await api.remove(f.id);
      out.push({ patientId: sent.patientId, name: patient?.name ?? "", kind: sent.kind, skipped: 0, incomplete: false, refused: true });
      continue;
    }
    if (sent.kind === ANAMNESIS_KIND) {
      const current = (await getAnamnesisOf(db, sent.patientId, episode))?.answers ?? {};
      // Solo las preguntas que se le mandaron (migración 036); los envíos de antes, con la plantilla de ahora.
      const m = mergeAnamnesis(current, incoming, template, sent.meta?.fields);
      if (m.filled.length) await saveAnamnesisOf(db, sent.patientId, episode, m.merged);
      skipped = m.skipped;
      // Paciente nuevo: el acuse de la información y, si la marcó, la petición de contacto, con la hora del servidor y
      // el texto que mandó la clínica (no el que diga la respuesta). Solo si el envío llevaba esa información.
      let intake: { ack: boolean; contact: boolean } | null = null;
      const given = incoming.__intake;
      if (sent.meta?.intake && typeof given === "object" && given !== null) {
        const { ack, contact } = given as Record<string, unknown>;
        intake = { ack: ack === true, contact: contact === true };
        await recordIntake(db, sent.patientId, {
          ...(intake.ack ? { ack: { at: f.answeredAt, formId: f.id, version: sent.meta.intake.version } } : {}),
          ...(intake.contact ? { request: { at: f.answeredAt, formId: f.id, text: sent.meta.intake.contactText, version: sent.meta.intake.version } } : {}),
        });
      }
      await markImported(db, f.id, { answeredAt: f.answeredAt, answers: intake ? { ...m.clean, __intake: intake } : m.clean, skipped });
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
