// «Editado por» (migración 016): quién hizo el último cambio de algo. Cada cambio guarda en sync_changes el dispositivo
// que lo hizo, y cada dispositivo de una clínica dice de quién es (tabla devices). Guardar sin cambiar nada no cuenta.
import type { Db } from "./db";

export type LastEdit = { at: string; email: string | null; name: string | null; mine: boolean };

/** Este dispositivo es de esta persona de la clínica (una vez, o si cambia su nombre). */
export async function ensureDevice(db: Db, email: string, name: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const [row] = await db.query<{ email: string; name: string }>("select d.email, d.name from devices d join sync_state s on s.device = d.device");
  if (row && row.email === e && row.name === name) return;
  await db.transaction([
    {
      sql: `insert into devices (device, email, name, updated_at) values ((select device from sync_state), ?, ?, ?)
            on conflict (device) do update set email = excluded.email, name = excluded.name, updated_at = excluded.updated_at`,
      bind: [e, name, new Date().toISOString()],
    },
  ]);
}

/** Tablas de un paciente con su columna patient_id (además de patients y anamnesis, cuya clave es el paciente). */
export const PATIENT_TABLES = ["episodes", "tests", "wellness", "findings", "sessions", "appointments", "questionnaires", "consents", "packs", "payments", "waitlist", "exercise_plans"];

type Row = { at: string; device: string; email: string | null; name: string | null; here: string };

const pick = async (db: Db, where: string, bind: (string | number)[]): Promise<LastEdit | null> => {
  const [r] = await db.query<Row>(
    `select c.at, c.device, d.email, coalesce(st.name, d.name) as name, (select device from sync_state) as here
       from sync_changes c left join devices d on d.device = c.device left join staff st on st.email = d.email
      where c.op = 'upsert' and (${where}) order by c.at desc limit 1`,
    bind,
  );
  return r ? { at: r.at, email: r.email, name: r.name, mine: r.device === r.here } : null;
};

/** El último cambio de una fila (tabla y clave). */
export function lastEditOf(db: Db, tbl: string, pk: string): Promise<LastEdit | null> {
  return pick(db, "c.tbl = ? and c.pk = ?", [tbl, pk]);
}

/** El último cambio de cualquier cosa de un paciente: su ficha, su anamnesis, sus sesiones, citas, mediciones… */
export function lastEditOfPatient(db: Db, patientId: string): Promise<LastEdit | null> {
  const parts = ["(c.tbl in ('patients', 'anamnesis') and c.pk = ?)", ...PATIENT_TABLES.map((t) => `(c.tbl = '${t}' and c.pk in (select id from ${t} where patient_id = ?))`)];
  return pick(db, parts.join(" or "), Array(parts.length).fill(patientId));
}

/** «Ana Ruiz, hace 5 min» o «tú, hace un momento». */
export function editText(e: LastEdit, now = Date.now()): string {
  const who = e.mine ? "tú" : (e.name ?? e.email ?? "otro dispositivo");
  const min = Math.round((now - Date.parse(e.at)) / 60_000);
  const when =
    min < 1
      ? "hace un momento"
      : min < 60
        ? `hace ${min} min`
        : min < 24 * 60
          ? `hace ${Math.round(min / 60)} h`
          : new Date(e.at).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  return `${who}, ${when}`;
}

const WHAT: Record<string, string> = {
  patients: "los datos",
  anamnesis: "la anamnesis",
  sessions: "una sesión",
  appointments: "una cita",
  findings: "la exploración",
  episodes: "un motivo de consulta",
  questionnaires: "un cuestionario",
  consents: "un consentimiento",
  tests: "una medición",
  wellness: "un registro de bienestar",
  packs: "un bono",
  payments: "un cobro",
  waitlist: "la lista de espera",
  exercise_plans: "una hoja de ejercicios",
  patient_forms: "un formulario para el paciente",
  documents: "un archivo",
};

/**
 * Lo que se acababa de cambiar aquí y otro ha cambiado después (syncMerge.ts, `overwritten`), en frases:
 * «la anamnesis de Lucía Pérez (lo cambió Ana Ruiz)». Solo lo de los pacientes.
 */
export async function describeOverwritten(db: Db, list: { tbl: string; pk: string; device: string }[]): Promise<string[]> {
  const out: string[] = [];
  for (const o of list) {
    if (!(o.tbl in WHAT)) continue;
    const patientId =
      o.tbl === "patients" || o.tbl === "anamnesis" ? o.pk : (await db.query<{ p: string }>(`select patient_id as p from ${o.tbl} where id = ?`, [o.pk]))[0]?.p;
    const [p] = patientId ? await db.query<{ name: string }>("select name from patients where id = ?", [patientId]) : [];
    const [who] = await db.query<{ name: string }>("select coalesce(st.name, d.name) as name from devices d left join staff st on st.email = d.email where d.device = ?", [o.device]);
    out.push(`${WHAT[o.tbl]}${p ? ` de ${p.name}` : ""} (lo cambió ${who?.name ?? "otro dispositivo"})`);
  }
  return [...new Set(out)];
}
