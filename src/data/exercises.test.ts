import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { addStarterExercises, cleanVideo, deleteExercise, deleteTemplate, listExercises, listPlans, listTemplates, planText, saveExercise, savePlan, saveTemplate, STARTER_EXERCISES } from "./exercises";
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

  it("vídeo de cada ejercicio: enlaces web, en la hoja y en el texto", async () => {
    expect(cleanVideo(" youtu.be/abc ")).toBe("https://youtu.be/abc");
    expect(cleanVideo("")).toBe("");
    expect(() => cleanVideo("no es un enlace")).toThrow(/dirección web/);
    const eid = await saveExercise(db, { title: "Puente", region: "lumbar", dose: "", instructions: "", video: "https://www.youtube.com/watch?v=x" });
    expect((await listExercises(db)).find((e) => e.id === eid)?.video).toBe("https://www.youtube.com/watch?v=x");
    const pid = await createPatient(db, patient("Eva Gil"));
    await savePlan(db, pid, { items: [{ title: "Puente", dose: "", instructions: "", video: "youtu.be/x" }], note: "" });
    const [plan] = await listPlans(db, pid);
    expect(plan!.items[0]!.video).toBe("https://youtu.be/x");
    expect(planText(plan!, "Eva Gil", "")).toContain("Vídeo: https://youtu.be/x");
  });

  it("plantillas de hojas: guardar con nombre, cambiar la del mismo nombre y borrar", async () => {
    await saveTemplate(db, "Lumbalgia, fase 1", { items: [{ title: "Gato-camello", dose: "10", instructions: "" }], note: "Sin dolor." });
    await saveTemplate(db, "lumbalgia, FASE 1", { items: [{ title: "Puente", dose: "3 × 10", instructions: "" }], note: "" });
    await saveTemplate(db, "Hombro", { items: [{ title: "Péndulo", dose: "", instructions: "" }], note: "" });
    const all = await listTemplates(db);
    expect(all.map((t) => [t.title, t.items.map((i) => i.title)])).toEqual([
      ["Hombro", ["Péndulo"]],
      ["lumbalgia, FASE 1", ["Puente"]],
    ]);
    await expect(saveTemplate(db, " ", { items: [{ title: "X", dose: "", instructions: "" }], note: "" })).rejects.toThrow(/nombre/);
    await deleteTemplate(db, all[0]!.id);
    expect((await listTemplates(db)).map((t) => t.title)).toEqual(["lumbalgia, FASE 1"]);
  });
});
