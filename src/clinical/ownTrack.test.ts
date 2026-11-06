// Las líneas por pregunta de un cuestionario propio (ownTrack.ts): cada pase con su versión; la pregunta, por su id.
import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../data/clinical";
import { checkOwnForm, type OwnFormSpec } from "./forms/own";
import { trackLines } from "./ownTrack";
import { libraryForm } from "../data/ownFormsLibrary";

const ID = "own:00000000-0000-4000-8000-000000000002";
const v1 = checkOwnForm({ ...structuredClone(libraryForm("lib_control_semanal")!.spec), id: ID, hash: "aaaaaaaaaaaa" });
// La versión 2 cambia el texto de la primera y deja de seguir el sueño.
const v2: OwnFormSpec = checkOwnForm({
  ...v1,
  hash: "bbbbbbbbbbbb",
  sections: [{ items: v1.sections[0]!.items.map((it, i) => (i === 0 ? { ...it, text: "Dolor medio (0-10)" } : i === 2 ? { ...it, track: undefined } : it)) }],
});
const specs = new Map([v1, v2].map((s) => [s.hash!, s]));
const specOf = (_id: string, hash?: string) => (hash ? specs.get(hash) : undefined);

const pass = (n: number, hash: string, answers: Record<string, number | null>, texts?: Record<string, string>): Questionnaire =>
  ({ id: `r${n}`, patientId: "p", kind: ID, performedAt: `2026-11-0${n}T10:00:00.000Z`, score: 0, details: { answers, ...(texts ? { texts } : {}), own: { id: ID, hash, name: "Control semanal", min: 0, max: 0, better: "higher", noScore: true } }, notes: "" }) as unknown as Questionnaire;

describe("líneas por pregunta", () => {
  it("las de la versión del último pase, con los valores de todos (del más antiguo al último) y su última respuesta", () => {
    const items = [
      pass(3, "bbbbbbbbbbbb", { q_00000001: 3, q_00000002: 5, q_00000005: null, q_00000006: 0 }, { q_00000006: "Pinchazo" }),
      pass(2, "aaaaaaaaaaaa", { q_00000001: 5, q_00000002: 6, q_00000005: 7, q_00000006: 1 }),
      pass(1, "aaaaaaaaaaaa", { q_00000001: 7, q_00000002: 8, q_00000005: 6 }),
    ];
    const lines = trackLines(items, specOf);
    expect(lines.map((l) => l.text)).toEqual([
      "Dolor medio (0-10)",
      "Peor momento de dolor esta semana",
      "¿Cuánto has podido hacer de tu actividad normal (trabajo, casa, deporte)?",
      "¿Cómo ha estado tu ánimo?",
      "¿Has tenido algún episodio nuevo o distinto esta semana?",
    ]);
    expect(lines[0]).toEqual({ id: "q_00000001", text: "Dolor medio (0-10)", better: "lower", values: [7, 5, 3], last: "3" });
    expect(lines[2]).toMatchObject({ values: [], last: "Sin responder" });
    expect(lines[3]).toMatchObject({ better: "higher", values: [6, 7], last: "Prefiero no responder" });
    expect(lines[4]).toEqual({ id: "q_00000006", text: "¿Has tenido algún episodio nuevo o distinto esta semana?", values: [0, 1], last: "Sí: Pinchazo" });
  });

  it("sin preguntas seguidas, o sin versión, no hay líneas", () => {
    const sat = checkOwnForm({ ...structuredClone(libraryForm("lib_satisfaccion")!.spec), id: ID, hash: "cccccccccccc" });
    expect(trackLines([pass(1, "cccccccccccc", { q_00000001: 8 })], () => sat)).toEqual([]);
    expect(trackLines([pass(1, "dddddddddddd", { q_00000001: 8 })], () => undefined)).toEqual([]);
    expect(trackLines([], specOf)).toEqual([]);
  });
});
