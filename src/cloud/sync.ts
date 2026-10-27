// Sincronización con la copia de la nube: Google Drive o el servidor de la clínica en Cloudflare (remote.ts). La
// app trabaja siempre con la base del dispositivo (funciona sin conexión); esto la junta con la de la nube:
// - al abrir la app y cada pocos minutos (con el servidor de la clínica, cada minuto) con la app a la vista, para traer
//   lo hecho en otros dispositivos;
// - cinco segundos después del último cambio, y al salir de la app, para subir lo hecho aquí.
// Si la nube ha cambiado desde la última vez, se descarga y se junta fila a fila (src/data/syncMerge.ts) antes de
// subir: nunca se pisa sin más lo que hizo otro dispositivo.
//
// Con el servidor de una clínica, por cambios (DeltaApi en remote.ts): cada dispositivo sube solo lo que ha cambiado
// desde la última vez (un lote cifrado) y baja lo de los demás, en vez de la base entera. La copia entera se baja la
// primera vez (o tras mucho tiempo sin sincronizar) y, de vez en cuando, un dispositivo sube una nueva que ya lo lleva
// todo para que el servidor borre los lotes anteriores. Con un servidor de una versión anterior, como siempre.
//
// La copia va siempre cifrada (crypt.ts): se cifra antes de subir y se descifra al bajar. Sin contraseña de
// cifrado en la cuenta no se sube nada («needs-password»); con ella pero sin la clave en este dispositivo, no se baja
// ni se sube nada hasta escribirla («needs-key»). Una copia antigua sin cifrar se sigue pudiendo bajar y juntar.
import { logError } from "../app/errorLog";
import { onDbChange, type Db } from "../data/db";
import { describeOverwritten } from "../data/editors";
import { getSetting } from "../data/repo";
import type { DeltaItem, MergeResult } from "../data/syncMerge";
import type { Account } from "./account";
import { clearToken, getToken, type Token } from "./auth";
import { decrypt, deriveKey, encrypt, encryptToPieces, ENCRYPTION_KEY, forgetKey, isEncrypted, saltOf, storedKey, storeKey, WrongPassword, type EncryptionSetting, type StoredKey } from "./crypt";
import { AuthError } from "./drive";
import { driveStore, RemoteConflict, type DeltaApi, type DeltaInfo, type RemoteStore } from "./remote";

export type SyncStatus = "idle" | "syncing" | "offline" | "needs-auth" | "needs-key" | "needs-password" | "error";
export type SyncState = {
  status: SyncStatus;
  /** Dónde está la copia de la nube, para los textos («tu Drive», «el servidor de la clínica»). */
  where: string;
  /** Última vez que la copia del dispositivo y la de la nube quedaron iguales. */
  lastSyncAt: string | null;
  /** Hay cambios hechos aquí que aún no están en la nube. */
  pending: boolean;
  /** Desde cuándo hay cambios sin subir (para avisar si no salen). */
  pendingSince?: string | null;
  /**
   * Cómo acabó la última vuelta si algo lo impidió (error, sin sesión o sin conexión): se mantiene mientras se vuelve
   * a intentar, para que el aviso no desaparezca y vuelva a cada intento.
   */
  failing?: SyncStatus | null;
  /** Han llegado datos de otro dispositivo que la pantalla abierta aún no enseña. */
  newData: boolean;
  error: string | null;
  /** Con «needs-key»: la sal de la contraseña que hace falta. */
  keySalt?: string | null;
  /** Lo que se acababa de cambiar aquí y otro ha cambiado después: se ha quedado lo suyo («Editado por»). */
  overwritten?: string[];
  /**
   * Respuestas de pacientes por recoger, según la última consulta al servidor de la clínica (src/patientForm/
   * FormInbox.tsx las recoge al verlas). null: el servidor no lo dice (Drive o una versión anterior): hay que preguntar
   * aparte. Sin definir: aún no se ha mirado.
   */
  forms?: number | null;
};

type Meta = {
  fileId: string;
  version: string;
  lastSyncAt: string;
  /** Sincronización por cambios: la época de la copia del servidor y el último cambio que ya está aquí. */
  epoch?: string | null;
  seq?: number;
  /** La sal con la que va cifrada la copia entera del servidor, y la de la clave de este dispositivo en la última vuelta. */
  salt?: string;
  keySalt?: string;
  /** Contraseñas anteriores (sus sales): un lote cifrado con una de ellas ya lo ha vuelto a subir quien lo hizo. */
  oldSalts?: string[];
  /** Lo subido por cambios en el último día: desde qué cambio y con qué contraseña (para volver a subirlo si cambia). */
  recent?: { from: number; salt: string; at: string }[];
};

/** Un lote de cambios como viaja (cifrado): la versión de la base que lo hizo y los cambios. */
type DeltaBatch = { schema: number; items: DeltaItem[] };
/** Tamaño de cada lote al subir: así ningún lote pasa del máximo del servidor (1 MB en base64, ya comprimido). */
const BATCH_ITEMS = 400;
const BATCH_CHARS = 500_000;
/**
 * Con tantos lotes (o tanto tamaño) después de la copia entera, se sube una nueva y el servidor borra los anteriores.
 * Con una copia grande se espera más: subirla entera cuesta más que bajar unos cuantos lotes de más.
 */
export function shouldCompact(copyBytes: number, deltas: number, deltaBytes: number): boolean {
  const big = copyBytes >= 5 * 1024 * 1024;
  return deltas >= (big ? 1000 : 200) || deltaBytes >= Math.max(2 * 1024 * 1024, copyBytes / 10);
}

/** Parte los cambios en lotes que no pasen de BATCH_ITEMS ni de BATCH_CHARS (en JSON, antes de comprimir). */
function batches(items: DeltaItem[]): DeltaItem[][] {
  const out: DeltaItem[][] = [];
  let cur: DeltaItem[] = [];
  let chars = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (cur.length && (cur.length >= BATCH_ITEMS || chars + size > BATCH_CHARS)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(item);
    chars += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Hace falta la contraseña de la copia (la sal con la que se cifró) para seguir. */
class NeedsKey extends Error {
  constructor(readonly salt: string) {
    super("La copia de la nube está cifrada.");
  }
}

/** La cuenta aún no tiene contraseña de cifrado: no se sube nada sin cifrar. */
class NeedsPassword extends Error {
  constructor() {
    super("Hace falta una contraseña para cifrar la copia.");
  }
}

const AFTER_CHANGE_MS = 5000;
/** Cada cuánto se mira la nube con la app a la vista: con el servidor de la clínica, cada minuto (lo hace todo el equipo). */
const EVERY_MS = 5 * 60_000;
const EVERY_MS_SERVER = 60_000;
/**
 * Con el servidor de la clínica: si nadie toca la app en tanto tiempo (la tablet de recepción con la agenda abierta),
 * se mira cada 5 minutos en vez de cada minuto; al volver a tocarla, enseguida. Así cada dispositivo olvidado encima
 * de la mesa no gasta peticiones del servidor.
 */
const IDLE_MS = 5 * 60_000;

export class SyncController {
  private state: SyncState;
  private listeners = new Set<(s: SyncState) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private ownWrite = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stops: (() => void)[] = [];
  /** Cuándo se miró la nube por última vez (para el ritmo sin uso). */
  private lastLook = 0;

  /**
   * `scope`: de quién son la base y la copia, para guardar en este dispositivo la clave de cifrado y por dónde va la
   * sincronización: la cuenta o, en una clínica, la cuenta en esa clínica (src/cloud/clinic.ts).
   */
  constructor(
    private db: Db,
    account: Account,
    readonly store: RemoteStore = driveStore,
    readonly scope: string = account.sub,
  ) {
    this.state = { status: "idle", where: store.where, lastSyncAt: this.meta()?.lastSyncAt ?? null, pending: false, newData: false, error: null };
  }

  private get metaKey() {
    return `fisiolab.sync.${this.scope}`;
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
  /** Ya se ha visto el aviso de cambios pisados. */
  seenOverwritten() {
    this.set({ overwritten: [] });
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
        this.setPending(true);
        this.schedule(AFTER_CHANGE_MS);
      }),
    );
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && this.state.pending) void this.sync();
      if (document.visibilityState === "visible") this.schedule(0);
    };
    const onOnline = () => this.schedule(0);
    const server = this.store.kind === "server";
    let lastUse = Date.now();
    const onUse = () => {
      const wasIdle = Date.now() - lastUse > IDLE_MS;
      lastUse = Date.now();
      if (server && wasIdle) this.schedule(0);
    };
    const use = ["pointerdown", "keydown"] as const;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    for (const e of use) window.addEventListener(e, onUse, { capture: true, passive: true });
    const every = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        if (server && Date.now() - lastUse > IDLE_MS && Date.now() - this.lastLook < IDLE_MS) return;
        void this.sync();
      },
      server ? EVERY_MS_SERVER : EVERY_MS,
    );
    this.stops.push(
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => window.removeEventListener("online", onOnline),
      () => use.forEach((e) => window.removeEventListener(e, onUse, { capture: true })),
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

  private setPending(pending: boolean) {
    this.set({ pending, pendingSince: pending ? (this.state.pendingSince ?? new Date().toISOString()) : null });
  }

  private async refreshPending() {
    const [s] = await this.db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state");
    this.setPending(!!s && s.changes > s.pushed);
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
    if (!token) return this.set({ status: "needs-auth", failing: "needs-auth" });
    if (!navigator.onLine) return this.set({ status: "offline", failing: "offline" });
    this.set({ status: "syncing" });
    this.lastLook = Date.now();
    try {
      const info = this.store.deltas && (await this.store.deltas.info(token));
      this.set({ forms: info && typeof info.forms === "number" ? info.forms : null });
      const pulled = info ? await this.deltaRound(token, info, this.store.deltas!) : await this.wholeRound(token);
      await this.refreshPending();
      this.set({ status: "idle", lastSyncAt: this.meta()?.lastSyncAt ?? null, newData: this.state.newData || pulled > 0, keySalt: null, error: null, failing: null });
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
        this.set({ status: "needs-auth", failing: "needs-auth" });
      } else if (!navigator.onLine || (e instanceof TypeError && /fetch|network|load failed/i.test(e.message))) {
        this.set({ status: "offline", failing: "offline" }); // fetch sin red
      } else {
        logError("sincronización", e);
        this.set({ status: "error", error: e instanceof Error ? e.message : String(e), failing: "error" });
      }
    }
  }

  /** Aviso de lo que se acababa de cambiar aquí y otro ha cambiado después («Editado por»). */
  private async noteOverwritten(r: MergeResult) {
    if (!r.overwritten?.length) return;
    const lost = await describeOverwritten(this.db, r.overwritten);
    if (lost.length) this.set({ overwritten: [...new Set([...(this.state.overwritten ?? []), ...lost])] });
  }

  /** Una vuelta con la copia entera (Drive o un servidor de una versión anterior). Devuelve las filas que han llegado. */
  private async wholeRound(token: Token): Promise<number> {
    const store = this.store;
    const [s] = await this.db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state");
    const dirty = s!.changes > s!.pushed;
    const files = await store.list(token);
    const meta = this.meta();
    let pulled = 0;
    let key = await storedKey(this.scope);

    if (!files.length) {
      // Primera vez: la copia de este dispositivo es la de la nube.
      const snap = await this.db.snapshot();
      const f = await store.create(token, await this.seal(snap.bytes, key, true));
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
          await this.noteOverwritten(r);
        }
        if (!needUpload) await this.markPushed(s!.changes);
        // Si otro dispositivo ha cambiado la contraseña, la clave de aquí ya no vale.
        key = await this.checkKey(key);
      }
      let version = main!.version;
      if (needUpload) {
        const snap = await this.db.snapshot();
        version = (await store.update(token, main!, await this.seal(snap.bytes, key, true))).version;
        await this.markPushed(snap.changes);
        for (const f of extra) await store.remove(token, f);
      }
      this.saveMeta({ fileId: main!.id, version, lastSyncAt: new Date().toISOString() });
    }
    return pulled;
  }

  /**
   * Una vuelta por cambios con el servidor de la clínica. Devuelve las filas que han llegado.
   * 1. La copia entera, solo si hace falta: la primera vez, si se ha sustituido (otra época) o si este dispositivo se
   *    ha quedado atrás (el servidor ya borró los cambios que le faltan).
   * 2. Los cambios de los demás desde el último que llegó aquí.
   * 3. Lo de aquí: un lote con lo cambiado desde la última subida. O la copia entera, la primera vez que la clínica
   *    sincroniza por cambios o si este dispositivo tenía cambios sin subir de una versión anterior de la app.
   * 4. De vez en cuando, una copia entera nueva para que el servidor borre los cambios anteriores.
   */
  private async deltaRound(token: Token, info: DeltaInfo, api: DeltaApi): Promise<number> {
    const store = this.store;
    const meta = this.meta();
    const now = () => new Date().toISOString();
    let key = await storedKey(this.scope);
    let pulled = 0;
    // Una contraseña nueva en este dispositivo: la anterior pasa a ser vieja.
    const oldSalts = [...(meta?.oldSalts ?? [])];
    if (key && meta?.keySalt && meta.keySalt !== key.salt && !oldSalts.includes(meta.keySalt)) oldSalts.push(meta.keySalt);
    const recent = (meta?.recent ?? []).filter((r) => Date.parse(r.at) > Date.now() - 86_400_000);
    const save = (patch: Partial<Meta>) =>
      this.saveMeta({ fileId: "copia", version: "", lastSyncAt: meta?.lastSyncAt ?? now(), ...meta, oldSalts, recent, keySalt: key?.salt, ...patch });

    if (!info.version) {
      // Nada en el servidor: la copia de aquí es la primera (y con ella, la clínica sincroniza por cambios).
      const snap = await this.db.snapshot();
      const sealed = await this.seal(snap.bytes, key, true);
      const f = await store.create(token, sealed, 0);
      await this.markPushed(snap.changes);
      await this.clearLegacy();
      save({ version: f.version, lastSyncAt: now(), epoch: f.epoch ?? null, seq: f.base ?? 0, salt: saltOf(sealed) });
      return 0;
    }

    let version = info.version;
    let epoch = info.epoch;
    let snapSalt = meta?.salt;
    const [st] = await this.db.query<{ legacy: number }>("select legacy from sync_state");
    const legacy = !!st?.legacy;
    const current = !legacy && !!meta?.epoch && meta.epoch === info.epoch && meta.seq !== undefined && info.base !== null && meta.seq >= info.base;
    let cursor = current ? meta!.seq! : (info.base ?? 0);
    let uploadWhole = false;
    if (!current) {
      const raw = await store.download(token, { id: "copia", version });
      const bytes = await this.open(raw, key);
      snapSalt = isEncrypted(raw) ? saltOf(raw) : undefined;
      const r = await this.own(() => this.db.merge(bytes));
      pulled += r.pulled;
      await this.noteOverwritten(r);
      // Subir la copia entera: para pasar la clínica a la sincronización por cambios, para no perder lo que este
      // dispositivo tenía sin subir de antes, o si la copia del servidor se ha sustituido y aquí hay cosas que no tiene.
      uploadWhole = info.epoch === null || (r.needUpload && (legacy || (!!meta?.epoch && meta.epoch !== info.epoch)));
      key = await this.checkKey(key);
    }

    if (info.base !== null && info.last > cursor) {
      for (;;) {
        const page = await api.since(token, cursor);
        if (page.epoch !== epoch || page.base > cursor) {
          // Mientras tanto se ha sustituido o resumido la copia: otra vuelta, con la copia entera.
          save({ epoch: null, seq: undefined });
          this.again = true;
          return pulled;
        }
        for (const d of page.deltas) {
          const batch = await this.openDelta(d.data, key, oldSalts, recent);
          if (batch) {
            const r = await this.own(() => this.db.apply(batch.items, batch.schema));
            pulled += r.pulled;
            await this.noteOverwritten(r);
          }
          cursor = d.seq;
        }
        if (!uploadWhole) save({ version, epoch, seq: cursor, salt: snapSalt });
        if (!page.more || !page.deltas.length) break;
      }
      key = await this.checkKey(key);
    }

    if (uploadWhole) {
      const snap = await this.db.snapshot();
      const sealed = await this.seal(snap.bytes, key, true);
      const f = await store.update(token, { id: "copia", version }, sealed, cursor);
      version = f.version;
      epoch = f.epoch ?? epoch;
      snapSalt = saltOf(sealed);
      await this.markPushed(snap.changes);
      await this.clearLegacy();
    } else {
      if (legacy) await this.clearLegacy();
      const [s] = await this.db.query<{ pushed: number }>("select pushed from sync_state");
      const p = await this.db.pending();
      let sent = 0;
      if (p.items.length) {
        const schema = (await this.db.info()).schemaVersion;
        for (const items of batches(p.items)) {
          const sealed = await this.seal(new TextEncoder().encode(JSON.stringify({ schema, items } satisfies DeltaBatch)), key);
          await api.post(token, sealed);
          sent++;
        }
        recent.push({ from: s!.pushed, salt: key!.salt, at: now() });
      }
      if (p.changes > s!.pushed) await this.markPushed(p.changes);
      // Resumir: una copia entera con todo hasta aquí (y con la contraseña de ahora); el servidor borra lo anterior.
      if (key && (shouldCompact(info.size ?? 0, info.deltas + sent, info.deltaSize) || snapSalt !== key.salt)) {
        try {
          const snap = await this.db.snapshot();
          const sealed = await this.seal(snap.bytes, key, true);
          version = (await store.update(token, { id: "copia", version }, sealed, cursor)).version;
          snapSalt = key.salt;
        } catch (e) {
          // Otro dispositivo ha resumido a la vez: ya está hecho.
          if (!(e instanceof RemoteConflict)) throw e;
        }
      }
    }
    save({ version, lastSyncAt: now(), epoch, seq: cursor, salt: snapSalt });
    return pulled;
  }

  /** Si otro dispositivo ha cambiado la contraseña (ajuste ya juntado aquí), la clave de aquí ya no vale. */
  private async checkKey(key: StoredKey | null): Promise<StoredKey | null> {
    const enc = await this.encryption();
    if (key && (!enc || enc.salt !== key.salt)) {
      await forgetKey(this.scope);
      return null;
    }
    return key;
  }

  /**
   * Un lote de cambios bajado del servidor, descifrado. null si va con una contraseña anterior: quien lo subió lo
   * vuelve a subir con la nueva al escribirla (abajo). Sin la clave de su contraseña, NeedsKey.
   */
  private async openDelta(bytes: Uint8Array, key: StoredKey | null, oldSalts: string[], recent: NonNullable<Meta["recent"]>): Promise<DeltaBatch | null> {
    if (!isEncrypted(bytes)) throw new Error("Un cambio del servidor no viene cifrado.");
    const salt = saltOf(bytes);
    if (oldSalts.includes(salt)) return null;
    if (!key || key.salt !== salt) {
      // La contraseña ha cambiado y aquí aún no está la nueva: lo que se subió aquí con la anterior hace poco, los
      // demás no lo pueden abrir. Se vuelve a subir (con la nueva) al escribirla.
      const from = recent.filter((r) => key && r.salt === key.salt).map((r) => r.from);
      if (from.length) await this.own(() => this.db.transaction([{ sql: "update sync_state set pushed = min(pushed, ?)", bind: [Math.min(...from)] }]));
      throw new NeedsKey(salt);
    }
    try {
      return JSON.parse(new TextDecoder().decode(await decrypt(bytes, key.key))) as DeltaBatch;
    } catch (e) {
      if (e instanceof WrongPassword) {
        await forgetKey(this.scope);
        throw new NeedsKey(salt);
      }
      throw e;
    }
  }

  private clearLegacy() {
    return this.own(() => this.db.transaction([{ sql: "update sync_state set legacy = 0" }]));
  }

  /** Si la copia de Drive va cifrada (ajuste sincronizado). */
  private async encryption(): Promise<EncryptionSetting> {
    return (await getSetting<EncryptionSetting>(this.db, ENCRYPTION_KEY)) ?? null;
  }

  /**
   * La copia para subir, cifrada (sin contraseña o sin la clave, no se sube). `whole`: la copia entera, que va por
   * trozos si el servidor la guarda en R2 (los lotes de cambios, siempre de una pieza).
   */
  private async seal(bytes: Uint8Array, key: StoredKey | null, whole = false): Promise<Uint8Array> {
    const enc = await this.encryption();
    if (!enc) throw new NeedsPassword();
    if (!key || key.salt !== enc.salt) throw new NeedsKey(enc.salt);
    return whole && this.store.pieces ? encryptToPieces(bytes, key.key, key.salt) : encrypt(bytes, key.key, key.salt);
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
      if (e instanceof WrongPassword) await forgetKey(this.scope);
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
    await storeKey(this.scope, salt, key);
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
