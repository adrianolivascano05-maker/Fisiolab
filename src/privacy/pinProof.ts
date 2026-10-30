// Para poner un PIN nuevo donde ya hubo uno (tras «He olvidado el PIN», tras 5 fallos o si alguien borró el PIN del
// dispositivo) hay que demostrar que se puede abrir la clínica: la contraseña de la clínica (sin conexión) o el código
// de recuperación (con conexión), comprobados contra la clave guardada en el dispositivo sin exportarla (crypt.ts,
// sameKey). Volver a entrar con Google no demuestra nada: el navegador ya tiene la sesión abierta. Quien no tenga ni
// la contraseña ni el código puede borrar los datos del dispositivo (vuelven a bajar con la contraseña).
import { getToken } from "../cloud/auth";
import { clinicApi } from "../cloud/clinic";
import { deriveKey, openWithCode, sameKey, storedKey, WrongPassword } from "../cloud/crypt";
import { pinWasSet } from "./pin";

export type Proof = "password" | "wipe" | "none";

/** Fallos seguidos tras los que hay que esperar (30 s, el doble cada vez, hasta 15 min). */
export const PROOF_MAX_FAILS = 5;
const proofKey = (scope: string) => `fisiolab.lock.${scope}.proof`;

type Fails = { count: number; until: number };
function fails(scope: string): Fails {
  try {
    return (JSON.parse(localStorage.getItem(proofKey(scope)) ?? "null") as Fails | null) ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}
/** Hasta cuándo hay que esperar para volver a probar (ms desde 1970), o 0. */
export const proofWaitUntil = (scope: string) => (fails(scope).until > Date.now() ? fails(scope).until : 0);
function failed(scope: string) {
  const count = fails(scope).count + 1;
  const until = count >= PROOF_MAX_FAILS ? Date.now() + Math.min(30_000 * 2 ** (count - PROOF_MAX_FAILS), 15 * 60_000) : 0;
  localStorage.setItem(proofKey(scope), JSON.stringify({ count, until }));
}
const passed = (scope: string) => localStorage.removeItem(proofKey(scope));

/**
 * Qué hace falta para poner un PIN nuevo: «none» la primera vez en el dispositivo (nunca hubo PIN para esta
 * cuenta); «password» si hay clave de la clínica guardada (la contraseña o el código); «wipe» si hubo PIN pero no hay
 * clave con la que comprobar nada (solo queda borrar los datos del dispositivo). `pinScope`: la cuenta (su `sub`);
 * `keyScope`: de quién es la clave (la cuenta en esa clínica, o la cuenta con su copia en Drive).
 */
export async function proofNeeded(pinScope: string | null, keyScope: string | null): Promise<Proof> {
  if (!(await pinWasSet(pinScope))) return "none";
  return keyScope && (await storedKey(keyScope)) ? "password" : "wipe";
}

/** La contraseña de la clínica (o de la copia en Drive), comprobada con la clave guardada aquí. Funciona sin conexión. */
export async function checkClinicPassword(keyScope: string, password: string): Promise<boolean> {
  if (proofWaitUntil(keyScope)) return false;
  const stored = await storedKey(keyScope);
  if (!stored) return false;
  const ok = await sameKey(stored.key, await deriveKey(password, stored.salt));
  if (ok) passed(keyScope);
  else failed(keyScope);
  return ok;
}

/**
 * El código de recuperación del kit, comprobado con la clave guardada aquí. Necesita conexión (la clave cerrada con
 * el código está en el servidor). Lanza con un texto claro si el código es de una contraseña anterior.
 */
export async function checkRecoveryCode(serverUrl: string, clinicId: string, keyScope: string, code: string): Promise<boolean> {
  if (proofWaitUntil(keyScope)) return false;
  const token = getToken();
  if (!token) throw new Error("Vuelve a entrar con Google.");
  if (!navigator.onLine) throw new Error("Para comprobar el código hace falta conexión.");
  const stored = await storedKey(keyScope);
  if (!stored) return false;
  const blob = await clinicApi(serverUrl).getRecovery(token, clinicId);
  if (!blob) throw new Error("Esta clínica no tiene código de recuperación guardado en el servidor.");
  let opened;
  try {
    opened = await openWithCode(blob, code);
  } catch (e) {
    if (!(e instanceof WrongPassword)) throw e;
    failed(keyScope);
    return false;
  }
  if (opened.salt !== stored.salt) throw new Error("Ese código es de una contraseña anterior.");
  const ok = await sameKey(stored.key, opened.key);
  if (ok) passed(keyScope);
  else failed(keyScope);
  return ok;
}
