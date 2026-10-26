// Cifrado de los archivos del paciente (src/data/documents.ts). Cada archivo lleva su propia clave al azar (AES-GCM de
// 256 bits), guardada solo en la base de la clínica, que viaja cifrada con la contraseña de la clínica: en el servidor
// solo hay bytes ilegibles. Los que sube el paciente van cifrados con la clave de su enlace (la del formulario), que
// también se queda en la base. Formato: «CENITDOC1» + vector de inicio (12 bytes) + datos cifrados.

const MAGIC = new TextEncoder().encode("CENITDOC1");
const IV_BYTES = 12;

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const url64 = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unurl64 = (t: string) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Una clave nueva para un archivo, en texto. */
export const newDocKey = () => url64(crypto.getRandomValues(new Uint8Array(32)));

const aesKey = (k: string) => crypto.subtle.importKey("raw", unurl64(k) as Uint8Array<ArrayBuffer>, "AES-GCM", false, ["encrypt", "decrypt"]);

/** Si los bytes son un archivo cifrado por la app. */
export const isSealedDoc = (bytes: Uint8Array) => bytes.byteLength > MAGIC.length + IV_BYTES && MAGIC.every((b, i) => bytes[i] === b);

export async function sealDoc(plain: Uint8Array, key: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key), plain as Uint8Array<ArrayBuffer>));
  const out = new Uint8Array(MAGIC.length + IV_BYTES + data.byteLength);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(data, MAGIC.length + IV_BYTES);
  return out;
}

/** Lo contrario de sealDoc. Lanza si no es un archivo cifrado o la clave no es la suya. */
export async function openDoc(sealed: Uint8Array, key: string): Promise<Uint8Array> {
  if (!isSealedDoc(sealed)) throw new Error("El archivo no está cifrado por la app.");
  const iv = sealed.slice(MAGIC.length, MAGIC.length + IV_BYTES);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(key), sealed.slice(MAGIC.length + IV_BYTES)));
  } catch {
    throw new Error("No se puede abrir el archivo: está dañado o no es de este paciente.");
  }
}
