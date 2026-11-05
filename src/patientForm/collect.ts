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
import type { Field, Section } from "../clinical/anamnesis";
import { RESPONDENT, stampSources, TPL } from "../clinical/answerMeta";
import { isMetaKey } from "../clinical/anamnesis";
import { getSnapshot } from "../data/anamnesisTemplates";
import { buildForm, isOwnKind } from "../clinical/forms/own";
import { getOwnForm, getOwnSnapshot } from "../data/ownForms";
import { ANAMNESIS_KIND, RESPONDENTS, type Respondent, cleanFormAnswers, DOCS_KIND, DOCS_PER_LINK, isSignKind, mergeAnamnesis, saveAnsweredQuestionnaire, unseal, type FormResponse, type SentDoc } from "../clinical/patientForms";

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

/** La plantilla de la clínica: sus apartados y, si se tienen, todas las preguntas que conoce (también ocultas). */
export type CollectTemplate = Section[] | { sections: Section[]; all?: Field[] };

export async function collectAnswered(db: Db, api: FormsApi, tpl: CollectTemplate): Promise<Collected[]> {
  const template = Array.isArray(tpl) ? tpl : tpl.sections;
  const all = Array.isArray(tpl) ? [] : (tpl.all ?? []);
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
      // Con la plantilla con la que se mandó (su instantánea), aunque la clínica la haya cambiado después; si no está
      // (un envío de antes, o aún no ha llegado por la sincronización), con la de ahora.
      const snap = sent.meta?.tpl ? await getSnapshot(db, sent.meta.tpl) : null;
      const m = mergeAnamnesis(current, incoming, snap?.sections ?? template, sent.meta?.fields, [...all, ...(snap?.all ?? [])]);
      // Quién rellenó el de un menor: el propio paciente o su madre, padre o tutor.
      const respondent = sent.meta?.minor && typeof incoming[RESPONDENT] === "string" && incoming[RESPONDENT] in RESPONDENTS ? (incoming[RESPONDENT] as Respondent) : null;
      if (respondent) m.clean[RESPONDENT] = respondent;
      if (m.filled.length) {
        let merged = stampSources(m.merged, m.filled, { by: "patient", at: f.answeredAt, form: f.id });
        // Una anamnesis que estaba vacía se hace con la plantilla del enlace.
        const empty = !Object.entries(current).some(([k, v]) => !isMetaKey(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
        if (empty && sent.meta?.tpl && snap) merged = { ...merged, [TPL]: sent.meta.tpl };
        if (respondent) merged = { ...merged, [RESPONDENT]: respondent };
        await saveAnamnesisOf(db, sent.patientId, episode, merged);
      }
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
      // Un cuestionario propio se recoge con la versión que se mandó (su huella); si ya no estuviera, con la de ahora.
      const ownForm = isOwnKind(sent.kind) ? ((sent.meta?.hash ? await getOwnSnapshot(db, sent.kind, sent.meta.hash) : null) ?? (await getOwnForm(db, sent.kind))?.spec) : undefined;
      const answers = cleanFormAnswers(sent.kind, incoming, ownForm ? buildForm(ownForm) : undefined);
      incomplete = (await saveAnsweredQuestionnaire(db, sent.patientId, episode, sent.kind, answers, f.answeredAt, f.id, ownForm ?? undefined)) === 0;
      await markImported(db, f.id, { answeredAt: f.answeredAt, answers, skipped: [] });
    }
    await api.remove(f.id);
    out.push({ patientId: sent.patientId, name: patient?.name ?? "", kind: sent.kind, skipped: skipped.length, incomplete });
  }
  return out;
}
