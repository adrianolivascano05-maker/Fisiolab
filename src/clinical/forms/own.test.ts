// Cuestionarios propios (own.ts): la nota es aritmética simple y nunca se interpreta; las comprobaciones al guardar.
import { describe, expect, it } from "vitest";
import { answerText, buildForm, checkOwnForm, copyrightName, countedItems, fillClinic, OWN_LABEL, scoreOwn, scoreRange, trackValue, type OwnFormSpec, type OwnItem } from "./own";

const id = "own:0b6f0e1a-1111-4222-8333-444455556666";
const q = (n: number) => `q_${String(n).padStart(8, "0")}`;
const scale = (n: number, from = 0, to = 10, extra: Partial<OwnItem> = {}): OwnItem => ({ id: q(n), type: "scale", text: `Pregunta ${n}`, from, to, ...extra }) as OwnItem;
const opts = (n: number, points: number[], extra: Partial<OwnItem> = {}): OwnItem =>
  ({ id: q(n), type: "options", text: `Pregunta ${n}`, options: points.map((p, i) => ({ label: `Opción ${i}`, points: p })), ...extra }) as OwnItem;
const spec = (items: OwnItem[], scoring: OwnFormSpec["scoring"] = { method: "sum", better: "higher", na: "block" }, more: Partial<OwnFormSpec> = {}): OwnFormSpec => ({
  v: 1,
  id,
  name: "Satisfacción",
  sections: [{ items }],
  scoring,
  ...more,
});

describe("nota: suma, media y porcentaje", () => {
  // Una normal (0-3) y una invertida (Siempre 0 … Nunca 3): los puntos van en cada opción.
  const normal = opts(1, [0, 1, 2, 3]);
  const reversed = opts(2, [3, 2, 1, 0]);

  it("suma con un ítem invertido: se guardan posiciones y puntúan sus puntos", () => {
    const f = buildForm(spec([normal, reversed]));
    // Posición 3 de la normal = 3 puntos; posición 0 de la invertida = 3 puntos.
    expect(f.score({ [q(1)]: 3, [q(2)]: 0 })).toEqual({ score: 6 });
    expect(f.score({ [q(1)]: 0, [q(2)]: 3 })).toEqual({ score: 0 });
    expect(f.sections[0]!.items[1]!.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });

  it("media y porcentaje; todo mínimo y todo máximo; escala que no es 0-10", () => {
    const items = [scale(1, 1, 5), scale(2, 1, 5), opts(3, [0, 4])];
    const mean = spec(items, { method: "mean", better: "lower", na: "block" });
    const pct = spec(items, { method: "percent", better: "higher", na: "block" });
    expect(scoreOwn(mean, { [q(1)]: 1, [q(2)]: 1, [q(3)]: 0 }).score).toBe(0.7);
    expect(scoreOwn(pct, { [q(1)]: 1, [q(2)]: 1, [q(3)]: 0 }).score).toBe(0);
    expect(scoreOwn(pct, { [q(1)]: 5, [q(2)]: 5, [q(3)]: 1 }).score).toBe(100);
    // (3+5+4 − (1+1+0)) / ((5+5+4) − (1+1+0)) × 100 = 10/12 × 100
    expect(scoreOwn(pct, { [q(1)]: 3, [q(2)]: 5, [q(3)]: 1 }).score).toBe(83.3);
    expect(scoreRange(mean)).toEqual({ min: 0.7, max: 4.7 });
    expect(scoreRange(pct)).toEqual({ min: 0, max: 100 });
    expect(scoreRange(spec(items))).toEqual({ min: 2, max: 14 });
  });

  it("«No aplica» con block lanza un error claro; con skip calcula sobre las contestadas si llegan al mínimo", () => {
    const items = [scale(1, 0, 10, { na: true }), scale(2), scale(3)];
    expect(() => scoreOwn(spec(items), { [q(1)]: null, [q(2)]: 5, [q(3)]: 5 })).toThrow(RangeError);
    expect(() => scoreOwn(spec(items), { [q(1)]: null, [q(2)]: 5, [q(3)]: 5 })).toThrow(/Falta 1 respuesta/);
    const skip = spec(items, { method: "mean", better: "higher", na: "skip", minAnswered: 2 });
    expect(scoreOwn(skip, { [q(1)]: null, [q(2)]: 4, [q(3)]: 6 }).score).toBe(5);
    expect(() => scoreOwn(skip, { [q(2)]: 4 })).toThrow(/al menos 2 contestadas/);
    const pct = spec(items, { method: "percent", better: "higher", na: "skip", minAnswered: 2 });
    expect(scoreOwn(pct, { [q(1)]: null, [q(2)]: 10, [q(3)]: 0 }).score).toBe(50);
  });

  it("subescalas con preguntas compartidas, con su máximo", () => {
    const items = [scale(1), scale(2), scale(3)];
    const s = spec(items, { method: "sum", better: "higher", na: "block", subscales: [{ name: "A", items: [q(1), q(2)] }, { name: "B", items: [q(2), q(3)] }] });
    expect(scoreOwn(s, { [q(1)]: 1, [q(2)]: 2, [q(3)]: 3 })).toEqual({ score: 6, subscores: [{ name: "A", score: 3, max: 20 }, { name: "B", score: 5, max: 20 }] });
  });

  it("Sí/No con sus puntos; un número cuenta solo si se marca; sin nota no se calcula nada", () => {
    const yesno: OwnItem = { id: q(1), type: "yesno", text: "¿Hizo los ejercicios?", yes: 1, no: 0 };
    const minutes: OwnItem = { id: q(2), type: "number", text: "Minutos", unit: "min", min: 0, max: 120 };
    expect(scoreOwn(spec([yesno, minutes]), { [q(1)]: 0, [q(2)]: 90 }).score).toBe(1);
    expect(scoreOwn(spec([yesno, { ...minutes, counts: true }]), { [q(1)]: 1, [q(2)]: 30 }).score).toBe(30);
    expect(buildForm(spec([yesno], null)).score({ [q(1)]: 0 })).toEqual({ score: null });
  });

  it("como cuestionario de la app: apartados, escala con sus extremos, «No aplica» y la etiqueta", () => {
    const f = buildForm(spec([scale(1, 0, 10, { na: true, ends: ["Nada", "Mucho"] } as Partial<OwnItem>)], null, { instructions: "Piense en la última semana." }));
    expect(f.id).toBe(id);
    expect(f.instructions).toBe("Piense en la última semana.");
    expect(f.sections[0]!.items[0]).toEqual({ id: q(1), text: "Pregunta 1", na: true, scale: { from: 0, to: 10, ends: ["Nada", "Mucho"] } });
    expect(f.source).toBe(OWN_LABEL);
  });
});

describe("comprobar al guardar", () => {
  it("rechaza: sin preguntas, opciones repetidas, puntos no numéricos, rango incoherente, más de 60, más de 32 KB, ids repetidos", () => {
    expect(() => checkOwnForm(spec([]))).toThrow(/al menos una pregunta/);
    expect(() => checkOwnForm(spec([{ ...opts(1, [0, 1]), options: [{ label: "Sí", points: 1 }, { label: "sí", points: 0 }] } as OwnItem]))).toThrow(/repetida/);
    expect(() => checkOwnForm(spec([{ ...opts(1, [0, 1]), options: [{ label: "A", points: "1" }, { label: "B", points: 0 }] } as unknown as OwnItem]))).toThrow(/número/);
    expect(() => checkOwnForm(spec([scale(1, 10, 0)]))).toThrow(/de menos a más/);
    expect(() => checkOwnForm(spec([{ id: q(1), type: "number", text: "x", unit: "", min: 5, max: 5 }]))).toThrow(/mínimo/);
    expect(() => checkOwnForm(spec(Array.from({ length: 61 }, (_, i) => scale(i + 1))))).toThrow(/60 preguntas/);
    const long = Array.from({ length: 60 }, (_, i) => ({ id: q(i + 1), type: "options", text: "x".repeat(300), options: [0, 1, 2, 3, 4].map((p) => ({ label: `${p} ${"y".repeat(110)}`, points: p })) }) as OwnItem);
    expect(() => checkOwnForm(spec(long))).toThrow(/32 KB/);
    expect(() => checkOwnForm(spec([scale(1), scale(1)]))).toThrow(/repetido/);
    expect(() => checkOwnForm(spec([{ ...scale(1), id: "q_1" }]))).toThrow(/identificador/);
    expect(() => checkOwnForm(spec([opts(1, [2, 2])]))).toThrow(/valen lo mismo/);
    // Sin nota, una pregunta cuyas opciones valen lo mismo sí vale.
    expect(() => checkOwnForm(spec([opts(1, [0, 0])], null))).not.toThrow();
  });

  it("no hay forma de guardar un umbral, un punto de corte ni colores: las claves que no conoce se quitan", () => {
    const evil = { ...spec([scale(1)]), threshold: 7, cutoff: 3, scoring: { method: "sum", better: "higher", na: "block", threshold: 5, colors: ["red"] } } as unknown as OwnFormSpec;
    const clean = checkOwnForm(evil);
    expect(JSON.stringify(clean)).not.toMatch(/threshold|cutoff|colors/);
    expect(clean.scoring).toEqual({ method: "sum", better: "higher", na: "block" });
  });

  it("subescalas: solo con preguntas que cuentan; mínimo de contestadas dentro de rango", () => {
    const items = [scale(1), { id: q(2), type: "number", text: "Min", unit: "", min: 0, max: 9 } as OwnItem];
    expect(() => checkOwnForm(spec(items, { method: "sum", better: "higher", na: "block", subscales: [{ name: "S", items: [q(2)] }] }))).toThrow(/no tiene preguntas que cuenten/);
    expect(() => checkOwnForm(spec(items, { method: "sum", better: "higher", na: "skip", minAnswered: 2 }))).toThrow(/de 1 a 1/);
  });

  it("avisa de los nombres con derechos de autor (solo aviso)", () => {
    expect(copyrightName("KOOS adaptado")).toBe("KOOS");
    expect(copyrightName("Índice de Oswestry")).toBe("Oswestry");
    expect(copyrightName("quickdash")).toBe("QuickDASH");
    expect(copyrightName("Satisfacción con el tratamiento")).toBeNull();
    expect(copyrightName("Dashboard semanal")).toBeNull();
  });
});

describe("por pregunta: cuenta en la nota, varias, delicadas, detalle del Sí y su línea", () => {
  it("«no cuenta en la nota»: se guarda pero no suma; las opciones de una así no necesitan puntos", () => {
    const s = checkOwnForm(spec([scale(1), { ...opts(2, [0, 1]), uncounted: true, options: [{ label: "A" }, { label: "B" }] } as OwnItem]));
    expect(countedItems(s).map((it) => it.id)).toEqual([q(1)]);
    expect(s.sections[0]!.items[1]).toEqual({ id: q(2), type: "options", text: "Pregunta 2", uncounted: true, options: [{ label: "A" }, { label: "B" }] });
    expect(scoreOwn(s, { [q(1)]: 6, [q(2)]: 1 }).score).toBe(6);
    expect(scoreRange(s)).toEqual({ min: 0, max: 10 });
    // Con su línea, sí hacen falta (es lo que se dibuja).
    expect(() => checkOwnForm(spec([scale(1), { ...opts(2, [0, 1]), uncounted: true, track: {}, options: [{ label: "A" }, { label: "B" }] } as OwnItem]))).toThrow(/puntos de «A»/);
    // Si cuenta en la nota, también.
    expect(() => checkOwnForm(spec([{ ...opts(1, [0, 1]), options: [{ label: "A" }, { label: "B" }] } as OwnItem]))).toThrow(/puntos de «A»/);
  });

  it("«puede marcar varias»: nunca cuenta ni tiene línea; se guarda en un número y se lee en texto", () => {
    const s = checkOwnForm(spec([scale(1), { ...opts(2, [0, 1, 2]), multiple: true, track: { better: "higher" } } as OwnItem]));
    const multi = s.sections[0]!.items[1]!;
    expect(multi).toMatchObject({ multiple: true, uncounted: true });
    expect(multi.track).toBeUndefined();
    expect(countedItems(s)).toHaveLength(1);
    expect(buildForm(s).sections[0]!.items[1]).toMatchObject({ multi: true });
    expect(answerText(multi, 2 + 4)).toBe("Opción 1, Opción 2");
    expect(trackValue(multi, 6)).toBeNull();
  });

  it("delicada: «Prefiero no responder» en lugar de «No aplica», y cuenta como sin responder", () => {
    const s = checkOwnForm(spec([scale(1, 0, 10, { na: true, sensitive: true }), scale(2)], { method: "sum", better: "higher", na: "skip", minAnswered: 1 }));
    expect(s.sections[0]!.items[0]).toMatchObject({ sensitive: true });
    expect(s.sections[0]!.items[0]!.na).toBeUndefined();
    expect(buildForm(s).sections[0]!.items[0]).toMatchObject({ na: true, naLabel: "Prefiero no responder" });
    expect(scoreOwn(s, { [q(1)]: null, [q(2)]: 4 }).score).toBe(4);
    expect(answerText(s.sections[0]!.items[0]!, null)).toBe("Prefiero no responder");
    expect(answerText(s.sections[0]!.items[1]!, null)).toBe("No aplica");
  });

  it("Sí/No con detalle: solo al contestar «Sí», nunca puntúa; su línea va con Sí = 1 y No = 0", () => {
    const yn = { id: q(1), type: "yesno", text: "¿Algo nuevo?", yes: 1, no: 0, detail: "Cuéntanos qué", track: {} } as OwnItem;
    const s = checkOwnForm(spec([yn], null));
    expect(buildForm(s).sections[0]!.items[0]).toMatchObject({ detail: { when: 0, label: "Cuéntanos qué" } });
    expect(answerText(s.sections[0]!.items[0]!, 0, " Rodilla ")).toBe("Sí: Rodilla");
    expect(answerText(s.sections[0]!.items[0]!, 1, "no se guarda")).toBe("No");
    expect(s.sections[0]!.items[0]!.track).toEqual({});
  });

  it("su línea: la flecha solo orienta; un número no puede «no contar» por la otra vía", () => {
    const s = checkOwnForm(spec([scale(1, 0, 10, { track: { better: "lower" } }), { id: q(2), type: "number", text: "Min", unit: "min", min: 0, max: 90, uncounted: true, track: { better: "rojo" } } as unknown as OwnItem]));
    expect(s.sections[0]!.items[0]!.track).toEqual({ better: "lower" });
    expect(s.sections[0]!.items[1]).toEqual({ id: q(2), type: "number", text: "Min", unit: "min", min: 0, max: 90, track: {} });
    expect(trackValue(s.sections[0]!.items[1]!, 30)).toBe(30);
    expect(answerText(s.sections[0]!.items[1]!, 30.5)).toBe("30,5 min");
  });

  it("[Clínica] en las instrucciones: el nombre de la clínica, o «la clínica»", () => {
    expect(fillClinic("Atendido en [Clínica].", "Clínica Aurora")).toBe("Atendido en Clínica Aurora.");
    expect(fillClinic("Atendido en [Clínica].", " ")).toBe("Atendido en la clínica.");
    expect(buildForm(spec([scale(1)], null, { instructions: "En [Clínica]" }), "Aurora").instructions).toBe("En Aurora");
  });
});
