import { beforeEach, describe, expect, it } from "vitest";
import { createAppointment } from "./appointments";
import { addPayment, setSessionPrice } from "./billing";
import { getAnamnesis, saveAnamnesis, saveSession } from "./clinical";
import { listConsents } from "./consents";
import type { Db } from "./db";
import { findPatients, hasOwnPatients, NO_FILTERS, unsignedPatients, type PatientFilters } from "./patientSearch";
import { appointmentsByPhysio, patientPhysios, setPatientPhysios } from "./patientStaff";
import { savePatientPrivacy } from "./privacy";
import { createPatient, getPatient, listPatients, matchesPatient, QUICK_PATIENT, type PatientInput } from "./repo";
import { SEED_PREFIX } from "./seed";
import { createTestDb } from "./testDb";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";

const person = (name: string, over: Partial<PatientInput> = {}): PatientInput => ({
  name,
  birthDate: null,
  sex: null,
  bodyMassKg: null,
  heightCm: null,
  legLengthCm: null,
  pushOffDistanceCm: null,
  notes: "",
  ...over,
});
const session = (performedAt: string) => ({ performedAt, pain: null, subjective: "", objective: "", treatment: "Terapia manual", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
const NOW = new Date("2026-10-27T10:00:00.000Z");
const names = async (q: Parameters<typeof findPatients>[1]) => (await findPatients(db, { now: NOW, ...q })).rows.map((r) => r.name);
const only = (f: Partial<PatientFilters>) => ({ ...NO_FILTERS, ...f });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("buscar pacientes en la base", () => {
  it("encuentra lo mismo que la búsqueda de antes: nombre sin tildes, teléfono con o sin espacios, DNI, motivo y notas", async () => {
    const lucia = await createPatient(db, person("Lucía Pérez", { phone: "600 12 34 56", dni: "12345678z" }));
    await createPatient(db, person("Mario Ruiz", { email: "mario@correo.test", notes: "Corredor de montaña" }));
    await createPatient(db, person("Ángela Gil", { phone: "+34 611-22-33-44" }));
    await saveAnamnesis(db, lucia, { motivo: "Dolor de rodilla derecha", diagnostico_funcional: "Tendinopatía rotuliana" });
    const all = await listPatients(db);
    for (const q of ["lucia", "LUCÍA", "pérez", "600123456", "600 12", "12345678Z", "rodilla", "rotuliana", "montaña", "MARIO@", "611223344", "angela", "+34 611", "ruiz", "nadie", "6001"]) {
      const before = all.filter((p) => matchesPatient(p, q)).map((p) => p.name);
      expect(await names({ search: q }), q).toEqual(before);
    }
  });

  it("de la A a la Z sin tildes, por páginas y por letras; cuenta el total", async () => {
    for (const n of ["Zoe Mar", "álvaro Sanz", "Ana Gil", "Bruno Paz", "Óscar Rey", "Ñoño Vidal", "123 Sin nombre"]) await createPatient(db, person(n));
    expect(await names({})).toEqual(["123 Sin nombre", "álvaro Sanz", "Ana Gil", "Bruno Paz", "Ñoño Vidal", "Óscar Rey", "Zoe Mar"]);
    const first = await findPatients(db, { limit: 3, now: NOW });
    expect(first.rows.map((r) => r.name)).toEqual(["123 Sin nombre", "álvaro Sanz", "Ana Gil"]);
    expect(first.total).toBe(7);
    expect(await names({ limit: 3, offset: 3 })).toEqual(["Bruno Paz", "Ñoño Vidal", "Óscar Rey"]);
    expect(await names({ letter: "A" })).toEqual(["álvaro Sanz", "Ana Gil"]);
    expect(await names({ letter: "N" })).toEqual(["Ñoño Vidal"]);
    expect(await names({ letter: "#" })).toEqual(["123 Sin nombre"]);
    expect((await findPatients(db, { letter: "a", search: "gil", now: NOW })).total).toBe(1);
  });

  it("cada fila trae su próxima cita y la última vez que vino", async () => {
    const ana = await createPatient(db, person("Ana Gil"));
    await saveSession(db, ana, session("2026-10-20T09:00:00.000Z"));
    await createAppointment(db, ana, { startsAt: "2026-11-02T09:00:00.000Z", minutes: 45 });
    const [row] = (await findPatients(db, { now: NOW })).rows;
    expect(row).toMatchObject({ name: "Ana Gil", lastAt: "2026-10-20T09:00:00.000Z", nextAt: "2026-11-02T09:00:00.000Z", phone: "" });
  });

  it("filtros: edad, sexo, fisio, cita próxima y cuándo vino por última vez", async () => {
    const ana = await createPatient(db, person("Ana Gil", { birthDate: "1990-10-28", sex: "female" })); // 35 (cumple mañana)
    const bea = await createPatient(db, person("Bea Paz", { birthDate: "1956-01-15", sex: "female" })); // 70
    const ciro = await createPatient(db, person("Ciro Sanz", { birthDate: "2014-05-01", sex: "male" })); // 12
    await createPatient(db, person("Dani Sin Datos"));
    expect(await names({ filters: only({ ageFrom: 36 }) })).toEqual(["Bea Paz"]);
    expect(await names({ filters: only({ ageFrom: 35, ageTo: 35 }) })).toEqual(["Ana Gil"]);
    expect(await names({ filters: only({ ageTo: 17 }) })).toEqual(["Ciro Sanz"]);
    expect(await names({ filters: only({ sex: "female" }) })).toEqual(["Ana Gil", "Bea Paz"]);
    expect(await names({ filters: only({ sex: "male", ageTo: 17 }) })).toEqual(["Ciro Sanz"]);

    await createAppointment(db, ana, { startsAt: "2026-11-03T09:00:00.000Z", minutes: 45, assignedTo: "bruno@clinica.test" });
    await createAppointment(db, bea, { startsAt: "2026-09-03T09:00:00.000Z", minutes: 45, assignedTo: "bruno@clinica.test" });
    await createAppointment(db, ciro, { startsAt: "2026-11-05T09:00:00.000Z", minutes: 45, assignedTo: "carla@clinica.test" });
    expect(await names({ filters: only({ physio: "bruno@clinica.test" }) })).toEqual(["Ana Gil", "Bea Paz"]);
    expect(await names({ filters: only({ upcoming: true }) })).toEqual(["Ana Gil", "Ciro Sanz"]);
    expect(await names({ filters: only({ upcoming: true, physio: "bruno@clinica.test" }) })).toEqual(["Ana Gil"]);

    await saveSession(db, ana, session("2026-10-25T09:00:00.000Z")); // hace 2 días
    await saveSession(db, bea, session("2026-06-01T09:00:00.000Z")); // hace casi 5 meses
    await saveSession(db, ciro, session("2025-06-01T09:00:00.000Z")); // hace más de un año
    expect(await names({ filters: only({ lastVisit: "7" }) })).toEqual(["Ana Gil"]);
    expect(await names({ filters: only({ lastVisit: "mas90" }) })).toEqual(["Bea Paz", "Ciro Sanz"]);
    expect(await names({ filters: only({ lastVisit: "mas365" }) })).toEqual(["Ciro Sanz"]);
    expect(await names({ filters: only({ lastVisit: "nunca" }) })).toEqual(["Dani Sin Datos"]);
    expect(await names({ search: "a", filters: only({ lastVisit: "mas180" }) })).toEqual(["Ciro Sanz"]);
  });

  it("fisio: los que tiene asignados; si no tiene ninguno, los que tienen alguna cita suya", async () => {
    const ana = await createPatient(db, person("Ana Gil"));
    const bea = await createPatient(db, person("Bea Paz"));
    const ciro = await createPatient(db, person("Ciro Sanz"));
    await createPatient(db, person("Dani Nadie"));
    const BRUNO = "bruno@clinica.test";
    const CARLA = "carla@clinica.test";
    // Sin asignar: por sus citas (las anuladas no cuentan).
    await createAppointment(db, ana, { startsAt: "2026-11-03T09:00:00.000Z", minutes: 45, assignedTo: BRUNO });
    await createAppointment(db, bea, { startsAt: "2026-11-04T09:00:00.000Z", minutes: 45, assignedTo: BRUNO });
    const cancelled = await createAppointment(db, ciro, { startsAt: "2026-11-05T09:00:00.000Z", minutes: 45, assignedTo: BRUNO });
    await db.transaction([{ sql: "update appointments set status = 'cancelled' where id = ?", bind: [cancelled] }]);
    expect(await names({ filters: only({ physio: BRUNO }) })).toEqual(["Ana Gil", "Bea Paz"]);
    expect(await appointmentsByPhysio(db, ana)).toEqual(new Map([[BRUNO, 1]]));
    // Bea pasa a llevarla Carla (aunque tenga una cita con Bruno); Ciro, Bruno y Carla a la vez.
    await setPatientPhysios(db, bea, [CARLA]);
    await setPatientPhysios(db, ciro, [" Bruno@Clinica.test ", CARLA, CARLA]);
    expect(await patientPhysios(db, ciro)).toEqual([BRUNO, CARLA]);
    expect(await names({ filters: only({ physio: BRUNO }) })).toEqual(["Ana Gil", "Ciro Sanz"]);
    expect(await names({ filters: only({ physio: CARLA }) })).toEqual(["Bea Paz", "Ciro Sanz"]);
    // Quitar uno deja el otro; quitarlos todos vuelve a mirar sus citas.
    await setPatientPhysios(db, ciro, [CARLA]);
    expect(await patientPhysios(db, ciro)).toEqual([CARLA]);
    await setPatientPhysios(db, bea, []);
    expect(await names({ filters: only({ physio: BRUNO }) })).toEqual(["Ana Gil", "Bea Paz"]);
    // Al borrar el paciente, se van sus asignaciones.
    await db.transaction([{ sql: "delete from patients where id = ?", bind: [ciro] }]);
    expect(await db.query("select * from patient_staff")).toEqual([]);
  });

  it("pendiente de cobrar o de firmar: los mismos que avisan su ficha y Agenda › Hoy", async () => {
    await setSessionPrice(db, 4000, "2026-10-01");
    const debe = await createPatient(db, person("Debe Dinero"));
    await saveSession(db, debe, session("2026-10-20T09:00:00.000Z"));
    const pagado = await createPatient(db, person("Pagó Todo"));
    await saveSession(db, pagado, session("2026-10-20T09:00:00.000Z"));
    await addPayment(db, pagado, { amountCents: 4000, method: "bizum", paidOn: "2026-10-20", concept: "" });
    for (const id of [debe, pagado]) await savePatientPrivacy(db, id, { informedAt: "2026-10-01T09:00:00.000Z" });
    // Sin la hoja de protección de datos.
    await createPatient(db, person("Sin Hoja"));
    // Con la hoja, pero con manipulación en el plan y sin su consentimiento firmado; otro, con él firmado.
    const manip = await createPatient(db, person("Manip Sin Firma"));
    const firmado = await createPatient(db, person("Manip Firmado"));
    for (const id of [manip, firmado]) {
      await savePatientPrivacy(db, id, { informedAt: "2026-10-01T09:00:00.000Z" });
      await saveAnamnesis(db, id, { motivo: "Lumbalgia", plan: "Manipulación lumbar y ejercicio" });
    }
    const t = "2026-10-02T09:00:00.000Z";
    await db.transaction([
      {
        sql: `insert into consents (id, patient_id, episode_id, template, version, title, document, method, signed_at, created_at, updated_at)
              values ('c1', ?, null, 'manipulacion', '1', 'Manipulación', '{}', 'paper', ?, ?, ?)`,
        bind: [firmado, t, t, t],
      },
    ]);

    expect(await names({ filters: only({ pending: "cobrar" }) })).toEqual(["Debe Dinero"]);
    expect(await names({ filters: only({ pending: "firmar" }) })).toEqual(["Manip Sin Firma", "Sin Hoja"]);
    expect(await names({ filters: only({ pending: "algo" }) })).toEqual(["Debe Dinero", "Manip Sin Firma", "Sin Hoja"]);

    // Lo mismo que calcula Agenda › Hoy paciente a paciente.
    const each = async (id: string) => {
      const [p, a, signed] = await Promise.all([getPatient(db, id), getAnamnesis(db, id), listConsents(db, id)]);
      const ctx = consentContext(p!, a?.answers ?? {});
      const missing = TEMPLATES.filter((x) => x.written === "required" && x.suggest(ctx) && !signed.some((c) => !c.revokedAt && c.template === x.id));
      return !p!.privacy.informedAt || missing.length > 0;
    };
    const all = await listPatients(db);
    const unsigned = await unsignedPatients(db);
    for (const p of all) expect(unsigned.has(p.id), p.name).toBe(await each(p.id));
    // Revocado: vuelve a faltar.
    await db.transaction([{ sql: "update consents set revoked_at = ? where id = 'c1'", bind: [t] }]);
    expect((await unsignedPatients(db)).has(firmado)).toBe(true);
  });

  it("si hay pacientes de verdad (sin los de la demo ni el de medición rápida)", async () => {
    await createPatient(db, person(`${SEED_PREFIX}Ana`));
    await createPatient(db, person(QUICK_PATIENT));
    expect(await hasOwnPatients(db, SEED_PREFIX, QUICK_PATIENT)).toBe(false);
    await createPatient(db, person("Lucía Pérez"));
    expect(await hasOwnPatients(db, SEED_PREFIX, QUICK_PATIENT)).toBe(true);
  });
});
