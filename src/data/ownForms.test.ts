// Cuestionarios propios (ownForms.ts y ownCatalog.ts): versiones con huella, archivar, duplicar, el aviso y el catálogo.
import { beforeEach, describe, expect, it } from "vitest";
import type { OwnFormSpec } from "../clinical/forms/own";
import { activeKinds, getKind, kindOf } from "../clinical/questionnaires";
import { formFor } from "../clinical/forms";
import { loadOwnCatalog, ownSpec, setOwnClinic, setOwnForms } from "../clinical/ownCatalog";
import type { Db } from "./db";
import { archiveOwnForm, duplicateOwnForm, getOwnForm, getOwnNotice, getOwnSnapshot, listOwnForms, listOwnSnapshots, markOwnNotice, newOwnFormId, renameOwnForm, saveOwnForm } from "./ownForms";
import { emptyClinic, saveClinic } from "./privacy";
import { createTestDb } from "./testDb";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  setOwnForms([]);
  setOwnClinic("");
});

const spec = (id = newOwnFormId()): OwnFormSpec => ({
  v: 1,
  id,
  name: "Satisfacción",
  note: "Para comentar en la consulta.",
  sections: [{ items: [{ id: "q_00000001", type: "scale", text: "¿Cómo de satisfecho?", from: 0, to: 10, ends: ["Nada", "Mucho"] }] }],
  scoring: { method: "sum", better: "higher", na: "block" },
});

describe("guardar y versiones", () => {
  it("guardar dos veces crea dos instantáneas; la primera no cambia", async () => {
    const s = spec();
    const v1 = await saveOwnForm(db, s, "ana@x.es");
    expect(v1.spec.hash).toMatch(/^[0-9a-f]{12}$/);
    const v2 = await saveOwnForm(db, { ...s, sections: [{ items: [{ ...s.sections[0]!.items[0]!, text: "¿Satisfecho con el trato?" }] }] }, "ana@x.es");
    expect(v2.spec.hash).not.toBe(v1.spec.hash);
    expect((await listOwnSnapshots(db)).map((x) => x.hash).sort()).toEqual([v1.spec.hash, v2.spec.hash].sort());
    expect((await getOwnSnapshot(db, s.id, v1.spec.hash!))!.sections[0]!.items[0]!.text).toBe("¿Cómo de satisfecho?");
    expect((await getOwnForm(db, s.id))!.spec.hash).toBe(v2.spec.hash);
    // Guardar lo mismo otra vez no crea otra versión.
    await saveOwnForm(db, v2.spec, "ana@x.es");
    expect(await listOwnSnapshots(db)).toHaveLength(2);
  });

  it("una respuesta hecha con la primera versión se sigue leyendo con sus preguntas y su nota", async () => {
    const s = spec();
    const v1 = await saveOwnForm(db, s, null);
    await saveOwnForm(db, { ...s, name: "Satisfacción v2", sections: [{ items: [{ id: "q_00000002", type: "yesno", text: "¿Volvería?", yes: 1, no: 0 }] }] }, null);
    await loadOwnCatalog(db);
    const old = formFor(s.id, v1.spec.hash);
    expect(old!.sections[0]!.items[0]!.text).toBe("¿Cómo de satisfecho?");
    expect(old!.score({ q_00000001: 7 })).toEqual({ score: 7 });
    expect(formFor(s.id)!.sections[0]!.items[0]!.text).toBe("¿Volvería?");
    const details = { answers: { q_00000001: 7 }, own: { id: s.id, hash: v1.spec.hash!, name: "Satisfacción", min: 0, max: 10, better: "higher" as const, note: s.note } };
    expect(kindOf(s.id, details)).toMatchObject({ name: "Satisfacción", min: 0, max: 10, own: true, note: "Para comentar en la consulta." });
  });

  it("«[Clínica]» en las instrucciones: el nombre de Ajustes › Clínica, si no el de la nube, si no «la clínica»", async () => {
    const s = { ...spec(), instructions: "Piensa en lo que has recibido en [Clínica]." };
    await saveOwnForm(db, s, null);
    expect(await loadOwnCatalog(db)).toBe(true);
    expect(formFor(s.id)!.instructions).toBe("Piensa en lo que has recibido en la clínica.");
    expect(await loadOwnCatalog(db, "Fisiolab Centro")).toBe(true);
    expect(formFor(s.id)!.instructions).toBe("Piensa en lo que has recibido en Fisiolab Centro.");
    await saveClinic(db, { ...emptyClinic, name: "Clínica Aurora" });
    await loadOwnCatalog(db, "Fisiolab Centro");
    expect(formFor(s.id)!.instructions).toBe("Piensa en lo que has recibido en Clínica Aurora.");
    expect(await loadOwnCatalog(db, "Fisiolab Centro")).toBe(false);
  });

  it("archivar: fuera de «Pasar» y «Enviar», pero se sigue leyendo; duplicar y renombrar", async () => {
    const s = spec();
    const v1 = await saveOwnForm(db, s, null);
    await loadOwnCatalog(db);
    expect(activeKinds().some((k) => k.id === s.id)).toBe(true);
    await archiveOwnForm(db, s.id, true, null);
    await loadOwnCatalog(db);
    expect(activeKinds().some((k) => k.id === s.id)).toBe(false);
    expect(getKind(s.id)).toMatchObject({ archived: true, own: true });
    expect(formFor(s.id, v1.spec.hash)).toBeTruthy();
    const copy = await duplicateOwnForm(db, s.id, null);
    expect(copy!.spec.id).not.toBe(s.id);
    expect(copy!.spec.name).toBe("Satisfacción (copia)");
    expect(copy!.archived).toBeUndefined();
    await renameOwnForm(db, copy!.spec.id, "Satisfacción breve", null);
    expect((await listOwnForms(db)).map((d) => d.spec.name)).toEqual(["Satisfacción", "Satisfacción breve"]);
  });

  it("lo que no vale no se guarda", async () => {
    await expect(saveOwnForm(db, { ...spec(), sections: [] }, null)).rejects.toThrow(/al menos una pregunta/);
    expect(await listOwnForms(db)).toEqual([]);
  });

  it("el aviso de derechos de autor: quién lo vio y cuándo, una vez", async () => {
    expect(await getOwnNotice(db)).toBeNull();
    await markOwnNotice(db, "ana@x.es");
    const first = await getOwnNotice(db);
    expect(first).toMatchObject({ by: "ana@x.es" });
    await markOwnNotice(db, "bruno@x.es");
    expect(await getOwnNotice(db)).toEqual(first);
  });

  it("el registro en memoria guarda todas las versiones", async () => {
    const s = spec();
    const v1 = await saveOwnForm(db, s, null);
    await saveOwnForm(db, { ...s, name: "Otro nombre" }, null);
    await loadOwnCatalog(db);
    expect(ownSpec(s.id, v1.spec.hash)!.name).toBe("Satisfacción");
    expect(ownSpec(s.id)!.name).toBe("Otro nombre");
  });
});
