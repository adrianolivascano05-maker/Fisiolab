import { describe, expect, it } from "vitest";
import { guessFields, importPatients, LAST_IMPORT, parseCsv, parseDate, parseNumber, parseSex, planImport, readTable, undoLastImport } from "./importPatients";
import { createPatient, getSetting, listPatients } from "./repo";
import { createTestDb } from "./testDb";

const enc = (s: string) => new TextEncoder().encode(s);

/** Un .xlsx mínimo (zip con la hoja y los textos compartidos), con o sin compresión. */
async function xlsx(rows: (string | number)[][], deflate = true): Promise<Uint8Array> {
  const shared: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) => {
            if (v === "") return "";
            if (typeof v === "number") return `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>`;
            shared.push(v);
            return `<c r="${col(ci)}${ri + 1}" t="s"><v>${shared.length - 1}</v></c>`;
          })
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
  const files: [string, string][] = [
    ["xl/workbook.xml", `<workbook><sheets><sheet name="Pacientes" sheetId="1" r:id="rId7"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId7" Type="ws" Target="worksheets/hoja.xml"/></Relationships>`],
    ["xl/sharedStrings.xml", `<sst>${shared.map((s, i) => (i === 0 ? `<si><r><t>${esc(s.slice(0, 2))}</t></r><r><t>${esc(s.slice(2))}</t></r></si>` : `<si><t>${esc(s)}</t></si>`)).join("")}</sst>`],
    ["xl/worksheets/hoja.xml", sheet],
  ];
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const raw = enc(text);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()) : raw;
    const n = enc(name);
    const local = new Uint8Array(30 + n.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(8, deflate ? 8 : 0, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, raw.length, true);
    dv.setUint16(26, n.length, true);
    local.set(n, 30);
    const cd = new Uint8Array(46 + n.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    cd.set(n, 46);
    parts.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("leer el archivo", () => {
  it("CSV con punto y coma (Excel en español), comillas, saltos de línea y BOM", async () => {
    const text = '﻿Nombre;Apellidos;Observaciones\r\nAna;"Ruiz; López";"Dos\nlíneas"\r\n;;\r\nLuis;"Pérez ""el rápido""";\r\n';
    expect(await readTable(enc(text), "pacientes.csv")).toEqual([
      ["Nombre", "Apellidos", "Observaciones"],
      ["Ana", "Ruiz; López", "Dos\nlíneas"],
      ["Luis", 'Pérez "el rápido"', ""],
    ]);
  });

  it("CSV con comas o tabuladores; y uno de Windows (no UTF-8) con tildes", async () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    const latin1 = Uint8Array.from([...("Nombre;Dirección\nMaría;Calle Ñandú").split("").map((c) => c.charCodeAt(0))]);
    expect(await readTable(latin1, "x.csv")).toEqual([["Nombre", "Dirección"], ["María", "Calle Ñandú"]]);
  });

  it("Excel (.xlsx), comprimido o no, con la hoja que diga el libro, textos con formato y celdas vacías", async () => {
    const rows = [["Nombre", "Fecha de nacimiento", "Teléfono"], ["Ana & Co", 31121, "612 345 678"], ["Luis", "", 699000111]];
    for (const deflate of [true, false]) {
      expect(await readTable(await xlsx(rows, deflate), "pacientes.xlsx")).toEqual([
        ["Nombre", "Fecha de nacimiento", "Teléfono"],
        ["Ana & Co", "31121", "612 345 678"],
        ["Luis", "", "699000111"],
      ]);
    }
  });

  it("lo que no se puede leer lo dice", async () => {
    await expect(readTable(enc("hola"), "viejo.xls")).rejects.toThrow(/guárdalo como \.xlsx o como CSV/);
    await expect(readTable(enc("no es un zip"), "roto.xlsx")).rejects.toThrow(/no es un Excel/);
  });
});

describe("cada valor", () => {
  const today = new Date("2026-10-21T12:00:00Z");
  it("fechas en los formatos de siempre, y el número de serie de Excel", () => {
    expect(parseDate("12/03/1985", today)).toBe("1985-03-12");
    expect(parseDate("1-2-1990", today)).toBe("1990-02-01");
    expect(parseDate("12.03.85", today)).toBe("1985-03-12");
    expect(parseDate("05/06/12", today)).toBe("2012-06-05");
    expect(parseDate("1985-03-12", today)).toBe("1985-03-12");
    expect(parseDate("1985-03-12 00:00:00", today)).toBe("1985-03-12");
    expect(parseDate("31121", today)).toBe("1985-03-15");
    for (const bad of ["31/02/1990", "12/13/1990", "2030-01-01", "ayer", "1850-01-01"]) expect(parseDate(bad, today), bad).toBeNull();
  });
  it("sexo, números con coma y unidades", () => {
    expect(["M", "mujer", "F", "Femenino"].map(parseSex)).toEqual(["female", "female", "female", "female"]);
    expect(["H", "hombre", "Varón", "masc."].map(parseSex)).toEqual(["male", "male", "male", "male"]);
    expect(parseSex("¿?")).toBeNull();
    expect(parseNumber("70,5")).toBe(70.5);
    expect(parseNumber("70.5 kg")).toBe(70.5);
    expect(parseNumber("mucho")).toBeNull();
  });
});

describe("de la tabla a los pacientes", () => {
  it("adivina las columnas por su título; lo que no reconoce va a las notas", () => {
    expect(guessFields(["Nombre", "Apellidos", "F. Nac.", "Sexo", "Móvil", "E-mail", "Domicilio", "Población", "Observaciones", "Peso", "Talla", "DNI", ""])).toEqual([
      "name",
      "lastName",
      "birthDate",
      "sex",
      "phone",
      "email",
      "address",
      "address",
      "notes",
      "bodyMassKg",
      "heightCm",
      "dni",
      "ignore",
    ]);
  });

  it("junta nombre y apellidos, comprueba cada valor y no pierde nada", () => {
    const table = [
      ["Nombre", "Apellidos", "F. Nac.", "Sexo", "Móvil", "Domicilio", "Población", "DNI", "Peso", "Talla"],
      ["Ana", "Ruiz López", "12/03/1985", "M", "612345678", "Calle Mayor 3", "Sevilla", "12345678Z", "61,5", "1,68"],
      ["", "", "", "", "", "", "", "", "", ""],
      ["Luis", "", "31/02/1990", "?", "", "", "", "", "900", ""],
      ["  ana   ruiz lópez ", "", "", "", "", "", "", "", "", ""],
    ];
    const plan = planImport(table, guessFields(table[0]!), { existing: ["Luis"] });
    expect(plan.noName).toEqual([3]);
    expect(plan.rows.map((r) => [r.input.name, r.duplicate, r.line])).toEqual([
      ["Ana Ruiz López", false, 2],
      ["Luis", true, 4],
      ["ana ruiz lópez", true, 5],
    ]);
    expect(plan.rows[0]!.input).toMatchObject({
      birthDate: "1985-03-12",
      sex: "female",
      phone: "612345678",
      address: "Calle Mayor 3, Sevilla",
      bodyMassKg: 61.5,
      heightCm: 168,
      dni: "12345678Z",
      notes: "",
    });
    // Lo que no se reconoce no se pierde: va a las notas y se cuenta.
    expect(plan.rows[1]!.input).toMatchObject({ birthDate: null, sex: null, bodyMassKg: null });
    expect(plan.rows[1]!.input.notes).toBe("Fecha de nacimiento (sin reconocer): 31/02/1990\nSexo (sin reconocer): ?\nPeso (kg) (sin reconocer): 900");
    expect(plan.fixes.map((f) => `${f.line}:${f.field}`)).toEqual(["4:birthDate", "4:sex", "4:bodyMassKg"]);
  });

  it("sin fila de títulos", () => {
    const plan = planImport([["Ana Ruiz", "612"]], ["name", "phone"], { headerRow: false });
    expect(plan.rows[0]).toMatchObject({ line: 1, input: { name: "Ana Ruiz", phone: "612" } });
  });
});

describe("guardar y deshacer", () => {
  it("crea los pacientes de una vez y la última importación se puede deshacer", async () => {
    const db = await createTestDb();
    await createPatient(db, { name: "Ya Estaba", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
    const table = [["Nombre", "Teléfono"], ...Array.from({ length: 1200 }, (_, i) => [`Paciente ${i}`, `600${i}`])];
    const plan = planImport(table, guessFields(table[0]!));
    const ids = await importPatients(
      db,
      plan.rows.map((r) => r.input),
      "programa-viejo.csv",
    );
    expect(ids).toHaveLength(1200);
    expect(await listPatients(db)).toHaveLength(1201);
    expect(await getSetting(db, LAST_IMPORT)).toMatchObject({ file: "programa-viejo.csv", ids });
    expect(await undoLastImport(db)).toBe(1200);
    expect((await listPatients(db)).map((p) => p.name)).toEqual(["Ya Estaba"]);
    expect(await getSetting(db, LAST_IMPORT)).toBeNull();
    expect(await undoLastImport(db)).toBe(0);
  });
});
