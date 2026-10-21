// Lee la primera hoja de un Excel (.xlsx) como tabla de textos, sin librerías: un .xlsx es un zip con XML dentro.
// Basta para traer pacientes de otro programa (src/data/importPatients.ts); no lee fórmulas ni formatos, solo los
// valores que Excel guardó. Las fechas llegan como el número de serie de Excel (días desde 1899-12-30).

type Entry = { name: string; method: number; size: number; offset: number };

const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

/** Los archivos del zip, por nombre (sin descomprimir). */
function entries(zip: Uint8Array): Map<string, Entry> {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (u32(zip, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un Excel (.xlsx) válido.");
  const count = u16(zip, eocd + 10);
  let at = u32(zip, eocd + 16);
  const out = new Map<string, Entry>();
  for (let n = 0; n < count && u32(zip, at) === 0x02014b50; n++) {
    const nameLen = u16(zip, at + 28);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    out.set(name, { name, method: u16(zip, at + 10), size: u32(zip, at + 20), offset: u32(zip, at + 42) });
    at += 46 + nameLen + u16(zip, at + 30) + u16(zip, at + 32);
  }
  return out;
}

async function read(zip: Uint8Array, e: Entry): Promise<string> {
  const local = e.offset;
  if (u32(zip, local) !== 0x04034b50) throw new Error("El archivo Excel está dañado.");
  const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
  const data = zip.subarray(start, start + e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Este Excel usa una compresión que la app no sabe leer: guárdalo como CSV.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

/** Todos los archivos de un zip, descomprimidos. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const e of entries(bytes).values()) {
    const local = e.offset;
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const data = bytes.subarray(start, start + e.size);
    out.set(
      e.name,
      e.method === 0 ? data.slice() : new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()),
    );
  }
  return out;
}

const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]!;
  });

/** El texto de un elemento con trozos <t> (texto con formato: varios trozos seguidos). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]!)).join("");

/** «B7» → 1 (columna, desde 0). */
function columnOf(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** La primera hoja del libro, fila a fila. Las celdas vacías son "". */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = entries(bytes);
  const get = async (name: string) => {
    const e = files.get(name);
    return e ? read(bytes, e) : null;
  };
  const shared = [...((await get("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));

  // La primera hoja según el libro (no siempre es sheet1.xml).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  const firstId = workbook && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  if (firstId && rels) {
    const target = new RegExp(`<Relationship\\b[^>]*\\bId="${firstId}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1] ??
      new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${firstId}"`).exec(rels)?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = await get(sheetPath);
  if (sheet === null) throw new Error("No se encuentra la primera hoja del Excel.");

  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const index = Number(/\br="(\d+)"/.exec(r[1]!)?.[1] ?? rows.length + 1) - 1;
    const row: string[] = [];
    for (const c of r[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const body = c[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const col = ref ? columnOf(ref) : row.length;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "b") value = v === "1" ? "VERDADERO" : "FALSO";
      else if (v !== undefined) value = unescapeXml(v);
      while (row.length < col) row.push("");
      row[col] = value.trim();
    }
    while (rows.length < index) rows.push([]);
    rows[index] = row;
  }
  return rows;
}
