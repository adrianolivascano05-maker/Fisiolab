// Sincronización con la copia de la nube: Google Drive o el servidor de la clínica en Cloudflare (remote.ts). La
// app trabaja siempre con la base del dispositivo (funciona sin conexión); esto la junta con la de la nube:
// - al abrir la app y cada pocos minutos con la app a la vista, para traer lo hecho en otros dispositivos;
// - cinco segundos después del último cambio, y al salir de la app, para subir lo hecho aquí.
// Si la nube ha cambiado desde la última vez, se descarga y se junta fila a fila (src/data/syncMerge.ts) antes de
// subir: nunca se pisa sin más lo que hizo otro dispositivo.
//
// Si la cuenta cifra su copia (crypt.ts), se cifra antes de subir y se descifra al bajar. Sin la clave en este
// dispositivo no se baja ni se sube nada: se pide la contraseña («needs-key»). El servidor de Cloudflare solo
// guarda copias cifradas: sin contraseña de cifrado no se sube nada («needs-password»).
import { onDbChange, type Db } from "../data/db";
import { getSetting } from "../data/repo";
import type { Account } from "./account";
import { clearToken, getToken } from "./auth";
import { decrypt, deriveKey, encrypt, ENCRYPTION_KEY, forgetKey, isEncrypted, saltOf, storedKey, storeKey, WrongPassword, type EncryptionSetting, type StoredKey } from "./crypt";
import { AuthError } from "./drive";
import { driveStore, RemoteConflict, type RemoteStore } from "./remote";

export type SyncStatus = "idle" | "syncing" | "offline" | "needs-auth" | "needs-key" | "needs-password" | "error";
export type SyncState = {
  status: SyncStatus;
  /** Dónde está la copia de la nube, para los textos («tu Drive», «el servidor de la clínica»). */
  where: string;
  /** Última vez que la copia del dispositivo y la de la nube quedaron iguales. */
  lastSyncAt: string | null;
  /** Hay cambios hechos aquí que aún no están en la nube. */
  pending: boolean;
  /** Han llegado datos de otro dispositivo que la pantalla abierta aún no enseña. */
  newData: boolean;
  error: string | null;
  /** Con «needs-key»: la sal de la contraseña que hace falta. */
  keySalt?: string | null;
};

type Meta = { fileId: string; version: string; lastSyncAt: string };

/** Hace falta la contraseña de la copia (la sal con la que se cifró) para seguir. */
class NeedsKey extends Error {
  constructor(readonly salt: string) {
    super("La copia de la nube está cifrada.");
  }
}

/** El almacén solo acepta copias cifradas y la cuenta aún no tiene contraseña de cifrado. */
class NeedsPassword extends Error {
  constructor() {
    super("Hace falta una contraseña para cifrar la copia.");
  }
}

const AFTER_CHANGE_MS = 5000;
const EVERY_MS = 5 * 60_000;

export class SyncController {
  private state: SyncState;
  private listeners = new Set<(s: SyncState) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private ownWrite = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stops: (() => void)[] = [];

  constructor(
    private db: Db,
    private account: Account,
    readonly store: RemoteStore = driveStore,
  ) {
    this.state = { status: "idle", where: store.where, lastSyncAt: this.meta()?.lastSyncAt ?? null, pending: false, newData: false, error: null };
  }

  private get metaKey() {
    return `fisiolab.sync.${this.account.sub}`;
  }
  private meta(): Meta | null {
    try {
      return JSON.parse(localStorage.getItem(this.metaKey) ?? "null") as Meta | null;
    } catch {
      return null;
    }
  }
  private saveMeta(m: Meta) {
    localStorage.setItem(this.metaKey, JSON.stringify(m));
  }
  forgetMeta() {
    localStorage.removeItem(this.metaKey);
  }

  get current() {
    return this.state;
  }
  subscribe(fn: (s: SyncState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }
  /** La pantalla ya enseña los datos nuevos. */
  seenNewData() {
    this.set({ newData: false });
  }

  /** Empieza a vigilar: cambios en la base, conexión, salir de la app y cada pocos minutos. */
  start() {
    this.stops.push(
      onDbChange(() => {
        if (this.ownWrite) return;
        this.set({ pending: true });
        this.schedule(AFTER_CHANGE_MS);
      }),
    );
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && this.state.pending) void this.sync();
      if (document.visibilityState === "visible") this.schedule(0);
    };
    const onOnline = () => this.schedule(0);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    const every = setInterval(() => document.visibilityState === "visible" && void this.sync(), EVERY_MS);
    this.stops.push(
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => window.removeEventListener("online", onOnline),
      () => clearInterval(every),
    );
    void this.refreshPending();
  }

  stop() {
    clearTimeout(this.timer);
    this.stops.forEach((s) => s());
    this.stops = [];
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), ms);
  }

  private async refreshPending() {
    const [s] = await this.db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state");
    this.set({ pending: !!s && s.changes > s.pushed });
  }

  /** Una sincronización completa. Si ya hay una en marcha, se repite al terminar. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        // Otra vuelta si han llegado cambios mientras tanto, o si otro dispositivo subió a la vez (con un límite).
        let rounds = 0;
        do {
          this.again = false;
          await this.once();
        } while (this.again && ++rounds < 5);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async own<T>(fn: () => Promise<T>): Promise<T> {
    this.ownWrite = true;
    try {
      return await fn();
    } finally {
      this.ownWrite = false;
    }
  }

  private async once() {
    const token = getToken();
    if (!token) return this.set({ status: "needs-auth" });
    if (!navigator.onLine) return this.set({ status: "offline" });
    this.set({ status: "syncing", error: null });
    try {
      const store = this.store;
      const [s] = await this.db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state");
      const dirty = s!.changes > s!.pushed;
      const files = await store.list(token);
      const meta = this.meta();
      let pulled = 0;
      let key = await storedKey(this.account.sub);

      if (!files.length) {
        // Primera vez: la copia de este dispositivo es la de la nube.
        const snap = await this.db.snapshot();
        const f = await store.create(token, await this.seal(snap.bytes, key));
        await this.markPushed(snap.changes);
        this.saveMeta({ fileId: f.id, version: f.version, lastSyncAt: new Date().toISOString() });
      } else {
        const [main, ...extra] = files;
        const unchanged = !extra.length && meta?.fileId === main!.id && meta.version === main!.version;
        let needUpload = dirty;
        if (!unchanged) {
          // Otro dispositivo ha subido algo: se junta antes de subir. (Dos copias solo si dos dispositivos
          // subieron la primera a la vez: se juntan las dos y se queda una.)
          needUpload = !!extra.length;
          for (const f of files) {
            const bytes = await this.open(await store.download(token, f), key);
            const r = await this.own(() => this.db.merge(bytes));
            pulled += r.pulled;
            needUpload ||= r.needUpload;
          }
          if (!needUpload) await this.markPushed(s!.changes);
          // Si otro dispositivo ha dejado de cifrar, o ha cambiado la contraseña, la clave de aquí ya no vale.
          const enc = await this.encryption();
          if (key && (!enc || enc.salt !== key.salt)) {
            forgetKey(this.account.sub);
            key = null;
            needUpload ||= !enc; // que la copia de Drive quede sin cifrar también
          }
        }
        let version = main!.version;
        if (needUpload) {
          const snap = await this.db.snapshot();
          version = (await store.update(token, main!, await this.seal(snap.bytes, key))).version;
          await this.markPushed(snap.changes);
          for (const f of extra) await store.remove(token, f);
        }
        this.saveMeta({ fileId: main!.id, version, lastSyncAt: new Date().toISOString() });
      }
      await this.refreshPending();
      this.set({ status: "idle", lastSyncAt: this.meta()!.lastSyncAt, newData: this.state.newData || pulled > 0, keySalt: null });
    } catch (e) {
      if (e instanceof RemoteConflict) {
        // Otro dispositivo ha subido entre medias: otra vuelta, que baja lo suyo, lo junta y sube.
        this.again = true;
      } else if (e instanceof NeedsPassword) {
        this.set({ status: "needs-password" });
      } else if (e instanceof NeedsKey) {
        this.set({ status: "needs-key", keySalt: e.salt });
      } else if (e instanceof AuthError) {
        clearToken();
        this.set({ status: "needs-auth" });
      } else if (!navigator.onLine || (e instanceof TypeError && /fetch|network|load failed/i.test(e.message))) {
        this.set({ status: "offline" }); // fetch sin red
      } else {
        this.set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  /** Si la copia de Drive va cifrada (ajuste sincronizado). */
  private async encryption(): Promise<EncryptionSetting> {
    return (await getSetting<EncryptionSetting>(this.db, ENCRYPTION_KEY)) ?? null;
  }

  /** La copia para subir: cifrada si la cuenta cifra (sin la clave, no se sube). */
  private async seal(bytes: Uint8Array, key: StoredKey | null): Promise<Uint8Array> {
    const enc = await this.encryption();
    if (!enc) {
      if (this.store.encryptedOnly) throw new NeedsPassword();
      return bytes;
    }
    if (!key || key.salt !== enc.salt) throw new NeedsKey(enc.salt);
    return encrypt(bytes, key.key, key.salt);
  }

  /** Una copia bajada de Drive, lista para juntar: descifrada si viene cifrada. */
  private async open(bytes: Uint8Array, key: StoredKey | null): Promise<Uint8Array> {
    if (!isEncrypted(bytes)) return bytes;
    const salt = saltOf(bytes);
    if (!key || key.salt !== salt) throw new NeedsKey(salt);
    try {
      return await decrypt(bytes, key.key);
    } catch (e) {
      // La clave guardada ya no abre la copia (otra contraseña con la misma sal no puede darse, pero por si acaso).
      if (e instanceof WrongPassword) forgetKey(this.account.sub);
      throw new NeedsKey(salt);
    }
  }

  /**
   * La contraseña de la copia cifrada, escrita en este dispositivo: se comprueba con la copia de Drive, se guarda
   * la clave y se sincroniza. WrongPassword si no la abre.
   */
  async unlock(password: string): Promise<void> {
    const salt = this.state.keySalt;
    if (!salt) return;
    const token = getToken();
    if (!token || !navigator.onLine) throw new Error(`Hace falta conexión para comprobar la contraseña con ${this.store.where}.`);
    const key = await deriveKey(password, salt);
    // Se comprueba con la copia de la nube: una clave equivocada cifraría la copia con otra contraseña.
    const files = await this.store.list(token);
    let checked = false;
    for (const f of files) {
      const bytes = await this.store.download(token, f);
      if (isEncrypted(bytes) && saltOf(bytes) === salt) {
        await decrypt(bytes, key); // WrongPassword si no es
        checked = true;
        break;
      }
    }
    if (!checked) throw new Error(`No hay en ${this.store.where} una copia cifrada con la que comprobar la contraseña. Pulsa «He olvidado la contraseña» para sustituirla por la de este dispositivo.`);
    await storeKey(this.account.sub, salt, key);
    await this.sync();
  }

  /**
   * Contraseña olvidada: borra las copias de la nube y sube la de este dispositivo (sin cifrar, o con la contraseña
   * nueva si se ha activado otra vez). Lo que solo estuviera en la nube se pierde.
   */
  async replaceRemote(): Promise<void> {
    const token = getToken();
    if (!token) throw new Error("Vuelve a entrar con Google.");
    for (const f of await this.store.list(token)) await this.store.remove(token, f);
    this.forgetMeta();
    this.set({ keySalt: null });
    await this.sync();
  }

  private markPushed(changes: number) {
    return this.own(() => this.db.transaction([{ sql: "update sync_state set pushed = max(pushed, ?)", bind: [changes] }]));
  }
}
