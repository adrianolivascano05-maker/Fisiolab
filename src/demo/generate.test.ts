import { describe, expect, it } from "vitest";
import { findFlags } from "../clinical/redFlags";
import { loadCatalog, parseCoded } from "../clinical/cif/cif";
import { usableForm } from "../clinical/forms";
import { getKind } from "../clinical/questionnaires";
import { getAnamnesisOf } from "../data/clinical";
import { getCalendarSettings } from "../cloud/googleCalendar";
import { getPricing } from "../data/billing";
import { setMember } from "../data/member";
import type { Db } from "../data/db";
import { listPatients } from "../data/repo";
import { shiftsBetween, withinShift } from "../data/schedule";
import { createTestDb } from "../data/testDb";
import { tests as GALLERY } from "../gallery/data";
import { waPhone } from "../schedule/reminders";
import { CASES } from "./cases";
import { demoState, fillForm, generateDemo, removeDemo } from "./generate";

const NOW = new Date(2026, 9, 21, 10, 30);
const ME = { email: "yo@example.com", name: "Yo Mismo" };
const count = async (db: Db, sql: string, bind: (string | number)[] = []) => ((await db.query<{ n: number }>(sql, bind))[0]?.n ?? 0);

describe("clínica de prueba", () => {
  it("cada caso tiene sus tests en la galería, sus cuestionarios puntúan y sus códigos de la CIF existen", async () => {
    const catalog = new Set((await loadCatalog()).map((e) => e.code));
    for (const c of CASES) {
      expect(GALLERY.some((t) => t.region === c.regions[0] && c.tests.test(t.group)), `${c.id}: tests`).toBe(true);
      for (const code of c.cif) expect(catalog.has(parseCoded(code)!.code), `${c.id}: ${code}`).toBe(true);
      for (const kind of c.questionnaires) {
        const form = usableForm(kind, []);
        expect(form, `${c.id}: ${kind} se rellena en la app`).toBeTruthy();
        const k = getKind(kind)!;
        let seed = 1;
        const r = { next: () => ((seed = (seed * 16807) % 2147483647) / 2147483647), int: (a: number) => a, pick: <T,>(l: readonly T[]) => l[0]!, chance: () => false, some: <T,>(l: readonly T[]) => [...l] };
        const bad = fillForm(form!, k.better, 0.8, r);
        const good = fillForm(form!, k.better, 0.2, r);
        expect(bad, `${c.id}: ${kind} puntúa`).not.toBeNull();
        expect(bad!.score).toBeGreaterThanOrEqual(k.min);
        expect(bad!.score).toBeLessThanOrEqual(k.max);
        // Peor gravedad, peor nota.
        if (k.better === "lower") expect(bad!.score, `${c.id}: ${kind}`).toBeGreaterThan(good!.score);
        else expect(bad!.score, `${c.id}: ${kind}`).toBeLessThan(good!.score);
      }
    }
  });

  it("100 pacientes, 6 fisios con la agenda sin solapes y repartida, y se borra todo sin dejar rastro", async () => {
    const db = await createTestDb();
    const before = await getPricing(db);
    const s = await generateDemo(db, { mode: "normal", me: ME, clinicName: "Clínica de prueba", now: NOW, seed: 7 });
    console.log(`normal: ${JSON.stringify(s)}`);
    expect(s.patients).toBe(100);
    expect(s.staff).toBe(6);
    expect(await count(db, "select count(*) as n from patients")).toBe(100);
    expect(await count(db, "select count(*) as n from staff")).toBe(6);

    // Sin dos citas a la vez con el mismo fisio, y todas dentro de su turno.
    expect(await count(db, "select count(*) as n from (select assigned_to, starts_at from appointments group by 1, 2 having count(*) > 1)")).toBe(0);
    const appts = await db.query<{ starts_at: string; minutes: number; assigned_to: string }>("select starts_at, minutes, assigned_to from appointments");
    const shifts = await shiftsBetween(db, "2026-01-01T00:00:00Z", "2027-12-31T00:00:00Z");
    expect(appts.every((a) => withinShift(shifts, a.assigned_to, a.starts_at, a.minutes))).toBe(true);

    // El mes que viene, cada fisio con un número parecido de citas.
    const next = await db.query<{ who: string; n: number }>(
      "select assigned_to as who, count(*) as n from appointments where starts_at >= ? and starts_at < ? group by 1",
      [new Date(2026, 10, 1).toISOString(), new Date(2026, 11, 1).toISOString()],
    );
    console.log(`noviembre: ${next.map((x) => `${x.who.split("@")[0]} ${x.n}`).join(", ")}`);
    expect(next).toHaveLength(6);
    const ns = next.map((x) => x.n);
    expect(Math.min(...ns)).toBeGreaterThan(0);
    expect(Math.max(...ns) / Math.min(...ns)).toBeLessThan(2);

    // Pasado: atendidas (con su sesión), alguna sin venir o anulada; futuro, pendientes.
    expect(await count(db, "select count(*) as n from appointments where status = 'done' and starts_at > ?", [NOW.toISOString()])).toBe(0);
    expect(await count(db, "select count(*) as n from appointments where status = 'scheduled' and starts_at < ?", [NOW.toISOString()])).toBe(0);
    expect(await count(db, "select count(*) as n from appointments where status in ('no_show', 'cancelled')")).toBeGreaterThan(0);
    expect(await count(db, "select count(*) as n from appointments a where status = 'done' and not exists (select 1 from sessions s where s.patient_id = a.patient_id and s.performed_at = a.starts_at)")).toBe(0);

    // Teléfonos de ficción (+44 7700 900xxx), que WhatsApp entiende.
    const patients = await db.query<{ id: string; phone: string; birth_date: string }>("select id, phone, birth_date from patients");
    expect(patients.every((p) => /^\+44 7700 900\d{3}$/.test(p.phone) && waPhone(p.phone)?.startsWith("447700900"))).toBe(true);
    expect(new Set(patients.map((p) => p.phone)).size).toBe(100);

    // Los que han venido: anamnesis entera, exploración, cuestionarios, cobros; banderas rojas solo donde se ponen.
    const seen = await db.query<{ id: string }>("select distinct patient_id as id from sessions");
    expect(seen.length).toBeGreaterThan(50);
    let flagged = 0;
    for (const { id } of seen) {
      const a = (await getAnamnesisOf(db, id, id))!.answers;
      expect(a.motivo).toBeTruthy();
      const hits = findFlags(a);
      if (hits.length) {
        flagged++;
        expect(hits.map((h) => h.flag.id)).toEqual(["peso"]);
      }
    }
    expect(flagged).toBeLessThan(10);
    expect(await count(db, "select count(*) as n from findings")).toBeGreaterThan(150);
    expect(await count(db, "select count(*) as n from questionnaires")).toBeGreaterThan(200);
    expect(await count(db, "select count(*) as n from consents")).toBeGreaterThan(50);
    expect(await count(db, "select count(*) as n from payments")).toBeGreaterThan(100);
    expect(await count(db, "select count(*) as n from tests where category = 'rom'")).toBeGreaterThan(10);
    expect(await count(db, "select count(*) as n from episodes")).toBeGreaterThan(0);
    expect((await listPatients(db)).length).toBe(100);

    // No se carga dos veces, ni en una clínica con pacientes.
    await expect(generateDemo(db, { mode: "normal", now: NOW })).rejects.toThrow(/ya tiene los datos de prueba/);

    expect(await removeDemo(db)).toBe(100);
    for (const t of ["patients", "appointments", "sessions", "findings", "questionnaires", "tests", "consents", "payments", "packs", "waitlist", "episodes", "shifts", "closures"])
      expect(await count(db, `select count(*) as n from ${t}`), t).toBe(0);
    expect((await db.query<{ email: string }>("select email from staff")).map((x) => x.email)).toEqual([ME.email]);
    expect(await getPricing(db)).toEqual(before);
    expect((await demoState(db)).marker).toBeNull();
    expect(await count(db, "select count(*) as n from settings where key in ('billing_pricing', 'billing_pack_presets', 'clinic_privacy')")).toBe(0);
  }, 120_000);

  it("en una clínica, las citas inventadas no van al Google Calendar de quien las carga, y al borrar queda como estaba", async () => {
    const db = await createTestDb();
    setMember("u1", ME.email);
    try {
      await db.transaction([{ sql: "insert into settings (key, value) values ('calendar_auto@u1', ?)", bind: [JSON.stringify({ enabled: true, names: "full" })] }]);
      await generateDemo(db, { mode: "normal", me: ME, now: NOW, seed: 2 });
      expect(await getCalendarSettings(db)).toEqual({ enabled: false, names: "full" });
      expect(await count(db, "select count(*) as n from appointments where assigned_to = ?", [ME.email])).toBeGreaterThan(0);
      await removeDemo(db);
      expect(await getCalendarSettings(db)).toEqual({ enabled: true, names: "full" });
    } finally {
      setMember(null);
    }
  }, 60_000);

  it("en una clínica con pacientes no se carga", async () => {
    const db = await createTestDb();
    await db.transaction([{ sql: "insert into patients (id, name, created_at, updated_at) values ('x', 'Paciente real', '2026-01-01', '2026-01-01')" }]);
    await expect(generateDemo(db, { mode: "normal", now: NOW })).rejects.toThrow(/1 paciente/);
    expect(await count(db, "select count(*) as n from patients")).toBe(1);
  });

  it("modo estrés: 500 pacientes, la agenda llena y el resto en lista de espera", async () => {
    const db = await createTestDb();
    const s = await generateDemo(db, { mode: "stress", me: ME, now: NOW, seed: 3 });
    const bytes = (await db.exportBytes()).length;
    const nov = await count(db, "select count(*) as n from appointments where starts_at >= ? and starts_at < ?", [new Date(2026, 10, 1).toISOString(), new Date(2026, 11, 1).toISOString()]);
    console.log(`estrés: ${JSON.stringify(s)}, base ${(bytes / 1e6).toFixed(1)} MB, noviembre ${nov} citas de ${6 * 8 * 21} huecos`);
    expect(s.patients).toBe(500);
    expect(s.waitlist).toBeGreaterThan(20);
    expect(await count(db, "select count(*) as n from (select assigned_to, starts_at from appointments group by 1, 2 having count(*) > 1)")).toBe(0);
    expect(await removeDemo(db)).toBe(500);
    expect(await count(db, "select count(*) as n from appointments")).toBe(0);
  }, 300_000);
});
