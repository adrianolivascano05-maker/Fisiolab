// PIN para abrir la app en este dispositivo (src/privacy/README.md). Se guarda solo una huella del PIN
// (PBKDF2-SHA-256 con sal), nunca el PIN. Es una barrera para quien coja el dispositivo desbloqueado: los datos
// no se cifran con él (eso lo hace el propio dispositivo con su bloqueo).

const KEY = "fisiolab.lock";
const FAILS_KEY = "fisiolab.lock.fails";
const ITERATIONS = 150_000;

export type LockConfig = { salt: string; hash: string; afterMs: number };

/** Cuánto puede estar la app fuera de la vista sin pedir el PIN al volver. */
export const LOCK_AFTER: { ms: number; label: string }[] = [
  { ms: 0, label: "En cuanto salgo de la app" },
  { ms: 60_000, label: "Al cabo de 1 minuto" },
  { ms: 5 * 60_000, label: "Al cabo de 5 minutos" },
  { ms: 15 * 60_000, label: "Al cabo de 15 minutos" },
];
export const DEFAULT_LOCK_AFTER = 60_000;

export const isPin = (pin: string) => /^\d{4,8}$/.test(pin);

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function digest(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS }, key, 256);
  return b64(new Uint8Array(bits));
}

export function getLock(): LockConfig | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as LockConfig | null;
  } catch {
    return null;
  }
}

export async function setPin(pin: string, afterMs = getLock()?.afterMs ?? DEFAULT_LOCK_AFTER): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(KEY, JSON.stringify({ salt: b64(salt), hash: await digest(pin, salt), afterMs } satisfies LockConfig));
  localStorage.removeItem(FAILS_KEY);
}

export function setLockAfter(afterMs: number) {
  const c = getLock();
  if (c) localStorage.setItem(KEY, JSON.stringify({ ...c, afterMs }));
}

export function clearLock() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(FAILS_KEY);
}

type Fails = { count: number; until: number };
function fails(): Fails {
  try {
    return (JSON.parse(localStorage.getItem(FAILS_KEY) ?? "null") as Fails | null) ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

/** Hasta cuándo hay que esperar para volver a probar (ms desde 1970), o 0. */
export const waitUntil = () => (fails().until > Date.now() ? fails().until : 0);

/**
 * Comprueba el PIN. Tras 5 fallos seguidos hay que esperar 30 s, y el doble con cada fallo más (hasta 15 min):
 * así no se puede probar los 10 000 PIN de 4 cifras.
 */
export async function checkPin(pin: string): Promise<boolean> {
  const c = getLock();
  if (!c) return true;
  if (waitUntil()) return false;
  const ok = (await digest(pin, unb64(c.salt))) === c.hash;
  if (ok) {
    localStorage.removeItem(FAILS_KEY);
    return true;
  }
  const count = fails().count + 1;
  const until = count >= 5 ? Date.now() + Math.min(30_000 * 2 ** (count - 5), 15 * 60_000) : 0;
  localStorage.setItem(FAILS_KEY, JSON.stringify({ count, until }));
  return false;
}
