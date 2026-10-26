// Los archivos del paciente: cifrados en el dispositivo, subidos al servidor (uno de mentira), abiertos de aquí o de
// allí, borrados también allí y dentro de la exportación completa.
import { describe, expect, it } from "vitest";
import type { Token } from "../cloud/auth";
import { ServerError } from "../cloud/remote";
import { getDocument, listDocuments, pendingUploads, trashedDocuments, deleteDocument } from "../data/documents";
import { createPatient, deletePatient } from "../data/repo";
import { createTestDb } from "../data/testDb";
import { readZip } from "../data/xlsx";
import { buildPackage } from "../export/fullExport";
import { cacheGet, cacheKeys } from "./cache";
import { isSealedDoc } from "./docCrypto";
import { addPatientFiles, freeDeviceSpace, readDocument, syncDocuments, type DocsServer } from "./docSync";

const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n${text}\n%%EOF`);
const token: Token = { accessToken: "t", expiresAt: Date.now() + 3_600_000 } as Token;

/** Un servidor de mentira: guarda lo que le suben (solo cifrado) y puede estar lleno o sin conexión. */
function fakeServer() {
  const stored = new Map<string, Uint8Array<ArrayBuffer>>();
  const state = { offline: false, full: false };
  const fail = () => {
    if (state.offline) throw new TypeError("Failed to fetch");
  };
  const server: DocsServer = {
    clinicId: "c1",
    token: () => token,
    api: {
      usage: async () => ({ enabled: true, count: stored.size, used: 0, total: 0, cap: 10e9, warnAt: 8e9, maxBytes: 5 * 1024 * 1024 }),
      put: async (_t, _c, id, bytes) => {
        fail();
        if (state.full) throw new ServerError("lleno", 507);
        expect(isSealedDoc(bytes)).toBe(true);
        stored.set(id, new Uint8Array(bytes));
      },
      get: async (_t, _c, id) => {
        fail();
        const b = stored.get(id);
        if (!b) throw new ServerError("no está", 404);
        return b;
      },
      remove: async (_t, _c, id) => {
        fail();
        stored.delete(id);
      },
      keep: async () => {},
    },
  };
  return { server, stored, state };
}

async function setup() {
  const db = await createTestDb();
  const pid = await createPatient(db, { name: "Lucía Pérez", birthDate: "1985-03-12", sex: "female", bodyMassKg: 60, heightCm: 165, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
  return { db, pid, space: `prueba-${Math.random()}` };
}

describe("archivos del paciente", () => {
  it("se cifran, se guardan aquí y se suben; se abren de aquí o del servidor", async () => {
    const { db, pid, space } = await setup();
    const { server, stored } = fakeServer();
    const r = await addPatientFiles(db, space, server, pid, [{ name: "Resonancia rodilla", bytes: pdf("RM"), mime: "application/pdf" }]);
    expect(r).toEqual({ ids: [expect.any(String)], uploaded: 1, full: false });
    const [doc] = await listDocuments(db, pid);
    expect(doc).toMatchObject({ name: "Resonancia rodilla", size: pdf("RM").byteLength, source: "clinic", uploadedAt: expect.any(String) });
    // Ni aquí ni en el servidor está sin cifrar.
    expect(isSealedDoc((await cacheGet(space, doc!.id))!)).toBe(true);
    expect(stored.has(doc!.id)).toBe(true);
    expect(await readDocument(space, server, doc!)).toEqual(pdf("RM"));
    // Otro dispositivo (sin nada aquí) lo baja del servidor.
    expect(await readDocument(`${space}-otro`, server, doc!)).toEqual(pdf("RM"));
  });

  it("sin conexión se quedan aquí y se suben en la siguiente vuelta; con el almacén lleno, esperan", async () => {
    const { db, pid, space } = await setup();
    const { server, stored, state } = fakeServer();
    state.offline = true;
    const r = await addPatientFiles(db, space, server, pid, [
      { name: "Informe", bytes: pdf("A"), mime: "application/pdf" },
      { name: "Analítica", bytes: pdf("B"), mime: "application/pdf" },
    ]);
    expect(r.uploaded).toBe(0);
    expect(await pendingUploads(db)).toHaveLength(2);
    state.offline = false;
    state.full = true;
    expect(await syncDocuments(db, space, server)).toEqual({ uploaded: 0, deleted: 0, full: true });
    state.full = false;
    expect(await syncDocuments(db, space, server)).toEqual({ uploaded: 2, deleted: 0, full: false });
    expect(await pendingUploads(db)).toHaveLength(0);
    expect(stored.size).toBe(2);
  });

  it("lo pendiente de otro dispositivo no se sube desde aquí, y sin subir no se puede abrir aquí", async () => {
    const { db, pid, space } = await setup();
    const { server, state } = fakeServer();
    state.offline = true;
    await addPatientFiles(db, space, server, pid, [{ name: "Informe", bytes: pdf("A"), mime: "application/pdf" }]);
    state.offline = false;
    const [doc] = await listDocuments(db, pid);
    expect(await syncDocuments(db, `${space}-otro`, server)).toEqual({ uploaded: 0, deleted: 0, full: false });
    await expect(readDocument(`${space}-otro`, server, doc!)).rejects.toThrow(/aún no está en el servidor/);
  });

  it("al borrar un archivo o el paciente se borran también del servidor (y de aquí)", async () => {
    const { db, pid, space } = await setup();
    const { server, stored } = fakeServer();
    await addPatientFiles(db, space, server, pid, [
      { name: "Uno", bytes: pdf("1"), mime: "application/pdf" },
      { name: "Dos", bytes: pdf("2"), mime: "application/pdf" },
    ]);
    const [first] = await listDocuments(db, pid);
    await deleteDocument(db, first!.id);
    expect(await trashedDocuments(db)).toEqual([first!.id]);
    await deletePatient(db, pid);
    expect(await trashedDocuments(db)).toHaveLength(2);
    expect(await syncDocuments(db, space, server)).toEqual({ uploaded: 0, deleted: 2, full: false });
    expect(stored.size).toBe(0);
    expect(await cacheKeys(space)).toEqual([]);
    expect(await trashedDocuments(db)).toEqual([]);
  });

  it("liberar espacio en el dispositivo deja los pendientes de subir", async () => {
    const { db, pid, space } = await setup();
    const { server, state } = fakeServer();
    await addPatientFiles(db, space, server, pid, [{ name: "Subido", bytes: pdf("S"), mime: "application/pdf" }]);
    state.offline = true;
    await addPatientFiles(db, space, server, pid, [{ name: "Pendiente", bytes: pdf("P"), mime: "application/pdf" }]);
    expect(await freeDeviceSpace(db, space)).toBe(1);
    const [pending] = await pendingUploads(db);
    expect(await cacheKeys(space)).toEqual([pending!.id]);
  });

  it("la exportación completa lleva cada archivo abierto, en la carpeta de su paciente, sin su clave", async () => {
    const { db, pid, space } = await setup();
    const { server, state } = fakeServer();
    await addPatientFiles(db, space, server, pid, [
      { name: "Resonancia: rodilla/derecha", bytes: pdf("RM"), mime: "application/pdf" },
      { name: "Resonancia: rodilla/derecha", bytes: pdf("RM2"), mime: "application/pdf" },
    ]);
    const files = async (id: string) => {
      const d = await getDocument(db, id);
      return d ? readDocument(space, server, d) : null;
    };
    const { bytes, missing } = await buildPackage(db, { files });
    expect(missing).toBe(0);
    const zip = await readZip(bytes);
    const names = [...zip.keys()];
    expect(names).toContain("Archivos de pacientes/Lucía Pérez/Resonancia rodilla derecha.pdf");
    expect(names).toContain("Archivos de pacientes/Lucía Pérez/Resonancia rodilla derecha (2).pdf");
    expect(zip.get("Archivos de pacientes/Lucía Pérez/Resonancia rodilla derecha.pdf")).toEqual(pdf("RM"));
    const history = new TextDecoder().decode(zip.get("Historias clinicas/Lucía Pérez.html"));
    expect(history).toContain("Archivos del paciente");
    expect(history).toContain('href="../Archivos%20de%20pacientes/Luc%C3%ADa%20P%C3%A9rez/Resonancia%20rodilla%20derecha.pdf"');
    const json = new TextDecoder().decode(zip.get("Datos para otro programa (JSON).json"));
    expect(json).toContain("Resonancia: rodilla/derecha");
    expect(json).not.toContain("doc_key");
    // Sin conexión y sin nada aquí: la historia dice que no se pudo incluir.
    state.offline = true;
    const other = await buildPackage(db, { files: async (id) => { const d = await getDocument(db, id); return d ? readDocument(`${space}-otro`, server, d) : null; } });
    expect(other.missing).toBe(2);
    expect(new TextDecoder().decode((await readZip(other.bytes)).get("LEEME.txt"))).toContain("2 archivos no se han podido incluir");
  });
});
