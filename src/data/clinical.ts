// Ficha clínica: anamnesis, sesiones (con la siguiente cita, migración 007), hallazgos de la exploración y
// cuestionarios (migración 006). Mismo estilo que repo.ts:
// una función por operación; las pantallas no escriben SQL.
import { markAttended, nextAppointmentOf, sessionAppointmentSql, upcomingAppointments, type Worker } from "./appointments";
import type { Db } from "./db";
import { currentEpisode, getEpisodeAnswers, inFocus, saveEpisodeAnswers } from "./episodes";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- Anamnesis ----------

/** Respuesta de un campo: texto, número, sí/no o varias opciones marcadas. */
export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;
export type Anamnesis = { answers: Answers; createdAt: string; updatedAt: string };

/** La anamnesis del motivo de consulta que se está viendo (src/data/episodes.ts). */
export async function getAnamnesis(db: Db, patientId: string): Promise<Anamnesis | null> {
  const episode = await currentEpisode(db, patientId);
  if (episode !== patientId) {
    const a = await getEpisodeAnswers(db, episode);
    return a && Object.keys(a.answers).length ? a : null;
  }
  const [row] = await db.query<{ answers: string; created_at: string; updated_at: string }>(
    "select answers, created_at, updated_at from anamnesis where patient_id = ?",
    [patientId],
  );
  return row ? { answers: JSON.parse(row.answers) as Answers, createdAt: row.created_at, updatedAt: row.updated_at } : null;
}

/** Guarda la anamnesis entera. Quita las respuestas vacías para que «relleno» quiera decir algo. */
export async function saveAnamnesis(db: Db, patientId: string, answers: Answers): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(answers).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "number" && Number.isNaN(v))),
  );
  const episode = await currentEpisode(db, patientId);
  if (episode !== patientId) return saveEpisodeAnswers(db, episode, clean);
  const t = now();
  await db.transaction([
    {
      sql: `insert into anamnesis (patient_id, answers, created_at, updated_at) values (?, ?, ?, ?)
            on conflict (patient_id) do update set answers = excluded.answers, updated_at = excluded.updated_at`,
      bind: [patientId, JSON.stringify(clean), t, t],
    },
  ]);
}

// ---------- Sesiones ----------

export type SessionInput = {
  performedAt: string;
  pain: number | null;
  subjective: string;
  objective: string;
  treatment: string;
  plan: string;
  /** AAAA-MM-DD. */
  reviewOn: string | null;
  /** Siguiente cita (ISO) y cuánto dura, en minutos. */
  nextAt: string | null;
  nextMinutes: number | null;
};
export type Session = SessionInput & { id: string; patientId: string };

type SessionRow = {
  id: string;
  patient_id: string;
  performed_at: string;
  pain: number | null;
  subjective: string;
  objective: string;
  treatment: string;
  plan: string;
  review_on: string | null;
  next_at: string | null;
  next_minutes: number | null;
};

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  patientId: r.patient_id,
  performedAt: r.performed_at,
  pain: r.pain,
  subjective: r.subjective,
  objective: r.objective,
  treatment: r.treatment,
  plan: r.plan,
  reviewOn: r.review_on,
  nextAt: r.next_at,
  nextMinutes: r.next_minutes,
});

function checkSession(s: SessionInput) {
  if (Number.isNaN(Date.parse(s.performedAt))) throw new RangeError("Pon la fecha de la sesión.");
  if (s.pain !== null && !(Number.isInteger(s.pain) && s.pain >= 0 && s.pain <= 10)) throw new RangeError("El dolor va de 0 a 10.");
  if (s.reviewOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.reviewOn)) throw new RangeError("La fecha de reevaluación no es válida.");
  if (s.nextAt !== null) {
    if (Number.isNaN(Date.parse(s.nextAt))) throw new RangeError("La fecha de la siguiente cita no es válida.");
    if (Date.parse(s.nextAt) <= Date.parse(s.performedAt)) throw new RangeError("La siguiente cita tiene que ser después de esta sesión.");
    if (!(Number.isInteger(s.nextMinutes) && s.nextMinutes! >= 5 && s.nextMinutes! <= 480)) throw new RangeError("Elige cuánto dura la siguiente cita.");
  }
}

const sessionBind = (s: SessionInput) => [
  s.performedAt,
  s.pain,
  s.subjective.trim(),
  s.objective.trim(),
  s.treatment.trim(),
  s.plan.trim(),
  s.reviewOn,
  s.nextAt,
  s.nextAt === null ? null : s.nextMinutes,
];

/** Crea la sesión (sin id) o la actualiza. Devuelve su id. */
export async function saveSession(db: Db, patientId: string, input: SessionInput, id?: string): Promise<string> {
  checkSession(input);
  const t = now();
  // La siguiente cita va también a la agenda (src/data/appointments.ts), con el id de la sesión.
  const next = input.nextAt === null ? null : new Date(input.nextAt).toISOString();
  if (id) {
    await db.transaction([
      {
        sql: `update sessions set performed_at = ?, pain = ?, subjective = ?, objective = ?, treatment = ?, plan = ?, review_on = ?, next_at = ?,
                      next_minutes = ?, updated_at = ?
               where id = ? and patient_id = ?`,
        bind: [...sessionBind(input), t, id, patientId],
      },
      ...sessionAppointmentSql(id, patientId, next, input.nextMinutes, t),
    ]);
    return id;
  }
  const nid = newId();
  await db.transaction([
    {
      sql: `insert into sessions (performed_at, pain, subjective, objective, treatment, plan, review_on, next_at, next_minutes, id, patient_id,
                                  created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [...sessionBind(input), nid, patientId, t, t],
    },
    ...(next ? sessionAppointmentSql(nid, patientId, next, input.nextMinutes, t) : []),
  ]);
  await markAttended(db, patientId, input.performedAt, nid);
  return nid;
}

/** Sesiones del paciente, la más reciente primero. */
export async function listSessions(db: Db, patientId: string): Promise<Session[]> {
  const rows = await db.query<SessionRow>(`select * from sessions s where patient_id = ? and ${inFocus("s")} order by performed_at desc`, [patientId]);
  return rows.map(toSession);
}

export async function getSession(db: Db, id: string): Promise<Session | null> {
  const [row] = await db.query<SessionRow>("select * from sessions where id = ?", [id]);
  return row ? toSession(row) : null;
}

/** Borra la sesión y, si sigue pendiente, la cita que se dio en ella. */
export async function deleteSession(db: Db, id: string): Promise<void> {
  await db.transaction([
    { sql: "delete from sessions where id = ?", bind: [id] },
    { sql: "delete from appointments where id = ? and status = 'scheduled'", bind: [id] },
  ]);
}

/**
 * Cuántas sesiones lleva el motivo de consulta que se ve y cuántas tiene previstas («Sesiones previstas (o del bono)»
 * en su anamnesis; null si no se ha puesto).
 */
export async function sessionCount(db: Db, patientId: string): Promise<{ done: number; planned: number | null }> {
  const episode = await currentEpisode(db, patientId);
  const [row] = await db.query<{ n: number }>("select count(*) as n from sessions where patient_id = ? and coalesce(episode_id, patient_id) = ?", [patientId, episode]);
  const v = (await getAnamnesis(db, patientId))?.answers.sesiones_previstas;
  const planned = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return { done: row!.n, planned: Number.isInteger(planned) && planned > 0 ? planned : null };
}

/** La siguiente cita que quedó puesta en la última sesión, si aún no ha pasado. */
export function nextVisit(sessions: Session[], now = new Date()): Session | null {
  const last = sessions[0];
  return last?.nextAt && Date.parse(last.nextAt) > now.getTime() ? last : null;
}

/** La próxima cita pendiente de un paciente, si la hay (con la forma de la «siguiente cita» de una sesión). */
export async function nextVisitOf(db: Db, patientId: string, now = new Date()): Promise<{ id: string; nextAt: string; nextMinutes: number | null } | null> {
  const a = await nextAppointmentOf(db, patientId, now);
  return a ? { id: a.id, nextAt: a.startsAt, nextMinutes: a.minutes } : null;
}

/** Todas las citas pendientes que aún no han llegado, para el calendario y la pantalla de inicio. */
export async function upcomingVisits(
  db: Db,
  now = new Date(),
  by: Worker | null = null,
): Promise<{ id: string; patientId: string; name: string; nextAt: string; nextMinutes: number | null }[]> {
  return (await upcomingAppointments(db, now, by)).map((a) => ({ id: a.id, patientId: a.patientId, name: a.name, nextAt: a.startsAt, nextMinutes: a.minutes }));
}

/** Pacientes con una reevaluación pendiente hasta `day` (AAAA-MM-DD): la última fecha que se les puso. */
export async function dueReviews(db: Db, day: string): Promise<{ patientId: string; name: string; reviewOn: string }[]> {
  return db.query(
    `select p.id as patientId, p.name, s.review_on as reviewOn
       from patients p
       join sessions s on s.id = (select s2.id from sessions s2 where s2.patient_id = p.id order by s2.performed_at desc limit 1)
      where s.review_on is not null and s.review_on <= ?
      order by s.review_on, p.name collate nocase`,
    [day],
  );
}

// ---------- Exploración: tests especiales ----------

export type FindingResult = "positive" | "negative" | "inconclusive";
export type FindingSide = "left" | "right" | "both";
export type FindingInput = {
  galleryTest: string;
  testName: string;
  region: string;
  performedAt: string;
  side: FindingSide | null;
  result: FindingResult;
  notes: string;
};
export type Finding = FindingInput & { id: string; patientId: string };

type FindingRow = {
  id: string;
  patient_id: string;
  gallery_test: string;
  test_name: string;
  region: string;
  performed_at: string;
  side: FindingSide | null;
  result: FindingResult;
  notes: string;
};

const toFinding = (r: FindingRow): Finding => ({
  id: r.id,
  patientId: r.patient_id,
  galleryTest: r.gallery_test,
  testName: r.test_name,
  region: r.region,
  performedAt: r.performed_at,
  side: r.side,
  result: r.result,
  notes: r.notes,
});

const findingBind = (f: FindingInput) => [f.galleryTest, f.testName, f.region, f.performedAt, f.side, f.result, f.notes.trim()];

/** Crea el hallazgo (sin id) o lo actualiza. Devuelve su id. */
export async function saveFinding(db: Db, patientId: string, input: FindingInput, id?: string): Promise<string> {
  if (!input.galleryTest || !input.testName.trim()) throw new RangeError("Elige el test.");
  if (Number.isNaN(Date.parse(input.performedAt))) throw new RangeError("Pon la fecha.");
  const t = now();
  if (id) {
    await db.transaction([
      {
        sql: `update findings set gallery_test = ?, test_name = ?, region = ?, performed_at = ?, side = ?, result = ?, notes = ?, updated_at = ?
               where id = ? and patient_id = ?`,
        bind: [...findingBind(input), t, id, patientId],
      },
    ]);
    return id;
  }
  const nid = newId();
  await db.transaction([
    {
      sql: `insert into findings (gallery_test, test_name, region, performed_at, side, result, notes, id, patient_id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [...findingBind(input), nid, patientId, t, t],
    },
  ]);
  return nid;
}

/** Hallazgos del paciente, el más reciente primero. */
export async function listFindings(db: Db, patientId: string): Promise<Finding[]> {
  const rows = await db.query<FindingRow>(`select * from findings f where patient_id = ? and ${inFocus("f")} order by performed_at desc, created_at desc`, [patientId]);
  return rows.map(toFinding);
}

export async function getFinding(db: Db, id: string): Promise<Finding | null> {
  const [row] = await db.query<FindingRow>("select * from findings where id = ?", [id]);
  return row ? toFinding(row) : null;
}

export async function deleteFinding(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from findings where id = ?", bind: [id] }]);
}

/** El último resultado de cada test (y lado): lo que hoy se sabe de la exploración. */
export function latestFindings(all: Finding[]): Finding[] {
  const seen = new Set<string>();
  return all.filter((f) => {
    const k = `${f.galleryTest}|${f.side ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- Cuestionarios ----------

export type QuestionnaireInput = {
  kind: string;
  performedAt: string;
  score: number;
  /** PSFS: actividades; KOOS/HOOS: subescala; «otro»: nombre, rango y qué es mejor (src/clinical/questionnaires.ts). */
  details: Record<string, unknown>;
  notes: string;
};
export type Questionnaire = QuestionnaireInput & { id: string; patientId: string };

type QuestionnaireRow = { id: string; patient_id: string; kind: string; performed_at: string; score: number; details: string; notes: string };
const toQuestionnaire = (r: QuestionnaireRow): Questionnaire => ({
  id: r.id,
  patientId: r.patient_id,
  kind: r.kind,
  performedAt: r.performed_at,
  score: r.score,
  details: JSON.parse(r.details) as Record<string, unknown>,
  notes: r.notes,
});

/** Crea el registro (sin id) o lo actualiza. Devuelve su id. */
export async function saveQuestionnaire(db: Db, patientId: string, input: QuestionnaireInput, id?: string): Promise<string> {
  if (!input.kind) throw new RangeError("Elige el cuestionario.");
  if (!Number.isFinite(input.score)) throw new RangeError("Escribe la puntuación.");
  if (Number.isNaN(Date.parse(input.performedAt))) throw new RangeError("Pon la fecha.");
  const t = now();
  const values = [input.kind, input.performedAt, input.score, JSON.stringify(input.details), input.notes.trim()];
  if (id) {
    await db.transaction([
      { sql: "update questionnaires set kind = ?, performed_at = ?, score = ?, details = ?, notes = ?, updated_at = ? where id = ? and patient_id = ?", bind: [...values, t, id, patientId] },
    ]);
    return id;
  }
  const nid = newId();
  await db.transaction([
    {
      sql: "insert into questionnaires (kind, performed_at, score, details, notes, id, patient_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      bind: [...values, nid, patientId, t, t],
    },
  ]);
  return nid;
}

/** Cuestionarios del paciente, el más reciente primero. */
export async function listQuestionnaires(db: Db, patientId: string): Promise<Questionnaire[]> {
  const rows = await db.query<QuestionnaireRow>(`select * from questionnaires q where patient_id = ? and ${inFocus("q")} order by performed_at desc, created_at desc`, [patientId]);
  return rows.map(toQuestionnaire);
}

export async function getQuestionnaire(db: Db, id: string): Promise<Questionnaire | null> {
  const [row] = await db.query<QuestionnaireRow>("select * from questionnaires where id = ?", [id]);
  return row ? toQuestionnaire(row) : null;
}

export async function deleteQuestionnaire(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from questionnaires where id = ?", bind: [id] }]);
}
