import { describe, expect, it } from "vitest";
import { history, listPatients } from "./repo";
import { hasSeed, loadSeed, removeSeed } from "./seed";
import { createTestDb } from "./testDb";

describe("datos de ejemplo", () => {
  it("la evolución de Lucía sube semana a semana", async () => {
    const db = await createTestDb();
    await loadSeed(db);
    const lucia = (await listPatients(db)).find((p) => p.name.includes("Lucía"))!;
    const pts = await history(db, lucia.id, "cmj", "jump_height_cm");
    console.log(pts.map((p) => `${p.performedAt.slice(0, 10)} ${p.value.toFixed(1)}`));
    expect(pts).toHaveLength(5);
    expect(pts.map((p) => p.value)).toEqual([...pts.map((p) => p.value)].sort((a, b) => a - b));
    expect(await hasSeed(db)).toBe(true);
    expect(await removeSeed(db)).toBe(3);
    expect(await listPatients(db)).toHaveLength(0);
  });
});
