// Cifrado de la copia de Google Drive con una contraseña (src/cloud/README.md). La base se cifra en el
// dispositivo antes de subirla (AES-GCM de 256 bits, clave sacada de la contraseña con PBKDF2-SHA-256): en Drive
// solo hay bytes que sin la contraseña no se pueden leer. La copia en el dispositivo no se cifra (la protege el
// bloqueo del propio dispositivo).
//
// Archivo cifrado: «CENITENC1» + sal (16 bytes) + vector de inicio (12 bytes) + datos cifrados. Lo cifrado es la base
// comprimida con gzip (ocupa unas ocho veces menos); una copia antigua, sin comprimir, se sigue abriendo (una base de
// SQLite empieza por «SQLite format 3», no por la marca de gzip).
// Cada dispositivo guarda la clave (no la contraseña) de cada cuenta para no pedirla cada vez. El ajuste
// sincronizado ENCRYPTION_KEY lleva la sal: así todos los dispositivos de la cuenta saben si hay que cifrar.

/** Ajuste sincronizado: { salt } si la copia de Drive va cifrada; null o sin la fila, si no. */
export const ENCRYPTION_KEY = "drive_encryption";
export type EncryptionSetting = { salt: string } | null;

const MAGIC = new TextEncoder().encode("CENITENC1");
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

export function isEncrypted(bytes: Uint8Array): boolean {
  return bytes.byteLength > MAGIC.length && MAGIC.every((b, i) => bytes[i] === b);
}

/** La sal con la que se cifró una copia. */
export const saltOf = (bytes: Uint8Array) => b64(bytes.slice(MAGIC.length, MAGIC.length + SALT_BYTES));

export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt) as BufferSource, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    true,
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

export async function decrypt(bytes: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
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
const keyName = (sub: string) => `fisiolab.crypt.${sub}`;

export async function storedKey(sub: string): Promise<StoredKey | null> {
  try {
    const s = JSON.parse(localStorage.getItem(keyName(sub)) ?? "null") as { salt: string; key: string } | null;
    if (!s) return null;
    return { salt: s.salt, key: await crypto.subtle.importKey("raw", unb64(s.key) as BufferSource, "AES-GCM", true, ["encrypt", "decrypt"]) };
  } catch {
    return null;
  }
}

export async function storeKey(sub: string, salt: string, key: CryptoKey) {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  localStorage.setItem(keyName(sub), JSON.stringify({ salt, key: b64(raw) }));
}

export function forgetKey(sub: string) {
  localStorage.removeItem(keyName(sub));
}
