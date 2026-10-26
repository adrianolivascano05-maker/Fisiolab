// «Cambios sustituidos» (migración 033): lo que este dispositivo había cambiado y otro ha cambiado a la vez con otro
// valor. Se quedó lo del otro (el cambio más reciente), pero lo de aquí se guarda tres meses para poder recuperarlo.
import { answerText, getField } from "../clinical/anamnesis";
import type { Db } from "./db";

export type LostChange = {
  id: number;
  /** «Teléfono», «Motivo de consulta». */
  what: string;
  /** De quién es la ficha, si es de un paciente. */
  patient: { id: string; name: string } | null;
  mine: string;
  theirs: string;
  /** Quién lo cambió después (su nombre, o null si no se sabe). */
  by: string | null;
  /** Cuándo se perdió. */
  at: string;
  /** Ya no se puede recuperar: la ficha se ha borrado. */
  gone: boolean;
};

const LABELS: Record<string, Record<string, string>> = {
  patients: {
    name: "Nombre",
    birth_date: "Fecha de nacimiento",
    sex: "Sexo",
    body_mass_kg: "Peso",
    height_cm: "Altura",
    leg_length_cm: "Longitud de la pierna",
    pushoff_distance_cm: "Distancia de empuje",
    notes: "Notas",
    phone: "Teléfono",
    email: "Correo",
    address: "Dirección",
    dni: "DNI",
    privacy: "Protección de datos",
  },
  appointments: { starts_at: "Día y hora de la cita", minutes: "Duración de la cita", status: "Estado de la cita", assigned_to: "Con quién es la cita" },
  sessions: {
    performed_at: "Fecha de la sesión",
    pain: "Dolor de la sesión",
    subjective: "Refiere (sesión)",
    objective: "Encuentra (sesión)",
    treatment: "Tratamiento (sesión)",
    plan: "Plan (sesión)",
  },
  episodes: { title: "Nombre del motivo de consulta", closed_at: "Alta del motivo de consulta" },
};
const SEX: Record<string, string> = { female: "Mujer", male: "Hombre", other: "Otro" };
const STATUS: Record<string, string> = { scheduled: "Pendiente", done: "Atendida", no_show: "No vino", cancelled: "Anulada" };

const parse = (v: string | null): unknown => {
  if (v === null) return undefined;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return v;
  }
};

/** Un valor guardado, para leerlo. */
function valueText(tbl: string, field: string, v: unknown): string {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return "(vacío)";
  const dot = field.indexOf(".");
  if (dot > 0) return answerText(getField(field.slice(dot + 1)), v as never) || "(vacío)";
  if (field === "sex" && typeof v === "string") return SEX[v] ?? v;
  if (tbl === "appointments" && field === "status" && typeof v === "string") return STATUS[v] ?? v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))
    return new Date(v).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const text = typeof v === "string" ? v : typeof v === "number" ? String(v).replace(".", ",") : JSON.stringify(v);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Qué es el campo, en palabras. */
function fieldText(tbl: string, field: string): string {
  const dot = field.indexOf(".");
  if (dot > 0) {
    const label = getField(field.slice(dot + 1))?.label ?? field.slice(dot + 1).replaceAll("_", " ");
    return tbl === "episodes" ? `${label} (motivo de consulta)` : label;
  }
  return LABELS[tbl]?.[field] ?? field.replaceAll("_", " ");
}

/** La columna de la clave de cada tabla (las demás, «id»). */
const KEY: Record<string, string> = { anamnesis: "patient_id", settings: "key", staff: "email", devices: "device" };

type Raw = { id: number; tbl: string; pk: string; field: string; mine: string | null; theirs: string | null; by_device: string; at: string };

/** Lo que se ha perdido en este dispositivo, de lo más reciente a lo más antiguo. */
export async function lostChanges(db: Db): Promise<LostChange[]> {
  const rows = await db.query<Raw>("select id, tbl, pk, field, mine, theirs, by_device, at from sync_conflicts order by at desc, id desc");
  const out: LostChange[] = [];
  for (const r of rows) {
    const patientId =
      r.tbl === "patients" || r.tbl === "anamnesis"
        ? r.pk
        : ["appointments", "sessions", "episodes"].includes(r.tbl)
          ? (await db.query<{ p: string }>(`select patient_id as p from ${r.tbl} where id = ?`, [r.pk]))[0]?.p
          : undefined;
    const [p] = patientId ? await db.query<{ id: string; name: string }>("select id, name from patients where id = ?", [patientId]) : [];
    const [who] = await db.query<{ name: string }>("select coalesce(st.name, d.name) as name from devices d left join staff st on st.email = d.email where d.device = ?", [r.by_device]);
    const exists = await db.query(`select 1 from ${r.tbl} where ${KEY[r.tbl] ?? "id"} = ?`, [r.pk]).catch(() => []);
    out.push({
      id: r.id,
      what: fieldText(r.tbl, r.field),
      patient: p ?? null,
      mine: valueText(r.tbl, r.field, parse(r.mine)),
      theirs: valueText(r.tbl, r.field, parse(r.theirs)),
      by: who?.name ?? null,
      at: r.at,
      gone: !exists.length,
    });
  }
  return out;
}

export async function lostCount(db: Db): Promise<number> {
  const [r] = await db.query<{ n: number }>("select count(*) as n from sync_conflicts");
  return r?.n ?? 0;
}

/**
 * Vuelve a poner lo de aquí: es un cambio nuevo, de ahora (y se sincroniza como cualquier otro). Si la ficha ya no
 * existe, no hace nada. En los dos casos, deja de estar en la lista.
 */
export async function recoverLost(db: Db, id: number): Promise<boolean> {
  const [r] = await db.query<Raw>("select id, tbl, pk, field, mine from sync_conflicts where id = ?", [id]);
  if (!r) return false;
  const key = KEY[r.tbl] ?? "id";
  const [exists] = await db.query(`select 1 from ${r.tbl} where ${key} = ?`, [r.pk]);
  const done = { sql: "delete from sync_conflicts where id = ?", bind: [id] };
  if (!exists || !/^[a-z_]+(\.[\w-]+)?$/.test(r.field)) {
    await db.transaction([done]);
    return false;
  }
  const value = parse(r.mine);
  const dot = r.field.indexOf(".");
  const hasUpdated = (await db.query<{ name: string }>(`select name from pragma_table_info('${r.tbl}') where name = 'updated_at'`)).length > 0;
  const stamp = hasUpdated ? ", updated_at = ?" : "";
  const now = hasUpdated ? [new Date().toISOString()] : [];
  if (dot > 0) {
    // Una respuesta de un JSON: se vuelve a poner (o se quita, si aquí no estaba).
    const col = r.field.slice(0, dot);
    const path = `$."${r.field.slice(dot + 1)}"`;
    await db.transaction([
      value === undefined
        ? { sql: `update ${r.tbl} set ${col} = json_remove(${col}, ?)${stamp} where ${key} = ?`, bind: [path, ...now, r.pk] }
        : { sql: `update ${r.tbl} set ${col} = json_set(${col}, ?, json(?))${stamp} where ${key} = ?`, bind: [path, JSON.stringify(value), ...now, r.pk] },
      done,
    ]);
  } else {
    await db.transaction([{ sql: `update ${r.tbl} set ${r.field} = ?${stamp} where ${key} = ?`, bind: [(value ?? null) as string | number | null, ...now, r.pk] }, done]);
  }
  return true;
}

/** Se queda lo del otro: deja de estar en la lista. */
export async function dismissLost(db: Db, id: number): Promise<void> {
  await db.transaction([{ sql: "delete from sync_conflicts where id = ?", bind: [id] }]);
}
