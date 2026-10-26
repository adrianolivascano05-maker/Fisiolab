// Los archivos del paciente en este dispositivo, cifrados (docCrypto.ts): los que se acaban de añadir, hasta que se
// suben al servidor, y los que se han abierto, para volver a abrirlos sin conexión. En IndexedDB, aparte de la base y
// uno por clínica y cuenta (`space`, src/cloud/clinic.ts clinicScope): al borrar los datos de una clínica de este
// dispositivo se borran sus archivos y no los de otra. Sin IndexedDB (pruebas en Node), solo mientras dure la página.

const memory = new Map<string, Map<string, Uint8Array>>();
const opened = new Map<string, Promise<IDBDatabase>>();
const hasIdb = () => typeof indexedDB !== "undefined";
const dbName = (space: string) => `cenit-archivos.${space}`;

function open(space: string): Promise<IDBDatabase> {
  let p = opened.get(space);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName(space), 1);
      req.onupgradeneeded = () => req.result.createObjectStore("archivos");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    opened.set(space, p);
  }
  return p;
}

async function store<T>(space: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open(space);
  return new Promise((resolve, reject) => {
    const req = run(db.transaction("archivos", mode).objectStore("archivos"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const mem = (space: string) => {
  let m = memory.get(space);
  if (!m) memory.set(space, (m = new Map()));
  return m;
};

export async function cachePut(space: string, id: string, sealed: Uint8Array): Promise<void> {
  if (!hasIdb()) {
    mem(space).set(id, sealed);
    return;
  }
  await store(space, "readwrite", (s) => s.put(sealed, id));
}

export async function cacheGet(space: string, id: string): Promise<Uint8Array | null> {
  if (!hasIdb()) return mem(space).get(id) ?? null;
  const found = await store<unknown>(space, "readonly", (s) => s.get(id));
  return found instanceof Uint8Array ? found : found instanceof ArrayBuffer ? new Uint8Array(found) : null;
}

export async function cacheDelete(space: string, id: string): Promise<void> {
  if (!hasIdb()) {
    mem(space).delete(id);
    return;
  }
  await store(space, "readwrite", (s) => s.delete(id));
}

/** Los ids que hay guardados aquí. */
export async function cacheKeys(space: string): Promise<string[]> {
  if (!hasIdb()) return [...mem(space).keys()];
  return (await store<IDBValidKey[]>(space, "readonly", (s) => s.getAllKeys())).map(String);
}

/** Todos los de esta clínica fuera (al borrar sus datos de este dispositivo). */
export async function cacheDrop(space: string): Promise<void> {
  memory.delete(space);
  if (!hasIdb()) return;
  const db = opened.get(space);
  opened.delete(space);
  if (db) (await db.catch(() => null))?.close();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(dbName(space));
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
