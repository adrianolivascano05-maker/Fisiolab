import { describe, expect, it } from "vitest";
import { agenda } from "./appointments";
import { importPatients, undoLastImport } from "./importPatients";
import { existingKeys, guessRecordFields, importRecords, parseDateTime, parseTime, planRecords } from "./importRecords";
import { createPatient, listPatients } from "./repo";
import { createTestDb } from "./testDb";

const person = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("fechas y horas", () => {
  it("la hora suelta o dentro de la fecha, y la fracción de día de Excel", () => {
    expect(["10:30", "10.30", "10h", "4 pm", "12:15 am", "0,4375"].map(parseTime)).toEqual([630, 630, 600, 960, 15, 630]);
    expect(parseTime("25:00")).toBeNull();
    expect(parseDateTime("12/03/2027", "10:30")).toBe(local(2027, 3, 12, 10, 30));
    expect(parseDateTime("12/03/2027 10:30")).toBe(local(2027, 3, 12, 10, 30));
    expect(parseDateTime("2027-03-12T09:15:00")).toBe(local(2027, 3, 12, 9, 15));
    expect(parseDateTime("46458.4375")).toBe(local(2027, 3, 12, 10, 30)); // número de serie con la hora
    expect(parseDateTime("mañana")).toBeNull();
  });
});

describe("citas y sesiones de otro programa", () => {
  it("adivina las columnas", () => {
    expect(guessRecordFields("appointments", ["Paciente", "Fecha", "Hora inicio", "Hora fin", "Profesional", "Estado", "Sala"])).toEqual([
      "patient",
      "date",
      "time",
      "end",
      "person",
      "status",
      "notes",
    ]);
    expect(guessRecordFields("sessions", ["Nombre", "Apellidos", "Fecha", "EVA", "Evolución", "Tratamiento realizado", "Ejercicios"])).toEqual([
      "patient",
      "lastName",
      "date",
      "pain",
      "notes",
      "treatment",
      "plan",
    ]);
  });

  it("citas: une cada una a su paciente, calcula la duración, el estado y con quién; avisa de lo que no encaja", () => {
    const table = [
      ["Paciente", "Fecha", "Hora inicio", "Hora fin", "Profesional", "Estado"],
      ["Ana Ruiz", "02/11/2030", "10:00", "10:30", "Bruno Gil", ""],
      ["ana  ruiz", "01/02/2020", "9:00", "", "Bruno", "No asistió"],
      ["Paciente Nuevo", "03/11/2030", "16:00", "", "Desconocida", "Anulada"],
      ["", "03/11/2030", "16:00", "", "", ""],
      ["Ana Ruiz", "nunca", "", "", "", ""],
    ];
    const plan = planRecords("appointments", table, guessRecordFields("appointments", table[0]!), {
      patients: [{ id: "p1", name: "Ana Ruiz" }],
      staff: [{ email: "bruno@x.es", name: "Bruno Gil" }],
      now: new Date("2026-10-21T00:00:00Z"),
    });
    expect(plan.rows.map((r) => [r.patientId, r.appointment])).toEqual([
      ["p1", { minutes: 30, status: "scheduled", assignedTo: "bruno@x.es" }],
      ["p1", { minutes: 45, status: "no_show", assignedTo: "bruno@x.es" }],
      [null, { minutes: 45, status: "cancelled", assignedTo: null }],
    ]);
    expect(plan.newPatients).toEqual(["Paciente Nuevo"]);
    expect(plan.unknownPeople).toEqual(["Desconocida"]);
    expect(plan.noPatient).toEqual([5]);
    expect(plan.badDate).toEqual([6]);
  });

  it("sesiones: las notas van con el tratamiento; se importan, no se repiten y se pueden deshacer con los pacientes creados", async () => {
    const db = await createTestDb();
    const ana = await createPatient(db, person("Ana Ruiz"));
    const table = [
      ["Paciente", "Fecha", "EVA", "Evolución", "Ejercicios"],
      ["Ana Ruiz", "01/10/2026 09:00", "6", "Mejor que la semana pasada", "Puente 3x10"],
      ["Luis Nuevo", "02/10/2026 10:00", "11", "Primera visita", ""],
    ];
    const fields = guessRecordFields("sessions", table[0]!);
    const plan = planRecords("sessions", table, fields, { patients: [{ id: ana, name: "Ana Ruiz" }], existing: await existingKeys(db, "sessions") });
    expect(plan.rows[0]!.session).toEqual({ pain: 6, subjective: "", objective: "", treatment: "Evolución: Mejor que la semana pasada", plan: "Puente 3x10" });
    expect(plan.rows[1]!.session!.pain).toBeNull(); // 11 no es un dolor 0-10
    expect(await importRecords(db, "sessions", plan, "historial.xlsx")).toEqual({ records: 2, patients: 1 });
    expect((await listPatients(db)).map((p) => p.name)).toEqual(["Ana Ruiz", "Luis Nuevo"]);
    expect(await db.query("select treatment from sessions order by performed_at")).toEqual([{ treatment: "Evolución: Mejor que la semana pasada" }, { treatment: "Evolución: Primera visita" }]);

    // Volver a importar el mismo archivo no repite nada.
    const again = planRecords("sessions", table, fields, {
      patients: (await listPatients(db)).map((p) => ({ id: p.id, name: p.name })),
      existing: await existingKeys(db, "sessions"),
    });
    expect(again.rows.every((r) => r.duplicate)).toBe(true);

    expect(await undoLastImport(db)).toBe(3); // 2 sesiones y el paciente creado
    expect((await listPatients(db)).map((p) => p.name)).toEqual(["Ana Ruiz"]);
    expect(await db.query("select count(*) as n from sessions")).toEqual([{ n: 0 }]);
  });

  it("citas importadas en la agenda; deshacer no toca los pacientes de una importación anterior", async () => {
    const db = await createTestDb();
    await importPatients(db, [person("Eva Gil")], "pacientes.csv");
    const patients = (await listPatients(db)).map((p) => ({ id: p.id, name: p.name }));
    const plan = planRecords("appointments", [["Paciente", "Fecha"], ["Eva Gil", "05/11/2030 10:00"]], ["patient", "date"], { patients });
    await importRecords(db, "appointments", plan, "citas.csv");
    expect((await agenda(db, local(2030, 11, 5), local(2030, 11, 6))).map((a) => [a.name, a.minutes, a.status])).toEqual([["Eva Gil", 45, "scheduled"]]);
    expect(await undoLastImport(db)).toBe(1);
    expect((await listPatients(db)).map((p) => p.name)).toEqual(["Eva Gil"]);
  });
});
