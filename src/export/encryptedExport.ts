// Copias cifradas con contraseña (Ajustes → Copias y exportar): el .zip de «Descargar todo» o la copia .sqlite3 van
// dentro de un archivo .omniclin que solo se abre con su contraseña («Abrir una copia cifrada», también sin cuenta
// desde la pantalla de entrada: OpenEncrypted.tsx). Mismo esquema que la copia de la nube (src/cloud/crypt.ts:
// PBKDF2-SHA-256 con 600 000 vueltas y AES-GCM de 256 bits), con marca propia:
//   OMNIEXP1 · sal (16) · IV (12) · largo del nombre (1) · nombre del archivo de dentro (UTF-8) · datos cifrados.
// El nombre va autenticado (dato adicional de AES-GCM): si alguien lo cambia, la copia no abre. Sin comprimir: el
// .zip ya lo va. No es un .zip con contraseña estándar (AE-2): WebCrypto no hace su modo de contador, y haría falta
// una implementación de AES a mano o una dependencia; si hace falta uno, se hace con 7-Zip sobre la copia sin cifrar.
import { deriveKey, MIN_PASSWORD, newSalt, WrongPassword } from "../cloud/crypt";

export const EXPORT_EXTENSION = ".omniclin";
const MAGIC = new TextEncoder().encode("OMNIEXP1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Si estos bytes son una copia cifrada de OmniClin (.omniclin). */
export const isEncryptedExport = (bytes: Uint8Array) => bytes.byteLength > MAGIC.length + SALT_BYTES + IV_BYTES + 1 && MAGIC.every((b, i) => bytes[i] === b);

/** El nombre del archivo cifrado a partir del de dentro: «OmniClin-Fisiolab-2026-10-30.zip» → «…-2026-10-30-cifrado.omniclin». */
export const encryptedName = (inner: string) => `${inner.replace(/\.[^.]+$/, "")}-cifrado${EXPORT_EXTENSION}`;

export function checkExportPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD) return `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  if (password !== repeat) return "Las dos contraseñas no coinciden.";
  return null;
}

/** Cifra `bytes` (el archivo `innerName`) con la contraseña. */
export async function encryptExport(bytes: Uint8Array, innerName: string, password: string): Promise<Uint8Array> {
  if (password.length < MIN_PASSWORD) throw new Error(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
  const name = new TextEncoder().encode(innerName);
  if (name.byteLength === 0 || name.byteLength > 255) throw new Error("El nombre del archivo es demasiado largo.");
  const salt = newSalt();
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: name as BufferSource }, key, bytes as BufferSource));
  const out = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES + 1 + name.byteLength + data.byteLength);
  let at = 0;
  for (const part of [MAGIC, unb64(salt), iv, new Uint8Array([name.byteLength]), name, data]) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

/** El nombre del archivo de dentro, sin abrirla (para decir qué se va a descargar). */
export function encryptedInnerName(bytes: Uint8Array): string | null {
  if (!isEncryptedExport(bytes)) return null;
  const at = MAGIC.length + SALT_BYTES + IV_BYTES;
  const len = bytes[at]!;
  return new TextDecoder().decode(bytes.slice(at + 1, at + 1 + len));
}

/** Abre una copia cifrada: el archivo de dentro con su nombre. Lanza WrongPassword si la contraseña no es la suya. */
export async function decryptExport(bytes: Uint8Array, password: string): Promise<{ name: string; bytes: Uint8Array }> {
  if (!isEncryptedExport(bytes)) throw new Error("Este archivo no es una copia cifrada de OmniClin (.omniclin).");
  const salt = b64(bytes.slice(MAGIC.length, MAGIC.length + SALT_BYTES));
  const iv = bytes.slice(MAGIC.length + SALT_BYTES, MAGIC.length + SALT_BYTES + IV_BYTES);
  const at = MAGIC.length + SALT_BYTES + IV_BYTES;
  const len = bytes[at]!;
  const name = bytes.slice(at + 1, at + 1 + len);
  const key = await deriveKey(password, salt);
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: name as BufferSource }, key, bytes.slice(at + 1 + len)));
    return { name: new TextDecoder().decode(name), bytes: plain };
  } catch {
    throw new WrongPassword();
  }
}
