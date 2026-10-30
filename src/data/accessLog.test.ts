// Registro de accesos (migración 035, accessLog.ts): una fila por persona, paciente, acción y día; solo se añade.
import { beforeEach, describe, expect, it } from "vitest";
import { accessCount, accessCsv, accessMembers, listAccess, logAccess, pruneAccessLog } from "./accessLog";
import type { Db } from "./db";
import { migrations } from "./migrations";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const SCHEMA = migrations.at(-1)!.version;
/** Sube lo que falta (como sync.ts al terminar de subir el lote) y devuelve el lote. */
async function push(db: Db) {
  const p = await db.pending();
  await db.transaction([{ sql: "update sync_state set pushed = max(pushed, ?)", bind: [p.changes] }]);
  return p.items;
}
const ANA = "ana@clinica.test";
const BRUNO = "bruno@clinica.test";

describe("registro de accesos", () => {
  let a: Db;
  let b: Db;
  beforeEach(async () => {
    a = await createTestDb();
    b = await createTestDb();
  });

  it("abrir una ficha deja una fila; otra vez el mismo día, no; otro día, otra acción u otra persona, sí", async () => {
    const pid = await createPatient(a, patient("Ana Paciente"));
    await logAccess(a, "abrir_ficha", pid, new Date("2026-10-30T10:00:00Z"), ANA);
    await logAccess(a, "abrir_ficha", pid, new Date("2026-10-30T12:00:00Z"), ANA);
    expect(await listAccess(a)).toHaveLength(1);
    await logAccess(a, "exportar", pid, new Date("2026-10-30T11:00:00Z"), BRUNO);
    await logAccess(a, "abrir_ficha", pid, new Date("2026-10-31T09:00:00Z"), ANA);
    const rows = await listAccess(a);
    expect(rows.map((r) => [r.member, r.action, r.patientName])).toEqual([
      [ANA, "abrir_ficha", "Ana Paciente"],
      [BRUNO, "exportar", "Ana Paciente"],
      [ANA, "abrir_ficha", "Ana Paciente"],
    ]);
    expect(await accessMembers(a)).toEqual([ANA, BRUNO]);
    expect(await listAccess(a, { member: BRUNO })).toHaveLength(1);
    expect(await listAccess(a, { patientName: "paci" })).toHaveLength(3);
    expect(await listAccess(a, { patientName: "nadie" })).toHaveLength(0);
    expect(await listAccess(a, { patientId: pid, member: ANA })).toHaveLength(2);
    expect(accessCsv(rows)).toContain('"Exportó sus datos"');
    expect(accessCsv(rows).replace(/^\uFEFF/, "").split("\r\n")[0]).toBe('"Fecha y hora";"Persona";"Paciente";"Acción"');
  });

  it("solo se añade: una fila reciente no se puede borrar, y un borrado que llegue de otro dispositivo no se aplica", async () => {
    const pid = await createPatient(a, patient("Ana Paciente"));
    await logAccess(a, "abrir_ficha", pid, new Date(), ANA);
    const [row] = await listAccess(a);
    await expect(a.transaction([{ sql: "delete from access_log where id = ?", bind: [row!.id] }])).rejects.toThrow(/solo se añade/);
    expect(await accessCount(a)).toBe(1);
    // Llega al otro dispositivo; aunque alguien fabrique un borrado posterior, se queda.
    await b.apply(await push(a), SCHEMA);
    expect(await listAccess(b)).toHaveLength(1);
    await b.apply([{ tbl: "access_log", pk: row!.id, op: "delete", at: new Date(Date.now() + 1000).toISOString(), device: "otro" }], SCHEMA);
    expect(await listAccess(b)).toHaveLength(1);
    // Borrar al paciente no borra su rastro: queda con su id.
    await deletePatient(a, pid);
    expect((await listAccess(a))[0]).toMatchObject({ patientId: pid, patientName: null });
    expect(accessCsv(await listAccess(a))).toContain(`(paciente borrado: ${pid})`);
  });

  it("lo de más de 2 años se poda en el dispositivo sin que viaje como borrado; borrar toda la base sí lo borra", async () => {
    const pid = await createPatient(a, patient("Ana Paciente"));
    await logAccess(a, "abrir_ficha", pid, new Date("2023-01-10T10:00:00Z"), ANA);
    await logAccess(a, "abrir_ficha", pid, new Date("2026-10-30T10:00:00Z"), ANA);
    await push(a);
    expect(await pruneAccessLog(a, new Date("2026-10-30T12:00:00Z"))).toBe(1);
    expect(await pruneAccessLog(a, new Date("2026-10-30T12:00:00Z"))).toBe(0);
    expect(await listAccess(a)).toHaveLength(1);
    expect((await a.pending()).items).toEqual([]);
    await a.wipe();
    expect(await accessCount(a)).toBe(0);
  });
});
