// Cifrado de la copia de la nube (Google Drive o el servidor de la clínica) con una contraseña (src/cloud/README.md).
// La base se cifra en el dispositivo antes de subirla (AES-GCM de 256 bits, clave sacada de la contraseña con
// PBKDF2-SHA-256): en la nube solo hay bytes que sin la contraseña no se pueden leer. La copia en el dispositivo no se
// cifra (la protege el bloqueo del propio dispositivo).
//
// Archivo cifrado: «CENITENC1» + sal (16 bytes) + vector de inicio (12 bytes) + datos cifrados. Lo cifrado es la base
// comprimida con gzip (ocupa unas ocho veces menos); una copia antigua, sin comprimir, se sigue abriendo (una base de
// SQLite empieza por «SQLite format 3», no por la marca de gzip).
// Por trozos (la copia de una clínica en el almacén de archivos, desde el 27-10-2026): «CENITENC2» + sal (16 bytes) y
// después trozos de la base comprimida, cada uno con su longitud (4 bytes), su vector de inicio y su cifrado; cada
// trozo lleva autenticados su número y si es el último, así no se pueden cambiar de orden, quitar ni cortar. Se cifra
// y se sube trozo a trozo, sin tener la copia entera en memoria dos veces.
// Cada dispositivo guarda la clave (no la contraseña) de cada cuenta para no pedirla cada vez, en IndexedDB y marcada
// como no exportable: la app puede usarla, pero ni un script ni quien copie los datos del navegador puede leerla. El
// ajuste sincronizado ENCRYPTION_KEY lleva la sal: así todos los dispositivos de la cuenta saben con qué se cifró.

/** Ajuste sincronizado: { salt } si la copia de Drive va cifrada; null o sin la fila, si no. */
export const ENCRYPTION_KEY = "drive_encryption";
export type EncryptionSetting = { salt: string } | null;

const MAGIC = new TextEncoder().encode("CENITENC1");
const MAGIC2 = new TextEncoder().encode("CENITENC2");
/** Lo que se cifra en cada trozo (de la base ya comprimida). */
const PIECE_BYTES = 4 * 1024 * 1024;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ITERATIONS = 600_000; // lo que recomienda OWASP para PBKDF2-SHA-256
export const MIN_PASSWORD = 10;

/** La contraseña no abre la copia (o la copia está dañada). */
export class WrongPassword extends Error {
  constructor() {
    super("La contraseña no es correcta.");
  }
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));

const startsWith = (bytes: Uint8Array, magic: Uint8Array) => bytes.byteLength > magic.length && magic.every((b, i) => bytes[i] === b);

/** Una copia cifrada (de una pieza o por trozos). */
export function isEncrypted(bytes: Uint8Array): boolean {
  return startsWith(bytes, MAGIC) || startsWith(bytes, MAGIC2);
}

/** La sal con la que se cifró una copia. */
/** Si va cifrada por trozos (encryptPieces): así se sube a R2. */
export const isPieces = (bytes: Uint8Array) => startsWith(bytes, MAGIC2);

export const saltOf = (bytes: Uint8Array) => b64(bytes.slice(MAGIC.length, MAGIC.length + SALT_BYTES));

export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt) as BufferSource, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}
const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b;

export async function encrypt(bytes: Uint8Array, key: CryptoKey, salt: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const packed = await through(bytes, new CompressionStream("gzip"));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed as BufferSource));
  const out = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES + data.byteLength);
  out.set(MAGIC, 0);
  out.set(unb64(salt), MAGIC.length);
  out.set(iv, MAGIC.length + SALT_BYTES);
  out.set(data, MAGIC.length + SALT_BYTES + IV_BYTES);
  return out;
}

/** Lo autenticado de cada trozo: su número y si es el último. */
function pieceTag(index: number, last: boolean): Uint8Array {
  const tag = new Uint8Array(5);
  new DataView(tag.buffer).setUint32(0, index);
  tag[4] = last ? 1 : 0;
  return tag;
}

/**
 * Cifra por trozos (CENITENC2): primero la cabecera, después cada trozo según sale de la compresión. Quien lo recibe
 * puede ir subiéndolos sin juntar la copia entera. La base no se copia: se lee por partes.
 */
export async function* encryptPieces(bytes: Uint8Array, key: CryptoKey, salt: string): AsyncGenerator<Uint8Array> {
  const head = new Uint8Array(MAGIC2.length + SALT_BYTES);
  head.set(MAGIC2, 0);
  head.set(unb64(salt), MAGIC2.length);
  yield head;
  let offset = 0;
  const source = new ReadableStream<BufferSource>({
    pull(c) {
      if (offset >= bytes.byteLength) return c.close();
      c.enqueue(bytes.slice(offset, offset + 1024 * 1024));
      offset += 1024 * 1024;
    },
  });
  const reader = source.pipeThrough(new CompressionStream("gzip")).getReader();
  let buffered: Uint8Array[] = [];
  let size = 0;
  let index = 0;
  const seal = async (plain: Uint8Array, last: boolean) => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: pieceTag(index++, last) as BufferSource }, key, plain as BufferSource));
    const out = new Uint8Array(4 + IV_BYTES + data.byteLength);
    new DataView(out.buffer).setUint32(0, data.byteLength);
    out.set(iv, 4);
    out.set(data, 4 + IV_BYTES);
    return out;
  };
  const take = (n: number) => {
    const out = new Uint8Array(n);
    let at = 0;
    while (at < n) {
      const first = buffered[0]!;
      const k = Math.min(first.byteLength, n - at);
      out.set(first.subarray(0, k), at);
      at += k;
      if (k === first.byteLength) buffered.shift();
      else buffered[0] = first.subarray(k);
    }
    size -= n;
    return out;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered.push(value);
    size += value.byteLength;
    // Se deja siempre algo sin cifrar hasta el final: el último trozo tiene que saber que es el último.
    while (size > PIECE_BYTES) yield await seal(take(PIECE_BYTES), false);
  }
  yield await seal(take(size), true);
  buffered = [];
}

/** Junta lo que da encryptPieces (para guardarlo de una vez, p. ej. en las pruebas). */
export async function encryptToPieces(bytes: Uint8Array, key: CryptoKey, salt: string): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const p of encryptPieces(bytes, key, salt)) parts.push(p);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/** Descifra una copia por trozos: cada trozo, en orden, a la descompresión. WrongPassword si no abre o está cortada. */
async function decryptPieces(bytes: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const unzip = new DecompressionStream("gzip");
  const writer = unzip.writable.getWriter();
  const result = new Response(unzip.readable).arrayBuffer();
  let at = MAGIC2.length + SALT_BYTES;
  let index = 0;
  let last = false;
  try {
    while (!last) {
      if (at + 4 + IV_BYTES > bytes.byteLength) throw new WrongPassword(); // cortada: falta el último trozo
      const length = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0);
      const iv = bytes.slice(at + 4, at + 4 + IV_BYTES);
      const data = bytes.subarray(at + 4 + IV_BYTES, at + 4 + IV_BYTES + length);
      if (data.byteLength !== length) throw new WrongPassword();
      at += 4 + IV_BYTES + length;
      last = at === bytes.byteLength;
      let plain: ArrayBuffer;
      try {
        plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: pieceTag(index++, last) as BufferSource }, key, data as BufferSource);
      } catch {
        throw new WrongPassword();
      }
      await writer.write(new Uint8Array(plain));
    }
    await writer.close();
  } catch (e) {
    await writer.abort(e).catch(() => {});
    await result.catch(() => {});
    throw e;
  }
  return new Uint8Array(await result);
}

export async function decrypt(bytes: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  if (startsWith(bytes, MAGIC2)) return decryptPieces(bytes, key);
  const start = MAGIC.length + SALT_BYTES;
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(start, start + IV_BYTES) }, key, bytes.slice(start + IV_BYTES)));
  } catch {
    throw new WrongPassword();
  }
  return isGzip(plain) ? through(plain, new DecompressionStream("gzip")) : plain;
}

// ---------- La clave en este dispositivo ----------

export type StoredKey = { salt: string; key: CryptoKey };
const legacyName = (sub: string) => `fisiolab.crypt.${sub}`;

/** Sin IndexedDB (pruebas en Node), la clave solo vive mientras dure la página. */
const memory = new Map<string, StoredKey>();
const deviceMemory = new Map<string, unknown>();
let keysDb: Promise<IDBDatabase> | null = null;

/** La base «fisiolab-claves»: las claves (almacén «claves») y, desde la versión 2, el almacén «pin» (src/privacy). */
function openKeys(): Promise<IDBDatabase> {
  keysDb ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("fisiolab-claves", 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("claves")) req.result.createObjectStore("claves");
      if (!req.result.objectStoreNames.contains("pin")) req.result.createObjectStore("pin");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return keysDb;
}

async function keysStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>, name: "claves" | "pin" = "claves"): Promise<T> {
  const db = await openKeys();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(name, mode).objectStore(name));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const hasIdb = () => typeof indexedDB !== "undefined";

/**
 * Un pequeño almacén del dispositivo en IndexedDB (almacén «pin»), para lo del bloqueo que no debe reiniciarse
 * borrando solo localStorage (src/privacy/pin.ts: el contador de fallos, y que en este dispositivo se puso un PIN).
 */
export async function deviceGet<T>(key: string): Promise<T | undefined> {
  if (!hasIdb()) return deviceMemory.get(key) as T | undefined;
  try {
    return await keysStore<T | undefined>("readonly", (s) => s.get(key), "pin");
  } catch {
    return undefined;
  }
}
export async function devicePut(key: string, value: unknown): Promise<void> {
  if (!hasIdb()) {
    deviceMemory.set(key, value);
    return;
  }
  try {
    await keysStore("readwrite", (s) => s.put(value, key), "pin");
  } catch {
    /* sin IndexedDB: queda lo de localStorage */
  }
}
export async function deviceDelete(key: string): Promise<void> {
  deviceMemory.delete(key);
  if (!hasIdb()) return;
  try {
    await keysStore("readwrite", (s) => s.delete(key), "pin");
  } catch {
    /* nada */
  }
}

/** Si `candidate` es la misma clave que `stored` (sin exportarlas): se cifra algo al azar con una y se abre con la otra. */
export async function sameKey(stored: CryptoKey, candidate: CryptoKey): Promise<boolean> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const probe = crypto.getRandomValues(new Uint8Array(32));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, stored, probe as BufferSource);
  try {
    const opened = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, candidate, sealed));
    return opened.length === probe.length && opened.every((b, i) => b === probe[i]);
  } catch {
    return false;
  }
}

export async function storedKey(sub: string): Promise<StoredKey | null> {
  try {
    if (!hasIdb()) return memory.get(sub) ?? null;
    const found = await keysStore<StoredKey | undefined>("readonly", (s) => s.get(sub));
    if (found) return found;
    // Versiones anteriores la guardaban exportada en localStorage: se pasa a IndexedDB sin exportar y se borra.
    const old = JSON.parse(localStorage.getItem(legacyName(sub)) ?? "null") as { salt: string; key: string } | null;
    if (!old) return null;
    const key = await crypto.subtle.importKey("raw", unb64(old.key) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
    await storeKey(sub, old.salt, key);
    return { salt: old.salt, key };
  } catch {
    return null;
  }
}

export async function storeKey(sub: string, salt: string, key: CryptoKey): Promise<void> {
  if (!hasIdb()) {
    memory.set(sub, { salt, key });
    return;
  }
  await keysStore("readwrite", (s) => s.put({ salt, key } satisfies StoredKey, sub));
  localStorage.removeItem(legacyName(sub));
}

export async function forgetKey(sub: string): Promise<void> {
  memory.delete(sub);
  if (typeof localStorage !== "undefined") localStorage.removeItem(legacyName(sub));
  if (hasIdb()) await keysStore("readwrite", (s) => s.delete(sub));
}

// ---------- Código de recuperación (clínicas) ----------
// La clave de la copia se puede abrir también con un código de recuperación que solo tiene la clínica (impreso en
// su «kit de recuperación»). En el servidor se guarda la clave cerrada con ese código: sin él no sirve de nada,
// tampoco a quien gestiona el servidor. Con él, quien administra la clínica recupera la copia aunque haya perdido la
// contraseña y todos los dispositivos.

/** Letras y números sin los que se confunden (Crockford: sin I, L, O ni U). */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Un código nuevo: 20 caracteres (100 bits) en cuatro grupos, «7K2M9-…». */
export function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % 32]).join("");
  return chars.match(/.{5}/g)!.join("-");
}

/** El código tal como lo escriba la persona: sin espacios ni guiones, en mayúsculas, O → 0, I/L → 1. */
const normalCode = (code: string) =>
  code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

/** La clave de la contraseña como bytes (para cerrarla con el código) y lista para usar. Igual que deriveKey. */
export async function deriveKeyBytes(password: string, salt: string): Promise<{ key: CryptoKey; raw: Uint8Array }> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt) as BufferSource, iterations: ITERATIONS }, base, 256));
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, raw };
}

async function codeKey(code: string, rsalt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalCode(code)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: rsalt as BufferSource, iterations: ITERATIONS }, base, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** La clave de la copia (de la sal `salt`) cerrada con el código: lo que se guarda en el servidor. */
export async function sealForRecovery(raw: Uint8Array, salt: string, code: string): Promise<string> {
  const rsalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await codeKey(code, rsalt), raw as BufferSource));
  return JSON.stringify({ v: 1, salt, rsalt: b64(rsalt), iv: b64(iv), key: b64(sealed) });
}

/** Abre con el código lo guardado en el servidor: la clave de la copia y su sal. WrongPassword si el código no vale. */
export async function openWithCode(blob: string, code: string): Promise<StoredKey> {
  const r = JSON.parse(blob) as { v: number; salt: string; rsalt: string; iv: string; key: string };
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) as BufferSource }, await codeKey(code, unb64(r.rsalt)), unb64(r.key) as BufferSource));
  } catch {
    throw new WrongPassword();
  }
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { salt: r.salt, key };
}
