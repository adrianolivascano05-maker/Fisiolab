// El catálogo con los cuestionarios propios de la clínica: etiqueta fija, sin umbrales, «más/menos es mejor» solo
// orienta, y los archivados fuera de «Pasar» y «Enviar» pero legibles.
import { beforeEach, describe, expect, it } from "vitest";
import { OWN_LABEL, type OwnFormSpec } from "./forms/own";
import { kindOfSpec, ownDetails, setOwnForms } from "./ownCatalog";
import { sendableKinds } from "./patientForms";
import { activeKinds, displayName, getKind, kindOf, scoreText, type QDetails } from "./questionnaires";

const spec = (over: Partial<OwnFormSpec> = {}): OwnFormSpec => ({
  v: 1,
  id: "own:11111111-2222-4333-8444-555566667777",
  name: "Adherencia",
  hash: "abcdefabcdef",
  sections: [{ items: [{ id: "q_00000001", type: "options", text: "¿Hizo los ejercicios?", options: [{ label: "Nunca", points: 0 }, { label: "Siempre", points: 3 }] }] }],
  scoring: { method: "sum", better: "higher", na: "block" },
  ...over,
});

beforeEach(() => setOwnForms([]));

describe("cuestionarios propios en el catálogo", () => {
  it("llevan siempre la etiqueta, con su rango y sin rangos ni lecturas", () => {
    setOwnForms([{ spec: spec() }]);
    const k = getKind(spec().id)!;
    expect(k).toMatchObject({ own: true, name: "Adherencia", min: 0, max: 3, better: "higher" });
    expect(k.ranges).toBeUndefined();
    expect(k.reading).toBeUndefined();
    expect(displayName(k.id, { own: ownDetails(spec()) })).toBe(`Adherencia (${OWN_LABEL})`);
  });

  it("no existe ningún campo de umbral; «better» solo cambia la flecha", () => {
    const higher = kindOfSpec(spec());
    const lower = kindOfSpec(spec({ scoring: { method: "sum", better: "lower", na: "block" } }));
    const { better: _a, ...a } = higher;
    const { better: _b, ...b } = lower;
    expect(a).toEqual(b);
    expect(JSON.stringify(higher)).not.toMatch(/umbral|threshold|cutoff|corte|color/i);
  });

  it("un registro se lee con la versión con la que se hizo, aunque ya no esté en el catálogo", () => {
    const d: QDetails = { answers: { q_00000001: 1 }, own: { ...ownDetails(spec()), name: "Adherencia (antigua)", note: "Comentar con el paciente.", noteClinic: "Clínica Aurora", noteAt: "2026-11-05" } };
    expect(kindOf(spec().id, d)).toMatchObject({ name: "Adherencia (antigua)", own: true, note: "Comentar con el paciente.", noteClinic: "Clínica Aurora" });
    expect(scoreText(kindOf(spec().id, d), 3)).toBe("3/3");
  });

  it("sin nota: «Sin nota», nunca un número", () => {
    const k = kindOfSpec(spec({ scoring: null }));
    expect(k.noScore).toBe(true);
    expect(scoreText(k, 0)).toBe("Sin nota");
  });

  it("archivados: fuera de «Pasar» y «Enviar», pero se siguen encontrando", () => {
    setOwnForms([{ spec: spec(), archived: true }, { spec: spec({ id: "own:99999999-2222-4333-8444-555566667777", name: "Control semanal" }) }]);
    expect(activeKinds().filter((k) => k.own).map((k) => k.name)).toEqual(["Control semanal"]);
    expect(sendableKinds().filter((k) => k.own).map((k) => k.name)).toEqual(["Control semanal"]);
    expect(getKind(spec().id)).toMatchObject({ archived: true });
  });
});
