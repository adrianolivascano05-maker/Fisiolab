// Buscar pacientes en la base sin cargarlos todos: por nombre, teléfono o DNI (y cualquier otro dato de la ficha:
// email, notas, motivo y diagnóstico), con filtros (edad, sexo, fisio, cita próxima, cuándo vino por última vez, algo
// pendiente de cobrar o de firmar) y por páginas. Con 10.000 pacientes, la lista trae solo los 50 que se ven.
// Busca igual que matchesPatient (repo.ts): sin tildes ni mayúsculas, y un teléfono con o sin espacios.
import { fold } from "../app/format";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";
import { pendingAccounts } from "./billing";
import type { Answers } from "./clinical";
import type { Db } from "./db";
import { ALL } from "./episodes";
import type { Patient, PatientSummary, Sex } from "./repo";

/** Cuándo vino por última vez: en los últimos N días, hace más de N días o nunca. */
export type LastVisit = "7" | "30" | "90" | "mas90" | "mas180" | "mas365" | "nunca";
export const LAST_VISITS: { id: LastVisit; label: string }[] = [
  { id: "7", label: "En la última semana" },
  { id: "30", label: "En el último mes" },
  { id: "90", label: "En los últimos 3 meses" },
  { id: "mas90", label: "Hace más de 3 meses" },
  { id: "mas180", label: "Hace más de 6 meses" },
  { id: "mas365", label: "Hace más de un año" },
  { id: "nunca", label: "Nunca ha venido" },
];

export type Pending = "cobrar" | "firmar" | "algo";
export const PENDINGS: { id: Pending; label: string }[] = [
  { id: "algo", label: "De cobrar o de firmar" },
  { id: "cobrar", label: "De cobrar" },
  { id: "firmar", label: "De firmar" },
];

export type PatientFilters = {
  ageFrom: number | null;
  ageTo: number | null;
  sex: Sex | null;
  /**
   * Correo de alguien del equipo: los pacientes que tiene asignados (src/data/patientStaff.ts) y, de los que no
   * tienen a nadie asignado, los que tienen alguna cita suya (no anulada).
   */
  physio: string | null;
  /** Con alguna cita pendiente. */
  upcoming: boolean;
  lastVisit: LastVisit | null;
  pending: Pending | null;
};
export const NO_FILTERS: PatientFilters = { ageFrom: null, ageTo: null, sex: null, physio: null, upcoming: false, lastVisit: null, pending: null };

/** Cuántos filtros hay puestos (para el botón «Filtros»). */
export const activeFilters = (f: PatientFilters) =>
  [f.ageFrom !== null || f.ageTo !== null, f.sex, f.physio, f.upcoming, f.lastVisit, f.pending].filter(Boolean).length;

/** Pacientes por página. */
export const PAGE_SIZE = 50;

/** Lo que enseña la lista de cada paciente. */
export type PatientHit = Pick<PatientSummary, "id" | "name" | "phone" | "lastAt" | "nextAt">;

export type PatientQuery = {
  search?: string;
  filters?: PatientFilters;
  /** Solo los que empiezan por esta letra (sin tildes; «#»: los que no empiezan por una letra). */
  letter?: string | null;
  offset?: number;
  limit?: number;
  now?: Date;
  /**
   * Con el filtro de lo pendiente: los que tienen algo pendiente, ya calculados (pendingPatients), para no volver a
   * calcularlo en cada página. Si no se dan, se calculan aquí.
   */
  pending?: Set<string>;
};

type Bind = string | number | null;

/** La última vez que se le atendió o se le registró algo (como lastAt en listPatients). */
const LAST_AT = `(select max(at) from (
    select max(performed_at) as at from tests where patient_id = p.id
    union all select max(performed_at) from sessions where patient_id = p.id
    union all select max(performed_at) from findings where patient_id = p.id
    union all select max(performed_at) from questionnaires where patient_id = p.id
    union all select max(performed_at) from wellness where patient_id = p.id))`;

/** Lo que se busca de la propia ficha (nombre, teléfono, email, DNI y notas): rápido, sin mirar otras tablas. */
const ROW_TEXT = "concat_ws(' ', p.name, p.phone, p.email, p.dni, p.notes)";
/** Todo lo que se puede buscar de un paciente (como searchText en listPatients): además, motivos y diagnósticos. */
const SEARCH_TEXT = `concat_ws(' ', ${ROW_TEXT},
    (select concat_ws(' ', a.answers ->> '$.motivo', a.answers ->> '$.diagnostico_funcional') from anamnesis a where a.patient_id = p.id),
    (select group_concat(concat_ws(' ', e.title, e.answers ->> '$.motivo', e.answers ->> '$.diagnostico_funcional'), ' ')
       from episodes e where e.patient_id = p.id))`;

/** AAAA-MM-DD de un instante en la hora de Madrid. */
const madridDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

/** Las condiciones de la búsqueda y los filtros, con sus valores. `pendingIds`: los que tienen algo pendiente. */
function conditions(q: Required<Pick<PatientQuery, "search" | "filters" | "letter">>, now: Date, pendingIds: string[] | null) {
  const where: string[] = [];
  const bind: Bind[] = [];
  const text = fold(q.search.trim());
  if (text) {
    const digits = text.replace(/\D/g, "");
    const byDigits = digits.length >= 3 && digits.length >= text.replace(/[\s+()-]/g, "").length;
    if (/\p{L}/u.test(text)) {
      // Con letras, en todo: también el motivo y el diagnóstico.
      where.push(`instr(fold(${SEARCH_TEXT}), ?) > 0`);
      bind.push(text);
    } else {
      // Solo cifras (un teléfono o un DNI): en la propia ficha, con o sin espacios. Mirar los motivos de 10.000
      // pacientes para eso tardaría el doble.
      where.push(`(instr(fold(${ROW_TEXT}), ?) > 0${byDigits ? ` or instr(digits(${ROW_TEXT}), ?) > 0` : ""})`);
      bind.push(text, ...(byDigits ? [digits] : []));
    }
  }
  if (q.letter) {
    const first = "substr(fold(trim(p.name)), 1, 1)";
    if (q.letter === "#") where.push(`not (${first} between 'a' and 'z')`);
    else {
      where.push(`${first} = ?`);
      bind.push(fold(q.letter).charAt(0));
    }
  }
  const f = q.filters;
  if (f.ageFrom !== null || f.ageTo !== null) {
    const today = madridDay(now);
    const age = `(cast(strftime('%Y', ?) as integer) - cast(strftime('%Y', p.birth_date) as integer) - (strftime('%m-%d', ?) < strftime('%m-%d', p.birth_date)))`;
    if (f.ageFrom !== null) {
      where.push(`p.birth_date is not null and ${age} >= ?`);
      bind.push(today, today, f.ageFrom);
    }
    if (f.ageTo !== null) {
      where.push(`p.birth_date is not null and ${age} <= ?`);
      bind.push(today, today, f.ageTo);
    }
  }
  if (f.sex) {
    where.push("p.sex = ?");
    bind.push(f.sex);
  }
  if (f.physio) {
    where.push(`(exists (select 1 from patient_staff s where s.patient_id = p.id and s.staff_email = ?)
      or (not exists (select 1 from patient_staff s where s.patient_id = p.id)
          and exists (select 1 from appointments a where a.patient_id = p.id and a.assigned_to = ? and a.status <> 'cancelled')))`);
    bind.push(f.physio, f.physio);
  }
  if (f.upcoming) {
    where.push("exists (select 1 from appointments a where a.patient_id = p.id and a.status = 'scheduled' and a.starts_at > ?)");
    bind.push(now.toISOString());
  }
  if (f.lastVisit === "nunca") where.push(`${LAST_AT} is null`);
  else if (f.lastVisit) {
    const older = f.lastVisit.startsWith("mas");
    where.push(`${LAST_AT} ${older ? "<" : ">="} ?`);
    bind.push(daysAgo(now, Number(f.lastVisit.replace("mas", ""))));
  }
  if (pendingIds) {
    where.push("p.id in (select value from json_each(?))");
    bind.push(JSON.stringify(pendingIds));
  }
  return { sql: where.length ? `where ${where.join(" and ")}` : "", bind };
}

/** Una página de pacientes de la A a la Z (sin tildes), con cuántos hay en total con lo buscado y los filtros. */
export async function findPatients(db: Db, query: PatientQuery = {}): Promise<{ rows: PatientHit[]; total: number }> {
  const now = query.now ?? new Date();
  const filters = query.filters ?? NO_FILTERS;
  const pendingIds = filters.pending ? [...(query.pending ?? (await pendingPatients(db, filters.pending, now)))] : null;
  const { sql, bind } = conditions({ search: query.search ?? "", filters, letter: query.letter ?? null }, now, pendingIds);
  const limit = query.limit ?? PAGE_SIZE;
  const offset = query.offset ?? 0;
  // Una sola pasada: la página y, con ella, cuántos hay en total. Lo que cuesta (cuándo vino y su próxima cita), solo
  // de los de esta página.
  const found = await db.query<PatientHit & { total: number }>(
    `with page as (select p.id, count(*) over () as total from patients p ${sql} order by fold(p.name), p.name collate nocase, p.id limit ? offset ?)
     select p.id, p.name, coalesce(p.phone, '') as phone, ${LAST_AT} as lastAt,
            (select min(a.starts_at) from appointments a where a.patient_id = p.id and a.status = 'scheduled' and a.starts_at > ?) as nextAt,
            page.total
       from page join patients p on p.id = page.id
      order by fold(p.name), p.name collate nocase, p.id`,
    [...bind, limit, offset, now.toISOString()],
  );
  // Una página vacía no dice cuántos hay (más allá del final, o sin pedir ninguno): se cuentan aparte.
  const total = found.length ? Number(found[0]!.total) : offset || limit === 0 ? Number((await db.query<{ n: number }>(`select count(*) as n from patients p ${sql}`, bind))[0]?.n ?? 0) : 0;
  return { rows: found.map(({ total: _, ...r }) => r), total };
}

/** Los que tienen algo pendiente de cobrar, de firmar o de cualquiera de las dos cosas. */
export async function pendingPatients(db: Db, what: Pending, now = new Date()): Promise<Set<string>> {
  const [owe, sign] = await Promise.all([
    what === "firmar" ? [] : pendingAccounts(db, madridDay(now)),
    what === "cobrar" ? new Set<string>() : unsignedPatients(db),
  ]);
  return new Set([...owe.map((d) => d.patientId), ...sign]);
}

/**
 * Los pacientes a los que les falta firmar algo, como avisan su ficha y Agenda › Hoy: la hoja de protección de datos
 * o un consentimiento escrito obligatorio según la anamnesis del motivo que se ve. Todo en una consulta, no paciente
 * a paciente.
 */
export async function unsignedPatients(db: Db): Promise<Set<string>> {
  const rows = await db.query<{ id: string; birth_date: string | null; sex: Sex | null; informed: string | null; answers: string | null; signed: string | null }>(
    `with cur as (
       select p.id, p.birth_date, p.sex, json_extract(p.privacy, '$.informedAt') as informed,
              coalesce((select f.episode_id from episode_focus f where f.patient_id = p.id), '${ALL}') as focus
         from patients p
     ), ep as (
       -- El motivo que se ve (como currentEpisode en episodes.ts): el elegido o, si no, el último abierto.
       select cur.*,
              case when focus <> '${ALL}' and (focus = cur.id or exists (select 1 from episodes e where e.id = focus)) then focus
                   else coalesce((select e.id from episodes e where e.patient_id = cur.id and e.closed_at is null
                                   order by e.started_at desc, e.created_at desc limit 1), cur.id) end as episode
         from cur
     )
     select id, birth_date, sex, informed,
            case when informed is null then null
                 when episode = ep.id then (select a.answers from anamnesis a where a.patient_id = ep.id)
                 else (select e.answers from episodes e where e.id = ep.episode) end as answers,
            -- Los firmados y en vigor del motivo que se ve (como inFocus en episodes.ts).
            case when informed is null then null
                 else (select json_group_array(c.template) from consents c
                        where c.patient_id = ep.id and c.revoked_at is null and focus in ('${ALL}', coalesce(c.episode_id, c.patient_id))) end as signed
       from ep`,
  );
  const out = new Set<string>();
  for (const r of rows) {
    if (!r.informed) {
      out.add(r.id);
      continue;
    }
    const ctx = consentContext({ birthDate: r.birth_date, sex: r.sex } as Patient, r.answers ? (JSON.parse(r.answers) as Answers) : {});
    const signed = new Set(JSON.parse(r.signed ?? "[]") as string[]);
    if (TEMPLATES.some((t) => t.written === "required" && t.suggest(ctx) && !signed.has(t.id))) out.add(r.id);
  }
  return out;
}

/** Si hay algún paciente de verdad (sin los de la demo ni el de medición rápida): para los avisos de la lista. */
export async function hasOwnPatients(db: Db, seedPrefix: string, quick: string): Promise<boolean> {
  const [row] = await db.query<{ n: number }>("select exists (select 1 from patients where substr(name, 1, length(?1)) <> ?1 and name <> ?2) as n", [seedPrefix, quick]);
  return !!row?.n;
}

/** Cuántos pacientes de verdad hay (sin los de la demo ni el de medición rápida). */
export async function countOwnPatients(db: Db, seedPrefix: string, quick: string): Promise<number> {
  const [row] = await db.query<{ n: number }>("select count(*) as n from patients where substr(name, 1, length(?1)) <> ?1 and name <> ?2", [seedPrefix, quick]);
  return Number(row?.n ?? 0);
}
