// Sincronización con la copia de Google Drive. La app trabaja siempre con la base del dispositivo (funciona sin
// conexión); esto la junta con la de la nube:
// - al abrir la app y cada pocos minutos con la app a la vista, para traer lo hecho en otros dispositivos;
// - cinco segundos después del último cambio, y al salir de la app, para subir lo hecho aquí.
// Si la nube ha cambiado desde la última vez, se descarga y se junta fila a fila (src/data/syncMerge.ts) antes de
// subir: nunca se pisa sin más lo que hizo otro dispositivo.
import { onDbChange, type Db } from "../data/db";
import type { Account } from "./account";
import { clearToken, getToken } from "./auth";
import { AuthError, createFile, deleteFile, download, listFiles, updateFile } from "./drive";

export type SyncStatus = "idle" | "syncing" | "offline" | "needs-auth" | "error";
export type SyncState = {
  status: SyncStatus;
  /** Última vez que la copia del dispositivo y la de la nube quedaron iguales. */
  lastSyncAt: string | null;
  /** Hay cambios hechos aquí que aún no están en la nube. */
  pending: boolean;
  /** Han llegado datos de otro dispositivo que la pantalla abierta aún no enseña. */
  newData: boolean;
  error: string | null;
};

type Meta = { fileId: string; version: string; lastSyncAt: string };

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
  ) {
    this.state = { status: "idle", lastSyncAt: this.meta()?.lastSyncAt ?? null, pending: false, newData: false, error: null };
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
        do {
          this.again = false;
          await this.once();
        } while (this.again);
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
      const t = token.accessToken;
      const [s] = await this.db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state");
      const dirty = s!.changes > s!.pushed;
      const files = await listFiles(t);
      const meta = this.meta();
      let pulled = 0;

      if (!files.length) {
        // Primera vez: la copia de este dispositivo es la de la nube.
        const snap = await this.db.snapshot();
        const f = await createFile(t, snap.bytes);
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
            const r = await this.own(async () => this.db.merge(await download(t, f.id)));
            pulled += r.pulled;
            needUpload ||= r.needUpload;
          }
          if (!needUpload) await this.markPushed(s!.changes);
        }
        let version = main!.version;
        if (needUpload) {
          const snap = await this.db.snapshot();
          version = (await updateFile(t, main!.id, snap.bytes)).version;
          await this.markPushed(snap.changes);
          for (const f of extra) await deleteFile(t, f.id);
        }
        this.saveMeta({ fileId: main!.id, version, lastSyncAt: new Date().toISOString() });
      }
      await this.refreshPending();
      this.set({ status: "idle", lastSyncAt: this.meta()!.lastSyncAt, newData: this.state.newData || pulled > 0 });
    } catch (e) {
      if (e instanceof AuthError) {
        clearToken();
        this.set({ status: "needs-auth" });
      } else if (!navigator.onLine || (e instanceof TypeError && /fetch|network|load failed/i.test(e.message))) {
        this.set({ status: "offline" }); // fetch sin red
      } else {
        this.set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  private markPushed(changes: number) {
    return this.own(() => this.db.transaction([{ sql: "update sync_state set pushed = max(pushed, ?)", bind: [changes] }]));
  }
}
