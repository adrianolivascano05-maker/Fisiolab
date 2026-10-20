// «Editado por» (editors.ts): quién hizo el último cambio, también si llega de otro dispositivo.
import { describe, expect, it } from "vitest";
import { createAppointment } from "./appointments";
import { describeOverwritten, editText, ensureDevice, lastEditOf, lastEditOfPatient, PATIENT_TABLES } from "./editors";
import { createPatient, getPatient, updatePatient } from "./repo";
import { ensureStaff } from "./schedule";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });

describe("editado por", () => {
  it("las tablas de un paciente tienen patient_id", async () => {
    const db = await createTestDb();
    for (const t of PATIENT_TABLES) expect((await db.query(`select 1 from pragma_table_info('${t}') where name = 'patient_id'`)).length, t).toBe(1);
  });

  it("dice quién, también lo que llega de otro dispositivo; guardar lo mismo no lo cambia", async () => {
    const ana = await createTestDb();
    const eva = await createTestDb();
    await ensureDevice(ana, "ana@clinica.es", "Ana");
    await ensureDevice(eva, "Eva@clinica.es", "Eva");
    const pid = await createPatient(ana, patient("Paciente"));
    expect(await lastEditOfPatient(ana, pid)).toMatchObject({ email: "ana@clinica.es", name: "Ana", mine: true });
    await eva.merge((await ana.snapshot()).bytes);
    await new Promise((r) => setTimeout(r, 5));
    const appt = await createAppointment(eva, pid, { startsAt: "2026-10-21T09:00:00.000Z", minutes: 45 });
    await ana.merge((await eva.snapshot()).bytes);
    await ensureStaff(ana, "eva@clinica.es", "Eva Gil");
    const last = (await lastEditOfPatient(ana, pid))!;
    expect(last).toMatchObject({ email: "eva@clinica.es", name: "Eva Gil", mine: false });
    expect((await lastEditOf(ana, "appointments", appt))!.name).toBe("Eva Gil");
    expect(editText(last, Date.parse(last.at) + 5 * 60_000)).toBe("Eva Gil, hace 5 min");
    // Ana guarda la ficha sin cambiar nada: sigue siendo de Eva.
    await ana.transaction([{ sql: "update patients set name = name, updated_at = '2099-01-01' where id = ?", bind: [pid] }]);
    expect((await lastEditOfPatient(ana, pid))!.email).toBe("eva@clinica.es");
    expect(editText({ ...last, mine: true }, Date.parse(last.at))).toBe("tú, hace un momento");
  });

  it("si otro cambia después algo que acabo de guardar, se queda lo suyo y se avisa", async () => {
    const ana = await createTestDb();
    const eva = await createTestDb();
    await ensureDevice(ana, "ana@clinica.es", "Ana");
    await ensureDevice(eva, "eva@clinica.es", "Eva");
    const pid = await createPatient(ana, patient("Lucía"));
    await eva.merge((await ana.snapshot()).bytes);
    await ana.merge((await eva.snapshot()).bytes);
    const p = (await getPatient(ana, pid))!;
    await updatePatient(ana, pid, { ...p, notes: "de Ana" });
    await new Promise((r) => setTimeout(r, 5));
    await updatePatient(eva, pid, { ...p, notes: "de Eva" });
    const r = await ana.merge((await eva.snapshot()).bytes);
    expect(r.overwritten).toEqual([{ tbl: "patients", pk: pid, device: expect.any(String) }]);
    expect(await describeOverwritten(ana, r.overwritten!)).toEqual(["los datos de Lucía (lo cambió Eva)"]);
    expect((await getPatient(ana, pid))!.notes).toBe("de Eva");
    // Lo que llega sin que aquí se tocara nada, no avisa.
    await updatePatient(eva, pid, { ...p, notes: "otra vez Eva" });
    expect((await ana.merge((await eva.snapshot()).bytes)).overwritten).toEqual([]);
  });
});
