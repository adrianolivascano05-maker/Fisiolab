// Bases de versiones antiguas (src/data/fixtures/v*.sqlite3): se abren, se migran hasta la última versión y antes de
// tocarlas se guarda una copia (engine.ts, Storage.backups). Las fixtures se generan con el propio motor: una base en
// la versión N con un paciente. Para regenerarlas (si cambia alguna migración antigua, que no debería):
//   MAKE_FIXTURES=1 npx vitest run src/data/oldVersions.test.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { describe, expect, it } from "vitest";
import { backupName, Engine, type BackupStore } from "./engine";
import { migrations } from "./migrations";
import type { BackupInfo } from "./protocol";

const VERSIONS = [8, 20, 33, 34];
const LATEST = Math.max(...migrations.map((m) => m.version));
const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixture = (v: number) => `${dir}v${String(v).padStart(3, "0")}.sqlite3`;
let counter = 0;

/** Un almacén de copias de mentira: lo que se guarda, en memoria. */
function fakeBackups() {
  const saved = new Map<string, Uint8Array>();
  const store: BackupStore = {
    save: async (name, bytes) => void saved.set(name, bytes),
    list: async () => [...saved].map(([name, b]): BackupInfo => ({ name, size: b.byteLength, at: null })),
    read: async (name) => saved.get(name)!,
  };
  return { store, saved };
}

/** Abre un motor sobre `bytes` (o una base vacía), con las migraciones hasta `upTo`. */
async function open(bytes: Uint8Array | null, upTo = LATEST, backups?: BackupStore) {
  const sqlite3 = await sqlite3InitModule();
  const file = `/old-${counter++}.sqlite3`;
  if (bytes) sqlite3.capi.sqlite3_js_posix_create_file(file, bytes);
  const engine = new Engine(sqlite3, { persistent: false, open: () => new sqlite3.oo1.DB(file, "c"), backups }, migrations.filter((m) => m.version <= upTo));
  await engine.backupDone;
  return { engine, sqlite3 };
}

const userVersion = async (engine: Engine) => ((await engine.handle({ op: "info" })) as { schemaVersion: number }).schemaVersion;

describe("bases de versiones antiguas", () => {
  if (process.env.MAKE_FIXTURES) {
    it("genera las fixtures", async () => {
      mkdirSync(dir, { recursive: true });
      for (const v of VERSIONS) {
        const { engine } = await open(null, v);
        const t = "2026-10-01T09:00:00.000Z";
        await engine.handle({ op: "transaction", statements: [{ sql: "insert into patients (id, name, notes, created_at, updated_at) values (?, ?, ?, ?, ?)", bind: [`fixture-v${v}`, `Paciente de la versión ${v}`, "", t, t] }] });
        expect(await userVersion(engine)).toBe(v);
        // Compacta (páginas pequeñas y sin huecos): el archivo guarda solo lo que hay.
        await engine.handle({ op: "query", sql: "pragma page_size = 1024" });
        await engine.handle({ op: "query", sql: "vacuum" });
        writeFileSync(fixture(v), (await engine.handle({ op: "export" })) as Uint8Array);
      }
    });
    return;
  }

  it.each(VERSIONS)("la base de la versión %i se migra hasta la última y antes se guarda tal como estaba", async (v) => {
    expect(existsSync(fixture(v)), fixture(v)).toBe(true);
    const bytes = new Uint8Array(readFileSync(fixture(v)));
    const { store, saved } = fakeBackups();
    const { engine } = await open(bytes, LATEST, store);
    expect(await userVersion(engine)).toBe(LATEST);
    expect((await engine.handle({ op: "query", sql: "select name from patients" })) as unknown[]).toEqual([{ name: `Paciente de la versión ${v}` }]);
    if (v === LATEST) {
      // Ya estaba al día: nada que migrar, ninguna copia.
      expect(saved.size).toBe(0);
      return;
    }
    // La copia de antes: la base tal como estaba, en su versión y con su paciente.
    expect([...saved.keys()]).toEqual([backupName(v, LATEST)]);
    const { engine: before } = await open(saved.get(backupName(v, LATEST))!, v);
    expect(await userVersion(before)).toBe(v);
    expect((await before.handle({ op: "query", sql: "select name from patients" })) as unknown[]).toEqual([{ name: `Paciente de la versión ${v}` }]);
    expect(await engine.handle({ op: "backups" })).toEqual([{ name: backupName(v, LATEST), size: saved.get(backupName(v, LATEST))!.byteLength, at: null }]);
  });

  it("una base nueva o ya al día no deja copia; la copia de la nube se migra sin guardar nada", async () => {
    const { store, saved } = fakeBackups();
    const { engine } = await open(null, LATEST, store);
    expect(saved.size).toBe(0);
    const again = await open((await engine.handle({ op: "export" })) as Uint8Array, LATEST, store);
    expect(await userVersion(again.engine)).toBe(LATEST);
    expect(saved.size).toBe(0);
    // Juntar una copia antigua de la nube: se migra en memoria, sin copia previa (es de otro dispositivo).
    await engine.handle({ op: "merge", bytes: new Uint8Array(readFileSync(fixture(20))) });
    expect(saved.size).toBe(0);
    expect((await engine.handle({ op: "query", sql: "select count(*) as n from patients" })) as unknown[]).toEqual([{ n: 1 }]);
  });
});
