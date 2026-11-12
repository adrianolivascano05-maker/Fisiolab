// El calendario de cada paciente (migración 039, src/data/patientEvents.ts): guardar, repetir, varios días, avisar al dar
// una cita y lo que se cuenta en su ficha.
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  afterSurgeryText,
  agoText,
  checkEvent,
  endedBefore,
  eventsOfPatients,
  sinceSurgery,
  withDay,
  withoutDay,
  deletePatientEvent,
  eventNotes,
  eventSpan,
  eventsAtVisit,
  eventTime,
  listPatientEvents,
  occurrencesIn,
  savePatientEvent,
  type EventInput,
  type PatientEvent,
} from "./patientEvents";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";

const patient = { name: "Ana", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" };
const input = (over: Partial<EventInput> = {}): EventInput => ({ kind: "surgery", title: "", startsOn: "2026-11-10", endsOn: null, time: null, minutes: null, repeatDays: [], repeatUntil: null, notes: "", ...over });
const ev = (over: Partial<PatientEvent> = {}): PatientEvent => ({ id: "e1", patientId: "p", createdAt: "2026-01-01", updatedAt: "2026-01-01", skipDays: [], ...input(), ...over }) as PatientEvent;
const days = (o: { day: string }[]) => o.map((x) => x.day);

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, patient);
});

describe("comprobar", () => {
  it("pide el tipo y un día de verdad; limpia lo que sobra", () => {
    expect(() => checkEvent(input({ kind: "nada" as never }))).toThrow("Elige qué es.");
    expect(() => checkEvent(input({ startsOn: "" }))).toThrow("Pon el día.");
    expect(() => checkEvent(input({ startsOn: "2026-02-30" }))).toThrow("Pon el día.");
    expect(checkEvent(input({ title: "  Cruzado  ", notes: " x " }))).toMatchObject({ title: "Cruzado", notes: "x" });
    // El mismo día como último día: es de un día.
    expect(checkEvent(input({ endsOn: "2026-11-10" })).endsOn).toBeNull();
    // Sin hora no hay duración; con hora, una hora si no se dice.
    expect(checkEvent(input({ minutes: 30 })).minutes).toBeNull();
    expect(checkEvent(input({ time: "18:30" })).minutes).toBe(60);
    // Sin repetición, la fecha de fin de la repetición no se guarda.
    expect(checkEvent(input({ repeatUntil: "2026-12-01" })).repeatUntil).toBeNull();
    expect(checkEvent(input({ kind: "training", repeatDays: [4, 2, 2, 9] })).repeatDays).toEqual([2, 4]);
  });

  it("varios días: no al revés, como mucho un año y no a la vez que se repite", () => {
    expect(() => checkEvent(input({ endsOn: "2026-11-01" }))).toThrow("antes del primero");
    expect(() => checkEvent(input({ endsOn: "2027-12-01" }))).toThrow("un año");
    expect(() => checkEvent(input({ endsOn: "2026-11-12", repeatDays: [1] }))).toThrow("se repite");
    expect(() => checkEvent(input({ repeatDays: [1], repeatUntil: "2026-11-01" }))).toThrow("antes de empezar");
    expect(() => checkEvent(input({ time: "25:00" }))).toThrow("la hora");
  });
});

describe("guardar, leer y borrar", () => {
  it("se guarda, se cambia y se borra; con el paciente se va todo", async () => {
    const id = await savePatientEvent(db, pid, input({ title: "Cruzado anterior", notes: "Plastia de isquiotibiales" }));
    await savePatientEvent(db, pid, input({ kind: "training", startsOn: "2026-11-02", time: "19:00", minutes: 90, repeatDays: [2, 4] }));
    let list = await listPatientEvents(db, pid);
    expect(list.map((e) => e.kind)).toEqual(["training", "surgery"]);
    expect(list[0]).toMatchObject({ time: "19:00", minutes: 90, repeatDays: [2, 4], repeatUntil: null });
    await savePatientEvent(db, pid, input({ title: "Cruzado anterior derecho", startsOn: "2026-11-11" }), id);
    list = await listPatientEvents(db, pid);
    expect(list.find((e) => e.id === id)).toMatchObject({ title: "Cruzado anterior derecho", startsOn: "2026-11-11", notes: "" });
    await deletePatientEvent(db, id);
    expect(await listPatientEvents(db, pid)).toHaveLength(1);
    await expect(savePatientEvent(db, pid, input(), id)).rejects.toThrow("ya no existe");
    await deletePatient(db, pid);
    expect(await db.query("select * from patient_events")).toHaveLength(0);
  });

  it("se sincroniza: cada alta, cambio y borrado queda en el registro de cambios", async () => {
    const id = await savePatientEvent(db, pid, input());
    expect(await db.query("select op from sync_changes where tbl = 'patient_events' and pk = ?", [id])).toEqual([{ op: "upsert" }]);
    await savePatientEvent(db, pid, input({ title: "Menisco" }), id);
    expect(await db.query("select field from sync_fields where tbl = 'patient_events' and pk = ?", [id])).toEqual([{ field: "title" }]);
    await deletePatientEvent(db, id);
    expect(await db.query("select op from sync_changes where tbl = 'patient_events' and pk = ?", [id])).toEqual([{ op: "delete" }]);
  });

  it("un tipo que esta versión no conoce (de una más nueva) se lee como «Otro»", async () => {
    const id = await savePatientEvent(db, pid, input());
    await db.transaction([{ sql: "update patient_events set kind = 'yoga' where id = ?", bind: [id] }]);
    expect((await listPatientEvents(db, pid))[0]!.kind).toBe("other");
  });
});

describe("los días de cada evento", () => {
  it("un día, varios días (recortado a lo que se ve) y cada semana unos días, con o sin fin", () => {
    expect(days(occurrencesIn([ev()], "2026-11-01", "2026-11-30"))).toEqual(["2026-11-10"]);
    expect(occurrencesIn([ev()], "2026-12-01", "2026-12-31")).toEqual([]);
    const trip = ev({ kind: "travel", startsOn: "2026-10-30", endsOn: "2026-11-03" });
    const o = occurrencesIn([trip], "2026-11-01", "2026-11-30");
    expect(days(o)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(o.map((x) => [x.first, x.last])).toEqual([[false, false], [false, false], [false, true]]);
    // Martes y jueves desde el miércoles 4 de noviembre hasta el martes 17.
    const training = ev({ kind: "training", startsOn: "2026-11-04", repeatDays: [2, 4], repeatUntil: "2026-11-17" });
    expect(days(occurrencesIn([training], "2026-11-01", "2026-11-30"))).toEqual(["2026-11-05", "2026-11-10", "2026-11-12", "2026-11-17"]);
    // Sin fin: hasta donde se mire (y el cambio de hora no lo mueve).
    const open = ev({ kind: "training", startsOn: "2026-03-01", repeatDays: [7] });
    expect(days(occurrencesIn([open], "2026-03-20", "2026-04-05"))).toEqual(["2026-03-22", "2026-03-29", "2026-04-05"]);
    // Ordenados por día y hora.
    const late = ev({ id: "e2", kind: "competition", startsOn: "2026-11-05", time: "20:00", minutes: 90 });
    const early = ev({ id: "e3", kind: "medical", startsOn: "2026-11-05", time: "09:00", minutes: 30 });
    expect(occurrencesIn([late, early, training], "2026-11-05", "2026-11-05").map((x) => x.event.id)).toEqual(["e1", "e3", "e2"]);
  });
});

describe("al dar una cita", () => {
  // 10:00 en Madrid (horario de invierno): 09:00 UTC.
  const at10 = "2026-11-12T09:00:00.000Z";
  it("avisa de lo de todo el día y de lo que se pisa; los entrenamientos sin hora no", () => {
    expect(eventsAtVisit([ev({ startsOn: "2026-11-12" })], at10, 45)).toHaveLength(1);
    expect(eventsAtVisit([ev({ kind: "travel", startsOn: "2026-11-10", endsOn: "2026-11-15" })], at10, 45)).toHaveLength(1);
    expect(eventsAtVisit([ev({ startsOn: "2026-11-13" })], at10, 45)).toHaveLength(0);
    expect(eventsAtVisit([ev({ kind: "training", startsOn: "2026-11-12" })], at10, 45)).toHaveLength(0);
    const training = ev({ kind: "training", startsOn: "2026-11-01", time: "10:30", minutes: 90, repeatDays: [4] });
    expect(eventsAtVisit([training], at10, 45)).toHaveLength(1);
    expect(eventsAtVisit([training], at10, 30)).toHaveLength(0);
    // A las 11:00 se pisa con el entrenamiento (10:30 a 12:00); a las 12:00 empieza justo al acabar y a las 13:00, no.
    expect(eventsAtVisit([training], "2026-11-12T10:00:00.000Z", 45)).toHaveLength(1);
    expect(eventsAtVisit([training], "2026-11-12T11:00:00.000Z", 45)).toHaveLength(0);
    expect(eventsAtVisit([training], "2026-11-12T12:00:00.000Z", 45)).toHaveLength(0);
  });
});

describe("en palabras y en su ficha", () => {
  it("cuándo es, a qué hora y cuánto hace", () => {
    expect(eventTime({ time: null, minutes: null })).toBe("Todo el día");
    expect(eventTime({ time: "18:30", minutes: 90 })).toBe("18:30 · 90 min");
    expect(eventSpan(ev({ kind: "training", startsOn: "2026-11-04", repeatDays: [2, 4] }))).toBe("Cada martes y jueves desde el 4 nov 2026, sin fecha de fin");
    expect(eventSpan(ev({ startsOn: "2026-08-01", endsOn: "2026-08-15" }))).toBe("Del 1 ago 2026 al 15 ago 2026");
    expect([0, 1, 9, 14, 44].map(agoText)).toEqual(["hoy", "ayer", "hace 9 días", "hace 2 semanas", "hace 6 semanas y 2 días"]);
  });

  it("la última operación (menos de un año), un viaje en curso y lo próximo importante de dos meses, como mucho dos", () => {
    const today = "2026-11-12";
    const events = [
      ev({ id: "old", startsOn: "2025-01-10", title: "Menisco" }),
      ev({ id: "op", startsOn: "2026-10-01", title: "Cruzado anterior" }),
      ev({ id: "trip", kind: "travel", startsOn: "2026-11-10", endsOn: "2026-11-14" }),
      ev({ id: "train", kind: "training", startsOn: "2026-11-01", repeatDays: [1, 3] }),
      ev({ id: "race", kind: "competition", startsOn: "2026-11-29", title: "Media maratón" }),
      ev({ id: "rm", kind: "test", startsOn: "2026-12-02", title: "Resonancia" }),
      ev({ id: "far", kind: "competition", startsOn: "2027-03-01" }),
    ];
    expect(eventNotes(events, today).map((n) => n.text)).toEqual([
      "Cruzado anterior: hace 6 semanas (1 oct 2026)",
      "Viaje o vacaciones: hasta el 14 nov 2026",
      "Media maratón: en 17 días (29 nov 2026)",
      "Resonancia: en 20 días (2 dic 2026)",
    ]);
    expect(eventNotes([ev({ id: "old", startsOn: "2025-01-10" })], today)).toEqual([]);
  });
});

describe("lo de cada semana: un día que no, o hasta aquí", () => {
  const training = ev({ kind: "training", startsOn: "2026-11-03", repeatDays: [2, 4] });
  it("«este día no» lo quita solo ese día; «volver a poner» lo devuelve; se guarda limpio", () => {
    const skip = withoutDay(training, "2026-11-12");
    expect(skip.skipDays).toEqual(["2026-11-12"]);
    const skipped = { ...training, ...checkEvent(skip) };
    expect(days(occurrencesIn([skipped], "2026-11-01", "2026-11-15"))).toEqual(["2026-11-03", "2026-11-05", "2026-11-10"]);
    expect(withDay(skipped, "2026-11-12").skipDays).toEqual([]);
    // Días de verdad, sin repetir y en orden; en lo que no se repite no se guardan.
    expect(checkEvent({ ...skip, skipDays: ["2026-11-19", "x", "2026-11-12", "2026-11-19"] }).skipDays).toEqual(["2026-11-12", "2026-11-19"]);
    expect(checkEvent(input({ skipDays: ["2026-11-12"] })).skipDays).toEqual([]);
    // No avisa al dar cita ese día.
    expect(eventsAtVisit([{ ...training, time: "10:00", minutes: 60 }], "2026-11-12T09:00:00.000Z", 45)).toHaveLength(1);
    expect(eventsAtVisit([{ ...skipped, time: "10:00", minutes: 60 }], "2026-11-12T09:00:00.000Z", 45)).toHaveLength(0);
  });

  it("«desde este día ya no»: la serie acaba el día antes (y se olvidan los días sueltos de después); el primer día, no se puede", () => {
    const withSkips = { ...training, skipDays: ["2026-11-05", "2026-11-19"] };
    const ended = endedBefore(withSkips, "2026-11-12")!;
    expect(ended).toMatchObject({ repeatUntil: "2026-11-11", skipDays: ["2026-11-05"] });
    expect(endedBefore(training, "2026-11-03")).toBeNull();
    // Si ya acababa antes, se queda como estaba.
    expect(endedBefore({ ...training, repeatUntil: "2026-11-06" }, "2026-11-12")!.repeatUntil).toBe("2026-11-06");
  });

  it("se guarda y se sincroniza (migración 040)", async () => {
    const id = await savePatientEvent(db, pid, input({ kind: "training", startsOn: "2026-11-03", repeatDays: [2, 4] }));
    const saved = (await listPatientEvents(db, pid))[0]!;
    await savePatientEvent(db, pid, withoutDay(saved, "2026-11-12"), id);
    expect((await listPatientEvents(db, pid))[0]!.skipDays).toEqual(["2026-11-12"]);
    expect(await db.query("select field from sync_fields where tbl = 'patient_events' and pk = ?", [id])).toEqual([{ field: "skip_days" }]);
  });
});

describe("tras la operación y en la lista de hoy", () => {
  it("cuánto había pasado de la última operación (de menos de un año) el día de cada sesión", () => {
    const events = [ev({ id: "a", startsOn: "2025-02-01" }), ev({ id: "b", startsOn: "2026-10-01" }), ev({ id: "t", kind: "training", startsOn: "2026-10-20" })];
    expect(sinceSurgery(events, "2026-09-30")).toBeNull(); // la de 2025 ya pasó del año
    expect(sinceSurgery(events, "2026-11-12")).toMatchObject({ event: { id: "b" }, days: 42 });
    expect([0, 1, 9, 42, 44].map(afterSurgeryText)).toEqual([
      "el día de la operación",
      "1 día tras la operación",
      "9 días tras la operación",
      "6 semanas tras la operación",
      "6 semanas y 2 días tras la operación",
    ]);
  });

  it("corto, sin la fecha; de varios pacientes en una consulta", async () => {
    const events = [ev({ id: "op", startsOn: "2026-10-01", title: "Cruzado" }), ev({ id: "race", kind: "competition", startsOn: "2026-11-15", title: "Partido" })];
    expect(eventNotes(events, "2026-11-12", { brief: true }).map((n) => n.text)).toEqual(["Cruzado: hace 6 semanas", "Partido: en 3 días"]);
    const other = await createPatient(db, { ...patient, name: "Berta" });
    await savePatientEvent(db, pid, input({ title: "Cruzado" }));
    await savePatientEvent(db, other, input({ kind: "travel", startsOn: "2026-12-01", endsOn: "2026-12-05" }));
    const map = await eventsOfPatients(db, [pid, other, "nadie"]);
    expect([...map.keys()].sort()).toEqual([pid, other].sort());
    expect(map.get(other)![0]!.kind).toBe("travel");
    expect((await eventsOfPatients(db, [])).size).toBe(0);
  });
});
