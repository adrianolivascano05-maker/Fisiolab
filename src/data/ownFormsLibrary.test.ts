// La biblioteca de OmniClin (ownFormsLibrary.ts): cada uno pasa la comprobación y calcula justo lo indicado.
import { describe, expect, it } from "vitest";
import { answerText, buildForm, checkOwnForm, countedItems, multiPicked, scoreOwn, scoreRange, trackValue, type OwnFormSpec, type OwnItem } from "../clinical/forms/own";
import { libraryForm, OWN_FORMS_LIBRARY } from "./ownFormsLibrary";
import { addLibraryForm, listOwnForms } from "./ownForms";
import { createTestDb } from "./testDb";

const spec = (lib: string): OwnFormSpec => checkOwnForm({ ...structuredClone(libraryForm(lib)!.spec), id: "own:00000000-0000-4000-8000-000000000001", from: { lib, v: 1 } });
const q = (n: number) => `q_${String(n).padStart(8, "0")}`;
const all = (n: number, v: number | null) => Object.fromEntries(Array.from({ length: n }, (_, i) => [q(i + 1), v]));

describe("biblioteca de OmniClin", () => {
  it("los cuatro pasan la comprobación, con ids estables y sin umbrales", () => {
    expect(OWN_FORMS_LIBRARY.map((f) => f.lib)).toEqual(["lib_satisfaccion", "lib_adherencia", "lib_control_semanal", "lib_vuelta_deporte"]);
    for (const f of OWN_FORMS_LIBRARY) {
      const s = spec(f.lib);
      expect(s.from).toEqual({ lib: f.lib, v: 1 });
      expect(JSON.stringify(s)).not.toMatch(/umbral|threshold|cutoff|corte/i);
    }
  });

  it("Satisfacción: media de las contestadas, mínimo 3; todo mínimo, todo máximo; [Clínica]", () => {
    const s = spec("lib_satisfaccion");
    expect(scoreOwn(s, all(5, 0)).score).toBe(0);
    expect(scoreOwn(s, all(5, 10)).score).toBe(10);
    expect(scoreOwn(s, { [q(1)]: 9, [q(2)]: 8, [q(3)]: 6 }).score).toBe(7.7);
    expect(() => scoreOwn(s, { [q(1)]: 9, [q(2)]: 8 })).toThrow(/al menos 3/);
    expect(scoreRange(s)).toEqual({ min: 0, max: 10 });
    expect(buildForm(s, "Clínica Aurora").instructions).toContain("has recibido en Clínica Aurora.");
    expect(buildForm(s, "Clínica Aurora").instructions).toContain("Lo leerán tu fisioterapeuta y el equipo de la clínica que te atiende.");
    expect(buildForm(s).sections[0]!.items.some((it) => it.na)).toBe(false);
  });

  it("Adherencia: solo q1 + q2 (0-7); q3, q4 y q5 no entran; q3 de varias; q4 con su línea", () => {
    const s = spec("lib_adherencia");
    expect(countedItems(s).map((it) => it.id)).toEqual([q(1), q(2)]);
    expect(scoreRange(s)).toEqual({ min: 0, max: 7 });
    const answers = { [q(1)]: 4, [q(2)]: 3, [q(3)]: 1 + 4, [q(4)]: 2, [q(5)]: 0 };
    expect(scoreOwn(s, answers).score).toBe(7);
    expect(scoreOwn(s, { [q(1)]: 0, [q(2)]: 0, [q(3)]: 32, [q(4)]: 10 }).score).toBe(0);
    expect(() => scoreOwn(s, { [q(1)]: 2 })).toThrow(/hacen falta todas/);
    const items = s.sections[0]!.items;
    const multi = items[2] as Extract<OwnItem, { type: "options" }>;
    expect(multi.multiple).toBe(true);
    expect(multiPicked(multi, 1 + 4)).toEqual(["Falta de tiempo", "No me acordaba"]);
    expect(answerText(multi, 1 + 4)).toBe("Falta de tiempo, No me acordaba");
    expect(items[3]!.track).toEqual({ better: "higher" });
    expect(items[4]!.type === "options" && items[4].options.every((o) => o.points === undefined)).toBe(true);
    expect(buildForm(s).sections[0]!.items[2]!.multi).toBe(true);
  });

  it("Control semanal: sin nota; seis líneas con su flecha; ánimo con «Prefiero no responder»; el detalle del Sí", () => {
    const s = spec("lib_control_semanal");
    expect(s.scoring).toBeNull();
    expect(buildForm(s).score(all(6, 3))).toEqual({ score: null });
    const items = s.sections[0]!.items;
    expect(items.filter((it) => it.track)).toHaveLength(6);
    expect(items.map((it) => it.track?.better ?? null)).toEqual(["lower", "lower", "higher", "higher", "higher", null]);
    const form = buildForm(s);
    expect(form.sections[0]!.items[4]).toMatchObject({ na: true, naLabel: "Prefiero no responder" });
    expect(answerText(items[4]!, null)).toBe("Prefiero no responder");
    expect(form.sections[0]!.items[5]!.detail).toEqual({ when: 0, label: "Cuéntanos qué" });
    expect(answerText(items[5]!, 0, "Un pinchazo nuevo en la rodilla")).toBe("Sí: Un pinchazo nuevo en la rodilla");
    expect(trackValue(items[5]!, 0)).toBe(1);
    expect(trackValue(items[5]!, 1)).toBe(0);
  });

  it("Vuelta al deporte: suma de Sí (0-8), «No aplica» cuenta como sin responder, mínimo 6", () => {
    const s = spec("lib_vuelta_deporte");
    // En el formulario, «Sí» es la posición 0 (vale 1 punto) y «No» la 1 (vale 0).
    expect(scoreOwn(s, all(8, 0)).score).toBe(8);
    expect(scoreOwn(s, all(8, 1)).score).toBe(0);
    expect(scoreOwn(s, { ...all(6, 0), [q(7)]: null, [q(8)]: null }).score).toBe(6);
    expect(() => scoreOwn(s, { ...all(5, 0), [q(6)]: null, [q(7)]: null, [q(8)]: null })).toThrow(/al menos 6/);
    expect(buildForm(s).sections[0]!.items.every((it) => it.na)).toBe(true);
  });

  it("añadirlo lo hace de la clínica (una copia que se puede cambiar); dos veces, con otro nombre", async () => {
    const db = await createTestDb();
    const a = await addLibraryForm(db, "lib_control_semanal", "ana@x.es", "Clínica Aurora");
    const b = await addLibraryForm(db, "lib_control_semanal", "ana@x.es", "Clínica Aurora");
    expect(a.spec.id).toMatch(/^own:/);
    expect(a.spec.from).toEqual({ lib: "lib_control_semanal", v: 1 });
    expect(a.spec.noteClinic).toBe("Clínica Aurora");
    expect((await listOwnForms(db)).map((d) => d.spec.name)).toEqual(["Control semanal", "Control semanal (2)"]);
    expect(b.spec.id).not.toBe(a.spec.id);
  });
});
