// PIN para abrir la app en este dispositivo (src/privacy/README.md). Se guarda solo una huella del PIN
// (PBKDF2-SHA-256 con sal), nunca el PIN. Es una barrera para quien coja el dispositivo desbloqueado: los datos
// no se cifran con él (eso lo hace el propio dispositivo con su bloqueo). Con cuenta de Google, cada persona tiene
// su PIN en el dispositivo (setLockScope): en una tablet compartida, cada una el suyo.

const BASE_KEY = "fisiolab.lock";
const ITERATIONS = 150_000;

/** `length`: cifras del PIN (para comprobarlo al teclear la última); `passkey`: Face ID o huella (passkey.ts). */
export type LockConfig = { salt: string; hash: string; afterMs: number; length?: number; passkey?: string; v?: number };

let scope: string | null = null;
/** De quién es el PIN: la cuenta que ha entrado (su `sub`), o null sin cuenta. */
export function setLockScope(sub: string | null) {
  scope = sub;
}
const key = () => (scope ? `${BASE_KEY}.${scope}` : BASE_KEY);
const failsKey = () => `${key()}.fails`;

/** Cuánto tiempo sin usar la app (o fuera de ella) antes de pedir el PIN otra vez. */
export const LOCK_AFTER: { ms: number; label: string }[] = [
  { ms: 0, label: "En cuanto salgo de la app" },
  { ms: 60_000, label: "Al cabo de 1 minuto" },
  { ms: 5 * 60_000, label: "Al cabo de 5 minutos" },
  { ms: 15 * 60_000, label: "Al cabo de 15 minutos" },
  { ms: 30 * 60_000, label: "Al cabo de 30 minutos" },
  { ms: 60 * 60_000, label: "Al cabo de 1 hora" },
];
const DEFAULT_LOCK_AFTER = 15 * 60_000;
/** Antes era 1 hora por defecto: los que la tenían pasan una vez a 15 minutos (se puede volver a elegir 1 hora). */
const OLD_DEFAULT = 60 * 60_000;
/** Fallos seguidos tras los que, con cuenta, hay que volver a entrar con Google. */
export const MAX_FAILS = 5;

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
    const own = JSON.parse(localStorage.getItem(key()) ?? "null") as LockConfig | null;
    if (own && !own.v) {
      const moved = { ...own, afterMs: own.afterMs === OLD_DEFAULT ? DEFAULT_LOCK_AFTER : own.afterMs, v: 2 };
      localStorage.setItem(key(), JSON.stringify(moved));
      return moved;
    }
    if (own || !scope) return own;
    // El PIN de antes era del dispositivo: pasa a ser de la primera cuenta que entra.
    const old = JSON.parse(localStorage.getItem(BASE_KEY) ?? "null") as LockConfig | null;
    if (old) {
      localStorage.setItem(key(), JSON.stringify(old));
      localStorage.removeItem(BASE_KEY);
    }
    return old;
  } catch {
    return null;
  }
}

const save = (c: LockConfig) => localStorage.setItem(key(), JSON.stringify(c));

export async function setPin(pin: string, afterMs = getLock()?.afterMs ?? DEFAULT_LOCK_AFTER): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  save({ ...getLock(), salt: b64(salt), hash: await digest(pin, salt), afterMs, length: pin.length, v: 2 });
  localStorage.removeItem(failsKey());
}

export function setLockAfter(afterMs: number) {
  const c = getLock();
  if (c) save({ ...c, afterMs });
}

/** Face ID o huella para desbloquear (el id de la passkey), o quitarlo con null. */
export function setPasskey(id: string | null) {
  const c = getLock();
  if (!c) return;
  const { passkey: _, ...rest } = c;
  save(id ? { ...rest, passkey: id } : rest);
}

export function clearLock() {
  localStorage.removeItem(key());
  localStorage.removeItem(failsKey());
  localStorage.removeItem(`${key()}.active`);
}

type Fails = { count: number; until: number };
function fails(): Fails {
  try {
    return (JSON.parse(localStorage.getItem(failsKey()) ?? "null") as Fails | null) ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

/** Fallos seguidos hasta ahora. */
export const failCount = () => fails().count;

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
    localStorage.removeItem(failsKey());
    return true;
  }
  const count = fails().count + 1;
  const until = count >= MAX_FAILS ? Date.now() + Math.min(30_000 * 2 ** (count - MAX_FAILS), 15 * 60_000) : 0;
  localStorage.setItem(failsKey(), JSON.stringify({ count, until }));
  return false;
}

/**
 * Última vez que se usó la app desbloqueada (también en otra carga de la página): al recargar o volver a abrirla
 * antes del tiempo elegido no se pide otra vez, como en el móvil.
 */
export function markActive(at = Date.now()) {
  localStorage.setItem(`${key()}.active`, String(at));
}
export function lastActiveAt(): number {
  return Number(localStorage.getItem(`${key()}.active`)) || 0;
}
/** Si al abrir la app hay que pedir el PIN. */
export function lockedOnOpen(): boolean {
  const c = getLock();
  if (!c) return false;
  return c.afterMs === 0 || Date.now() - lastActiveAt() >= c.afterMs;
}

/** Desbloqueo con Face ID o huella: cuenta como acertar el PIN. */
export function unlockedOtherwise() {
  localStorage.removeItem(failsKey());
}
