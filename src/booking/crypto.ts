// Cifrado de las reservas: el paciente no tiene clave compartida con la clínica (no hay enlace previo), así que se usa
// la clave PÚBLICA de la clínica. Su navegador crea una clave de un solo uso, saca con ella y la pública un secreto
// (ECDH P-256), y cifra sus datos con AES-GCM. Solo la clínica, con su clave privada (guardada en su base cifrada),
// puede abrirlo. El servidor ve bytes. Todo con la Web Crypto del navegador, sin bibliotecas.

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
export const url64 = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const CURVE = { name: "ECDH", namedCurve: "P-256" } as const;

export type BookingKeys = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

/** Las claves de la reserva online de una clínica: la pública va al servidor; la privada, a la base de la clínica. */
export async function newBookingKeys(): Promise<BookingKeys> {
  const pair = (await crypto.subtle.generateKey(CURVE, true, ["deriveKey"])) as CryptoKeyPair;
  return { publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey), privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
}

async function aesFrom(privateKey: CryptoKey, publicKey: CryptoKey, usage: KeyUsage) {
  return crypto.subtle.deriveKey({ name: "ECDH", public: publicKey }, privateKey, { name: "AES-GCM", length: 256 }, false, [usage]);
}

/** En el móvil del paciente: cifra sus datos para la clínica. Devuelve texto («CB1.<clave de un uso>.<iv>.<datos>»). */
export async function sealForClinic(publicJwk: JsonWebKey, data: unknown): Promise<string> {
  const clinic = await crypto.subtle.importKey("jwk", publicJwk, CURVE, false, []);
  const once = (await crypto.subtle.generateKey(CURVE, true, ["deriveKey"])) as CryptoKeyPair;
  const key = await aesFrom(once.privateKey, clinic, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))));
  const eph = new Uint8Array(await crypto.subtle.exportKey("raw", once.publicKey));
  return `CB1.${b64(eph)}.${b64(iv)}.${b64(ct)}`;
}

/** En la clínica: abre lo que mandó el paciente. Lanza un error si no es para esta clínica o está alterado. */
export async function openFromPatient<T>(privateJwk: JsonWebKey, blob: string): Promise<T> {
  const [tag, eph, iv, ct] = blob.split(".");
  if (tag !== "CB1" || !eph || !iv || !ct) throw new Error("La reserva no tiene el formato esperado.");
  const mine = await crypto.subtle.importKey("jwk", privateJwk, CURVE, false, ["deriveKey"]);
  const theirs = await crypto.subtle.importKey("raw", unb64(eph) as BufferSource, CURVE, false, []);
  const key = await aesFrom(mine, theirs, "decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, key, unb64(ct) as BufferSource);
  return JSON.parse(dec.decode(plain)) as T;
}

/** Un código al azar para el enlace de anular (va en el enlace; el servidor solo guarda su huella). */
export const newCancelToken = () => url64(crypto.getRandomValues(new Uint8Array(18)));

/** La huella del código (SHA-256 en hexadecimal): lo único que guarda el servidor. */
export async function tokenHash(token: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}
