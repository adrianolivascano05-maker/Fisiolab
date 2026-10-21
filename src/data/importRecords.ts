// Traer de otro programa las citas (las que vienen, para que la agenda no empiece vacía, y las pasadas) y el historial
// de sesiones (fecha y notas de cada visita). Como con los pacientes (importPatients.ts): se lee un Excel o un CSV,
// se adivina qué es cada columna y se revisa antes de importar. Cada fila se une a su paciente por el nombre; los que
// no existen se pueden crear con su nombre. Lo que ya está (mismo paciente a la misma hora) se salta.
import { fold } from "../app/format";
import type { Db } from "./db";
import { LAST_IMPORT, parseDate, parseNumber, type LastImport } from "./importPatients";
import type { Statement } from "./protocol";
import { setSetting } from "./repo";
import type { AppointmentStatus } from "./appointments";

export type RecordKind = "appointments" | "sessions";
export type RecordField =
  | "patient"
  | "lastName"
  | "date"
  | "time"
  | "end"
  | "minutes"
  | "person"
  | "status"
  | "pain"
  | "subjective"
  | "objective"
  | "treatment"
  | "plan"
  | "notes"
  | "ignore";

export const RECORD_FIELD_LABELS: Record<RecordField, string> = {
  patient: "Paciente (nombre)",
  lastName: "Apellidos del paciente",
  date: "Fecha (o fecha y hora)",
  time: "Hora",
  end: "Hora de fin",
  minutes: "Duración (minutos)",
  person: "Con quién (profesional)",
  status: "Estado de la cita",
  pain: "Dolor (0-10)",
  subjective: "Refiere (subjetivo)",
  objective: "Encuentra (objetivo)",
  treatment: "Tratamiento",
  plan: "Plan y ejercicios",
  notes: "Notas",
  ignore: "No importar",
};

/** Los campos que tienen sentido para cada cosa. */
export const RECORD_FIELDS: Record<RecordKind, RecordField[]> = {
  appointments: ["patient", "lastName", "date", "time", "end", "minutes", "person", "status", "notes", "ignore"],
  sessions: ["patient", "lastName", "date", "time", "pain", "subjective", "objective", "treatment", "plan", "notes", "ignore"],
};

const GUESSES: [RecordField, RegExp][] = [
  ["lastName", /apellido/],
  ["end", /fin|hasta|termina/],
  ["time", /^hora|hora de inicio|inicio|^time$/],
  ["date", /fecha|dia|date|cuando/],
  ["minutes", /duraci|minutos|^min/],
  ["person", /profesional|fisio|terapeuta|doctor|medico|empleado|agenda de|con quien|atendid/],
  ["status", /estado|status|asisti/],
  ["pain", /dolor|eva|ena/],
  ["subjective", /subjetiv|refiere|anamnesis de la sesion/],
  ["objective", /objetiv|exploraci|encuentra/],
  ["treatment", /tratamiento|tecnica|intervenci|realizado/],
  ["plan", /plan|ejercicios|domicilio|pauta/],
  ["patient", /paciente|nombre|cliente|name/],
  ["notes", /nota|observ|comentario|evoluci|descripci|motivo/],
];

/** Qué parece cada columna por su título (lo que no se reconoce va a las notas). */
export function guessRecordFields(kind: RecordKind, headers: string[]): RecordField[] {
  const allowed = new Set(RECORD_FIELDS[kind]);
  return headers.map((h) => {
    const t = fold(h).trim();
    if (!t) return "ignore";
    const f = GUESSES.find(([field, re]) => allowed.has(field) && re.test(t))?.[0];
    return f ?? "notes";
  });
}

/** «10:30», «10.30», «10h», «4 pm» o la fracción de día de Excel (0,4375) → minutos desde las 0:00. */
export function parseTime(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[:.h](\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(v)) || (m = /^(\d{1,2})\s*(?:h|horas?)?\s*(am|pm)?$/.exec(v))) {
    let h = Number(m[1]);
    const min = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0;
    const ampm = m[3] ?? (m[2] && !/^\d{2}$/.test(m[2]) ? m[2] : undefined);
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return h < 24 && min < 60 ? h * 60 + min : null;
  }
  if (/^0?[.,]\d+$/.test(v)) return Math.round(Number(v.replace(",", ".")) * 24 * 60) % (24 * 60);
  return null;
}

/** El instante (ISO) de una fecha con hora (en la hora del dispositivo). La hora puede venir en la misma celda. */
export function parseDateTime(dateRaw: string, timeRaw = ""): string | null {
  const d = dateRaw.trim();
  const day = parseDate(d, new Date(), { future: true });
  if (!day) return null;
  let minutes = parseTime(timeRaw);
  if (minutes === null) {
    // La hora dentro de la fecha: «12/03/2026 10:30», «2026-03-12T10:30» o un número de serie con decimales.
    const inside = /[ T](\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:am|pm)?)$/i.exec(d)?.[1] ?? (/^\d{4,5}[.,]\d+$/.test(d) ? `0.${d.split(/[.,]/)[1]}` : null);
    minutes = inside ? parseTime(inside) : null;
  }
  const [y, mo, da] = day.split("-").map(Number) as [number, number, number];
  const at = new Date(y, mo - 1, da, Math.floor((minutes ?? 0) / 60), (minutes ?? 0) % 60);
  return at.toISOString();
}

const STATUS: [AppointmentStatus, RegExp][] = [
  ["cancelled", /anulad|cancelad|suspendid/],
  ["no_show", /no vino|no asist|no present|falt|ausen/],
  ["done", /atendid|realizad|asisti|hecha|complet|confirm/],
  ["scheduled", /pendiente|programad|reservad|citad/],
];

export type RecordRow = {
  line: number;
  patientName: string;
  patientId: string | null;
  startsAt: string;
  duplicate: boolean;
  appointment?: { minutes: number; status: AppointmentStatus; assignedTo: string | null };
  session?: { pain: number | null; subjective: string; objective: string; treatment: string; plan: string };
};
export type RecordPlan = {
  rows: RecordRow[];
  /** Filas sin paciente o sin fecha que valga: no se importan. */
  noPatient: number[];
  badDate: number[];
  /** Pacientes que no existen (se crean con su nombre si se pide). */
  newPatients: string[];
  /** Profesionales que no están en el equipo (la cita queda sin asignar). */
  unknownPeople: string[];
};

type Ctx = {
  headerRow?: boolean;
  /** Los pacientes que hay. */
  patients: { id: string; name: string }[];
  /** Lo que ya hay, para no repetirlo: «paciente|instante». */
  existing?: Set<string>;
  /** El equipo de la clínica (sin clínica, vacío). */
  staff?: { email: string; name: string }[];
  now?: Date;
};

export const recordKey = (patientId: string, startsAt: string) => `${patientId}|${new Date(startsAt).toISOString()}`;
const norm = (t: string) => fold(t).replace(/\s+/g, " ").trim();

export function planRecords(kind: RecordKind, table: string[][], fields: RecordField[], ctx: Ctx): RecordPlan {
  const headerRow = ctx.headerRow ?? true;
  const headers = headerRow ? (table[0] ?? []) : [];
  const body = headerRow ? table.slice(1) : table;
  const byName = new Map(ctx.patients.map((p) => [norm(p.name), p.id]));
  const staff = ctx.staff ?? [];
  const now = ctx.now ?? new Date();
  const seen = new Set(ctx.existing ?? []);
  const plan: RecordPlan = { rows: [], noPatient: [], badDate: [], newPatients: [], unknownPeople: [] };
  body.forEach((cells, i) => {
    const line = i + (headerRow ? 2 : 1);
    const pick = (f: RecordField) => fields.flatMap((field, c) => (field === f && cells[c]?.trim() ? [cells[c]!.trim()] : []));
    const label = (c: number) => headers[c]?.trim() || `Columna ${c + 1}`;
    const notes = fields.flatMap((f, c) => (f === "notes" && cells[c]?.trim() ? [`${label(c)}: ${cells[c]!.trim()}`] : []));
    const patientName = [...pick("patient"), ...pick("lastName")].join(" ").replace(/\s+/g, " ").trim();
    if (!patientName) return void plan.noPatient.push(line);
    const startsAt = parseDateTime(pick("date")[0] ?? "", pick("time")[0] ?? "");
    if (!startsAt) return void plan.badDate.push(line);
    const patientId = byName.get(norm(patientName)) ?? null;
    if (!patientId && !plan.newPatients.some((n) => norm(n) === norm(patientName))) plan.newPatients.push(patientName);
    const key = recordKey(patientId ?? `nuevo:${norm(patientName)}`, startsAt);
    const duplicate = seen.has(key);
    seen.add(key);
    const row: RecordRow = { line, patientName, patientId, startsAt, duplicate };
    if (kind === "appointments") {
      let minutes = parseNumber((pick("minutes")[0] ?? "").replace(/\s*min(utos)?$/i, "")) ?? null;
      const endRaw = pick("end")[0];
      if (minutes === null && endRaw) {
        const end = parseTime(endRaw) ?? (parseDateTime(endRaw) ? new Date(parseDateTime(endRaw)!).getHours() * 60 + new Date(parseDateTime(endRaw)!).getMinutes() : null);
        const start = new Date(startsAt).getHours() * 60 + new Date(startsAt).getMinutes();
        if (end !== null && end > start) minutes = end - start;
      }
      if (minutes === null || minutes < 5 || minutes > 480) minutes = 45;
      const personRaw = pick("person")[0] ?? "";
      const person = personRaw ? (staff.find((p) => norm(p.email) === norm(personRaw) || norm(p.name) === norm(personRaw) || norm(p.name).split(" ")[0] === norm(personRaw)) ?? null) : null;
      if (personRaw && !person && staff.length && !plan.unknownPeople.includes(personRaw)) plan.unknownPeople.push(personRaw);
      const statusRaw = norm(pick("status")[0] ?? "");
      const status = STATUS.find(([, re]) => re.test(statusRaw))?.[0] ?? (new Date(startsAt) < now ? "done" : "scheduled");
      row.appointment = { minutes: Math.round(minutes), status, assignedTo: person?.email ?? null };
    } else {
      const pain = parseNumber(pick("pain")[0] ?? "");
      const join = (f: RecordField) => pick(f).join("\n");
      row.session = {
        pain: pain !== null && pain >= 0 && pain <= 10 ? Math.round(pain) : null,
        subjective: join("subjective"),
        objective: join("objective"),
        // Las notas sin más (la «evolución» de muchos programas) van con el tratamiento, que es lo que se ve en la historia.
        treatment: [join("treatment"), ...notes].filter(Boolean).join("\n"),
        plan: join("plan"),
      };
    }
    plan.rows.push(row);
  });
  return plan;
}

/** Lo que ya hay de ese tipo («paciente|instante»), para saltarlo al importar. */
export async function existingKeys(db: Db, kind: RecordKind): Promise<Set<string>> {
  const rows =
    kind === "appointments"
      ? await db.query<{ p: string; at: string }>("select patient_id as p, starts_at as at from appointments")
      : await db.query<{ p: string; at: string }>("select patient_id as p, performed_at as at from sessions");
  return new Set(rows.map((r) => recordKey(r.p, r.at)));
}

/**
 * Importa las filas (sin las repetidas). `createMissing`: crea con su nombre los pacientes que no existen (si no, sus
 * filas se saltan). Apunta la importación para poder deshacerla. Devuelve cuántas filas y pacientes nuevos.
 */
export async function importRecords(db: Db, kind: RecordKind, plan: RecordPlan, file: string, { createMissing = true } = {}): Promise<{ records: number; patients: number }> {
  const t = new Date().toISOString();
  const created = new Map<string, string>();
  const statements: Statement[] = [];
  if (createMissing)
    for (const name of plan.newPatients) {
      const id = crypto.randomUUID();
      created.set(norm(name), id);
      statements.push({
        sql: "insert into patients (id, name, notes, created_at, updated_at) values (?, ?, ?, ?, ?)",
        bind: [id, name, `Creado al importar ${kind === "appointments" ? "citas" : "sesiones"} de «${file}».`, t, t],
      });
    }
  const ids: string[] = [];
  for (const r of plan.rows) {
    if (r.duplicate) continue;
    const patientId = r.patientId ?? created.get(norm(r.patientName));
    if (!patientId) continue;
    const id = crypto.randomUUID();
    ids.push(id);
    if (r.appointment)
      statements.push({
        sql: "insert into appointments (id, patient_id, starts_at, minutes, status, created_by, assigned_to, created_at, updated_at) values (?, ?, ?, ?, ?, null, ?, ?, ?)",
        bind: [id, patientId, r.startsAt, r.appointment.minutes, r.appointment.status, r.appointment.assignedTo, t, t],
      });
    else if (r.session)
      statements.push({
        sql: `insert into sessions (id, patient_id, performed_at, pain, subjective, objective, treatment, plan, created_at, updated_at)
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bind: [id, patientId, r.startsAt, r.session.pain, r.session.subjective, r.session.objective, r.session.treatment, r.session.plan, t, t],
      });
  }
  for (let i = 0; i < statements.length; i += 500) await db.transaction(statements.slice(i, i + 500));
  await setSetting(db, LAST_IMPORT, {
    at: t,
    file,
    ids: [...created.values()],
    ...(kind === "appointments" ? { appointments: ids } : { sessions: ids }),
  } satisfies LastImport);
  return { records: ids.length, patients: created.size };
}
