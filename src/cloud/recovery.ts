// Código de recuperación de la clínica (crypt.ts): crearlo al elegir o cambiar la contraseña (o después, con la
// contraseña), recordar a quien administra que lo guarde, y abrir la copia con él si se pierden la contraseña y los
// dispositivos. En el servidor solo está la clave cerrada con el código; el código lo tiene solo la clínica.
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { getToken } from "./auth";
import type { Cloud } from "./CloudGate";
import { decrypt, deriveKeyBytes, ENCRYPTION_KEY, isEncrypted, newRecoveryCode, openWithCode, saltOf, sealForRecovery, storeKey, WrongPassword, type EncryptionSetting } from "./crypt";

/** Ajuste sincronizado: el código de la contraseña de sal `salt` está guardado (quién lo confirmó y cuándo). */
export const RECOVERY_SAVED = "recovery_saved";
type Saved = { salt: string; at: string; by: string };

const token = () => {
  const t = getToken();
  if (!t) throw new Error("Vuelve a entrar con Google.");
  if (!navigator.onLine) throw new Error("Hace falta conexión.");
  return t;
};

/** Crea un código nuevo para la clave de la contraseña (sus bytes y su sal) y guarda en el servidor lo que abre. */
export async function createRecovery(cloud: Cloud, raw: Uint8Array, salt: string): Promise<string> {
  if (!cloud.clinic || !cloud.clinics) throw new Error("El código de recuperación es de las clínicas.");
  const code = newRecoveryCode();
  await cloud.clinics.putRecovery(token(), cloud.clinic.id, await sealForRecovery(raw, salt, code));
  return code;
}

/** Quien administra ha confirmado que tiene guardado el código de esta contraseña. */
export async function confirmRecoverySaved(db: Db, salt: string, by: string) {
  await setSetting(db, RECOVERY_SAVED, { salt, at: new Date().toISOString(), by } satisfies Saved);
}

/** Falta guardar el código de la contraseña de ahora (hay contraseña y no consta que su código esté guardado). */
export async function recoveryPending(db: Db): Promise<boolean> {
  const enc = await getSetting<EncryptionSetting>(db, ENCRYPTION_KEY);
  if (!enc) return false;
  const saved = await getSetting<Saved>(db, RECOVERY_SAVED);
  return saved?.salt !== enc.salt;
}

/** La copia de la nube, para comprobar con ella una clave (null si aún no hay). */
async function remoteCopy(cloud: Cloud): Promise<Uint8Array | null> {
  const t = token();
  const [first] = await cloud.sync.store.list(t);
  return first ? cloud.sync.store.download(t, first) : null;
}

/** La contraseña de la clínica, comprobada con la copia: sus bytes para crear un código nuevo. WrongPassword si no es. */
export async function checkPassword(cloud: Cloud, db: Db, password: string): Promise<{ raw: Uint8Array; salt: string }> {
  const enc = await getSetting<EncryptionSetting>(db, ENCRYPTION_KEY);
  if (!enc) throw new Error("La clínica aún no tiene contraseña de cifrado.");
  const { key, raw } = await deriveKeyBytes(password, enc.salt);
  const copy = await remoteCopy(cloud);
  if (copy && isEncrypted(copy) && saltOf(copy) === enc.salt) await decrypt(copy, key); // WrongPassword si no es
  return { raw, salt: enc.salt };
}

/** Abre la copia con el código de recuperación: guarda la clave en este dispositivo y sincroniza. WrongPassword si no vale. */
export async function recoverWithCode(cloud: Cloud, code: string): Promise<void> {
  if (!cloud.clinic || !cloud.clinics) throw new Error("El código de recuperación es de las clínicas.");
  const blob = await cloud.clinics.getRecovery(token(), cloud.clinic.id);
  if (!blob) throw new Error("Esta clínica no tiene código de recuperación guardado en el servidor.");
  const key = await openWithCode(blob, code);
  const copy = await remoteCopy(cloud);
  if (copy && isEncrypted(copy)) {
    if (saltOf(copy) !== key.salt) throw new Error("El código es de una contraseña anterior: la copia se cifró después con otra.");
    await decrypt(copy, key.key);
  }
  await storeKey(cloud.sync.scope, key.salt, key.key);
  await cloud.sync.sync();
}

export { WrongPassword };
