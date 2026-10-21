import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { addStarterExercises, deleteExercise, listExercises, listPlans, planText, saveExercise, savePlan, STARTER_EXERCISES } from "./exercises";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("ejercicios para casa", () => {
  it("la biblioteca: ejemplos una sola vez, cambiar y borrar", async () => {
    expect(await addStarterExercises(db)).toBe(STARTER_EXERCISES.length);
    expect(await addStarterExercises(db)).toBe(0);
    const id = await saveExercise(db, { title: " Plancha ", region: "lumbar", dose: "3 × 20 s", instructions: "Apoyado en antebrazos." });
    const all = await listExercises(db);
    expect(all).toHaveLength(STARTER_EXERCISES.length + 1);
    expect(all.find((e) => e.id === id)).toMatchObject({ title: "Plancha", region: "lumbar" });
    await expect(saveExercise(db, { title: " ", region: "", dose: "", instructions: "" })).rejects.toThrow(/nombre/);
    await deleteExercise(db, id);
    expect(await listExercises(db)).toHaveLength(STARTER_EXERCISES.length);
  });

  it("la hoja copia el texto: cambiar la biblioteca no cambia lo dado", async () => {
    const pid = await createPatient(db, patient("Elena Ruiz"));
    const eid = await saveExercise(db, { title: "Puente", region: "lumbar", dose: "3 × 10", instructions: "Sube la cadera." });
    const [e] = await listExercises(db);
    const planId = await savePlan(db, pid, { items: [{ title: e!.title, dose: e!.dose, instructions: e!.instructions }, { title: " ", dose: "", instructions: "" }], note: "Sin dolor." });
    await saveExercise(db, { title: "Puente de glúteo", region: "lumbar", dose: "4 × 12", instructions: "" }, eid);
    let [plan] = await listPlans(db, pid);
    expect(plan).toMatchObject({ id: planId, note: "Sin dolor.", items: [{ title: "Puente", dose: "3 × 10", instructions: "Sube la cadera." }] });
    await savePlan(db, pid, { items: [...plan!.items, { title: "Caminar", dose: "30 min", instructions: "" }], note: "" }, planId);
    [plan] = await listPlans(db, pid);
    expect(plan!.items.map((i) => i.title)).toEqual(["Puente", "Caminar"]);
    await expect(savePlan(db, pid, { items: [], note: "" })).rejects.toThrow(/al menos un ejercicio/);
    await deletePatient(db, pid);
    expect(await db.query("select * from exercise_plans")).toEqual([]);
  });

  it("en texto, para WhatsApp", () => {
    expect(
      planText({ items: [{ title: "Puente", dose: "3 × 10", instructions: "Sube la cadera." }, { title: "Caminar", dose: "", instructions: "" }], note: "Sin dolor." }, "Elena Ruiz", "Fisiolab"),
    ).toBe("Hola, Elena. Tus ejercicios para casa (Fisiolab):\n\n1. Puente — 3 × 10\nSube la cadera.\n\n2. Caminar\n\nSin dolor.");
  });
});
