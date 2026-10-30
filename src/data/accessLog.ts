// Registro de accesos (migración 035): quién abrió qué ficha, la exportó o imprimió su historia. Una fila por
// persona, paciente, acción y día; solo se añade (ni se edita ni se borra, salvo la poda de lo de más de 2 años); se
// sincroniza cifrado como lo demás, así que lo ve quien administra desde cualquier dispositivo (Ajustes → Equipo →
// Registro de accesos). Es un registro de buena fe: quien sepa tocar su navegador podría alterar su base antes de
// sincronizar; no está pensado a prueba de manipulación.
import type { Db } from "./db";
import { memberEmail } from "./member";

export type AccessAction = "abrir_ficha" | "exportar" | "imprimir_historia";
export const ACTION_LABELS: Record<AccessAction, string> = { abrir_ficha: "Abrió la ficha", exportar: "Exportó sus datos", imprimir_historia: "Imprimió la historia" };
/** Lo de más de 2 años se poda (plazo por defecto, a confirmar con el delegado de protección de datos). */
export const KEEP_ACCESS_YEARS = 2;
/** Sin clínica (o sin correo): el registro dice que fue este dispositivo. */
export const DEVICE_MEMBER = "este dispositivo";

export type AccessRow = { id: string; at: string; member: string; patientId: string; patientName: string | null; action: AccessAction };

const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** Apunta un acceso (o varios pacientes de una vez, p. ej. al exportar todo). El mismo día no se repite. */
export async function logAccess(db: Db, action: AccessAction, patientIds: string | string[], at = new Date(), who = memberEmail() ?? DEVICE_MEMBER): Promise<void> {
  const ids = (Array.isArray(patientIds) ? patientIds : [patientIds]).filter(Boolean);
  if (!ids.length) return;
  const iso = at.toISOString();
  const d = day(at);
  await db.transaction(ids.map((pid) => ({ sql: "insert or ignore into access_log (id, at, member, patient_id, action) values (?, ?, ?, ?, ?)", bind: [`${d}|${who}|${pid}|${action}`, iso, who, pid, action] })));
}

type Row = { id: string; at: string; member: string; patient_id: string; patient_name: string | null; action: AccessAction };
const fromRow = (r: Row): AccessRow => ({ id: r.id, at: r.at, member: r.member, patientId: r.patient_id, patientName: r.patient_name, action: r.action });

/** Los accesos, los más recientes primero; por paciente (su id o parte de su nombre) o por persona. */
export async function listAccess(db: Db, filter: { patientId?: string; patientName?: string; member?: string; limit?: number } = {}): Promise<AccessRow[]> {
  const where: string[] = [];
  const bind: (string | number)[] = [];
  if (filter.patientId) {
    where.push("a.patient_id = ?");
    bind.push(filter.patientId);
  }
  if (filter.patientName?.trim()) {
    where.push("p.name like ? collate nocase");
    bind.push(`%${filter.patientName.trim()}%`);
  }
  if (filter.member) {
    where.push("a.member = ?");
    bind.push(filter.member);
  }
  bind.push(filter.limit ?? 500);
  const rows = await db.query<Row>(
    `select a.id, a.at, a.member, a.patient_id, p.name as patient_name, a.action from access_log a left join patients p on p.id = a.patient_id
     ${where.length ? `where ${where.join(" and ")}` : ""} order by a.at desc limit ?`,
    bind,
  );
  return rows.map(fromRow);
}

/** Quiénes figuran en el registro. */
export async function accessMembers(db: Db): Promise<string[]> {
  return (await db.query<{ member: string }>("select distinct member from access_log order by member")).map((r) => r.member);
}

/** Cuántas filas hay. */
export async function accessCount(db: Db): Promise<number> {
  return (await db.query<{ n: number }>("select count(*) as n from access_log"))[0]!.n;
}

/**
 * Poda lo de más de 2 años, sin que viaje como borrado (se quita también su rastro del registro de cambios: cada
 * dispositivo poda lo suyo). Devuelve cuántas filas se han quitado.
 */
export async function pruneAccessLog(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - KEEP_ACCESS_YEARS);
  const iso = cutoff.toISOString();
  const before = (await db.query<{ n: number }>("select count(*) as n from access_log where at < ?", [iso]))[0]!.n;
  if (!before) return 0;
  await db.transaction([
    { sql: "delete from sync_changes where tbl = 'access_log' and pk in (select id from access_log where at < ?)", bind: [iso] },
    { sql: "delete from sync_fields where tbl = 'access_log' and pk in (select id from access_log where at < ?)", bind: [iso] },
    { sql: "delete from access_log where at < ?", bind: [iso] },
  ]);
  return before;
}

/** El registro en CSV para Excel (separado por «;», como las demás exportaciones). */
export function accessCsv(rows: AccessRow[]): string {
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [["Fecha y hora", "Persona", "Paciente", "Acción"].map(cell).join(";")];
  for (const r of rows) lines.push([r.at, r.member, r.patientName ?? `(paciente borrado: ${r.patientId})`, ACTION_LABELS[r.action] ?? r.action].map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
