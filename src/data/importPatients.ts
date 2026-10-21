// Traer pacientes de otro programa: un Excel (.xlsx) o un CSV (lo que casi todos los programas saben exportar).
// Se lee la tabla, se adivina qué es cada columna por su título (se puede cambiar), se comprueba cada valor y se
// crean los pacientes de una vez. Nada se pierde: las columnas que no tienen sitio en la ficha van a sus notas.
// Los que ya existen (mismo nombre) se saltan, salvo que se pida lo contrario. La última importación se puede deshacer.
import { fold } from "../app/format";
import type { Db } from "./db";
import type { Statement } from "./protocol";
import { getSetting, setSetting, type PatientInput, type Sex } from "./repo";
import { readXlsx } from "./xlsx";

export type Field = "name" | "lastName" | "birthDate" | "sex" | "phone" | "email" | "address" | "notes" | "bodyMassKg" | "heightCm" | "ignore";

export const FIELD_LABELS: Record<Field, string> = {
  name: "Nombre",
  lastName: "Apellidos",
  birthDate: "Fecha de nacimiento",
  sex: "Sexo",
  phone: "Teléfono",
  email: "Correo electrónico",
  address: "Dirección",
  notes: "Notas",
  bodyMassKg: "Peso (kg)",
  heightCm: "Altura (cm)",
  ignore: "No importar",
};

/** Como mucho, tantas filas por archivo. */
export const MAX_ROWS = 20_000;

// ---------- Leer el archivo ----------

/**
 * La tabla de un archivo: .xlsx o texto separado por comas, punto y coma o tabuladores (lo detecta). Un CSV de Excel
 * en Windows suele venir en Windows-1252, no en UTF-8: también se lee bien.
 */
export async function readTable(bytes: Uint8Array, fileName: string): Promise<string[][]> {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || /\.xlsx$/i.test(fileName)) {
    if (!isZip) throw new Error("El archivo no es un Excel (.xlsx) válido.");
    return trimTable(await readXlsx(bytes));
  }
  if (/\.xls$/i.test(fileName)) throw new Error("Es un Excel antiguo (.xls). Ábrelo en Excel y guárdalo como .xlsx o como CSV.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return trimTable(parseCsv(text.replace(/^﻿/, "")));
}

/** Quita las filas vacías y los espacios de los bordes. */
function trimTable(rows: string[][]): string[][] {
  return rows.map((r) => r.map((c) => (c ?? "").trim())).filter((r) => r.some((c) => c !== ""));
}

/** Texto separado por comas, punto y coma o tabuladores (el que más aparece en la primera línea), con comillas. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0]!.s;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---------- Qué es cada columna ----------

const GUESSES: [Field, RegExp][] = [
  ["lastName", /apellido|surname|last ?name/],
  ["birthDate", /nacimiento|f\.? ?nac|fecha de nac|birth|cumple/],
  ["sex", /^(sexo|genero|sex|gender)$/],
  ["phone", /tel|movil|celular|phone|mobile|whatsapp/],
  ["email", /e-?mail|correo/],
  ["address", /direcc|domicilio|address|calle|poblacion|localidad|ciudad|provincia|codigo postal|^c\.? ?p\.?$/],
  ["notes", /nota|observ|comentario|antecedente/],
  ["bodyMassKg", /^peso|weight/],
  ["heightCm", /altura|talla|estatura|height/],
  ["name", /nombre|paciente|name|cliente/],
];

/** Lo que parece cada columna por su título. Lo que no se reconoce, a las notas (no se pierde nada). */
export function guessFields(headers: string[]): Field[] {
  return headers.map((h) => {
    const t = fold(h).trim();
    if (!t) return "ignore";
    return GUESSES.find(([, re]) => re.test(t))?.[0] ?? "notes";
  });
}

// ---------- Cada valor ----------

/** «12/03/1985», «12-3-85», «1985-03-12» o un número de serie de Excel → «1985-03-12». null si no es una fecha que valga. */
export function parseDate(value: string, today = new Date()): string | null {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(v))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?: .*)?$/.exec(v))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (match[3]!.length === 2) y += y > today.getFullYear() % 100 ? 1900 : 2000;
  } else if (/^\d{4,5}(\.\d+)?$/.test(v)) {
    // Número de serie de Excel (fecha guardada como número).
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || date.getTime() > today.getTime()) return null;
  return date.toISOString().slice(0, 10);
}

export function parseSex(value: string): Sex | null {
  const v = fold(value).trim().replace(/\.$/, "");
  if (!v) return null;
  if (/^(m|mujer|f|femenino|female|woman|fem)$/.test(v)) return "female";
  if (/^(h|v|hombre|varon|masculino|male|man|masc)$/.test(v)) return "male";
  if (/^(otro|other|x|no binario)$/.test(v)) return "other";
  return null;
}

/** «70,5», «70.5 kg» → 70.5; null si no es un número. */
export function parseNumber(value: string): number | null {
  const v = value.trim().replace(/\s*(kg|cm|m)$/i, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

// ---------- De la tabla a los pacientes ----------

export type ImportRow = { input: PatientInput; line: number; duplicate: boolean };
export type ImportPlan = {
  rows: ImportRow[];
  /** Filas sin nombre: no se importan. */
  noName: number[];
  /** Valores que no se han podido usar (fecha, sexo, peso o altura): la línea y lo que había. Van a las notas. */
  fixes: { line: number; field: Field; value: string }[];
};

const RANGES: Partial<Record<Field, [number, number]>> = { bodyMassKg: [10, 300], heightCm: [50, 250] };

/**
 * Los pacientes de la tabla según qué es cada columna. `headerRow`: la primera fila son los títulos. `existing`:
 * los nombres que ya hay (para no duplicarlos).
 */
export function planImport(table: string[][], fields: Field[], { headerRow = true, existing = [] as string[] } = {}): ImportPlan {
  const headers = headerRow ? (table[0] ?? []) : [];
  const body = (headerRow ? table.slice(1) : table).slice(0, MAX_ROWS);
  const seen = new Set(existing.map((n) => fold(n).replace(/\s+/g, " ").trim()));
  const plan: ImportPlan = { rows: [], noName: [], fixes: [] };
  body.forEach((cells, i) => {
    const line = i + (headerRow ? 2 : 1);
    const pick = (f: Field) => fields.flatMap((field, c) => (field === f && cells[c]?.trim() ? [cells[c]!.trim()] : []));
    const label = (c: number) => headers[c]?.trim() || `Columna ${c + 1}`;
    const name = [...pick("name"), ...pick("lastName")].join(" ").replace(/\s+/g, " ").trim();
    if (!name) {
      plan.noName.push(line);
      return;
    }
    const notes = fields.flatMap((f, c) => (f === "notes" && cells[c]?.trim() ? [`${label(c)}: ${cells[c]!.trim()}`] : []));
    const fix = (field: Field, value: string) => {
      plan.fixes.push({ line, field, value });
      notes.push(`${FIELD_LABELS[field]} (sin reconocer): ${value}`);
    };
    const birthRaw = pick("birthDate")[0] ?? "";
    const birthDate = parseDate(birthRaw);
    if (birthRaw && !birthDate) fix("birthDate", birthRaw);
    const sexRaw = pick("sex")[0] ?? "";
    const sex = parseSex(sexRaw);
    if (sexRaw && !sex) fix("sex", sexRaw);
    const measure = (field: "bodyMassKg" | "heightCm") => {
      const raw = pick(field)[0] ?? "";
      let n = raw ? parseNumber(raw) : null;
      if (n !== null && field === "heightCm" && n < 3) n = Math.round(n * 100); // en metros
      const [lo, hi] = RANGES[field]!;
      if (raw && (n === null || n < lo || n > hi)) {
        fix(field, raw);
        return null;
      }
      return n;
    };
    const bodyMassKg = measure("bodyMassKg");
    const heightCm = measure("heightCm");
    const key = fold(name).replace(/\s+/g, " ").trim();
    const duplicate = seen.has(key);
    seen.add(key);
    plan.rows.push({
      line,
      duplicate,
      input: {
        name,
        birthDate,
        sex,
        bodyMassKg,
        heightCm,
        legLengthCm: null,
        pushOffDistanceCm: null,
        notes: notes.join("\n"),
        phone: pick("phone").join(" / "),
        email: (pick("email")[0] ?? "").toLowerCase(),
        address: pick("address").join(", "),
      },
    });
  });
  return plan;
}

// ---------- Guardar ----------

/** La última importación, para poder deshacerla (ajuste sincronizado: se ve en todos los dispositivos). */
export const LAST_IMPORT = "last_import";
export type LastImport = { at: string; file: string; ids: string[] };

/** Crea los pacientes de una vez (por tandas). Devuelve sus ids y apunta la importación para poder deshacerla. */
export async function importPatients(db: Db, inputs: PatientInput[], file: string): Promise<string[]> {
  const ids: string[] = [];
  const t = new Date().toISOString();
  const statements: Statement[] = inputs.map((p) => {
    const id = crypto.randomUUID();
    ids.push(id);
    return {
      sql: `insert into patients (name, birth_date, sex, body_mass_kg, height_cm, leg_length_cm, pushoff_distance_cm, notes, phone, email, address, id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [p.name.trim(), p.birthDate, p.sex, p.bodyMassKg, p.heightCm, null, null, p.notes, p.phone ?? "", p.email ?? "", p.address ?? "", id, t, t],
    };
  });
  for (let i = 0; i < statements.length; i += 500) await db.transaction(statements.slice(i, i + 500));
  await setSetting(db, LAST_IMPORT, { at: t, file, ids } satisfies LastImport);
  return ids;
}

/** Deshace la última importación: borra los pacientes que creó y siguen ahí (con lo que se les haya añadido). Cuántos. */
export async function undoLastImport(db: Db): Promise<number> {
  const last = await getSetting<LastImport>(db, LAST_IMPORT);
  if (!last) return 0;
  const ids = JSON.stringify(last.ids);
  const [row] = await db.query<{ n: number }>("select count(*) as n from patients where id in (select value from json_each(?))", [ids]);
  await db.transaction([
    { sql: "delete from patients where id in (select value from json_each(?))", bind: [ids] },
    { sql: "delete from settings where key = ?", bind: [LAST_IMPORT] },
  ]);
  return row?.n ?? 0;
}
