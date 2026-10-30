import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPin, clearLock, failCount, getLock, isPin, MAX_FAILS, pinWasSet, setLockScope, setPin, syncFailsFromDevice, waitUntil } from "./pin";

// Un almacenamiento en memoria en lugar del del navegador (sin IndexedDB: crypt.ts guarda lo del dispositivo en memoria).
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

describe("PIN del dispositivo", () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    setLockScope(null);
  });
  afterEach(() => {
    clearLock(true);
    setLockScope("cuenta-a");
    clearLock(true);
    setLockScope(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("acepta de 4 a 8 cifras", () => {
    expect(isPin("2580")).toBe(true);
    expect(isPin("12345678")).toBe(true);
    expect(isPin("123")).toBe(false);
    expect(isPin("12a4")).toBe(false);
  });

  it("guarda solo una huella y comprueba el PIN", async () => {
    await setPin("2580");
    expect(storage.keys().some((k) => storage.getItem(k)!.includes("2580"))).toBe(false);
    expect(getLock()?.length).toBe(4);
    expect(await checkPin("2580")).toBe(true);
    expect(await checkPin("0000")).toBe(false);
    expect(failCount()).toBe(1);
    expect(await checkPin("2580")).toBe(true);
    expect(failCount()).toBe(0);
  });

  it("tras 5 fallos hay que esperar 30 s, y el doble con cada fallo más; mientras, ni el PIN bueno entra", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
    await setPin("2580");
    for (let i = 0; i < MAX_FAILS; i++) expect(await checkPin("0000")).toBe(false);
    expect(waitUntil()).toBe(Date.now() + 30_000);
    expect(await checkPin("2580")).toBe(false);
    expect(failCount()).toBe(MAX_FAILS);
    vi.setSystemTime(new Date("2026-10-30T10:00:31Z"));
    expect(waitUntil()).toBe(0);
    expect(await checkPin("0000")).toBe(false);
    expect(waitUntil()).toBe(Date.now() + 60_000);
    vi.setSystemTime(new Date("2026-10-30T10:02:00Z"));
    expect(await checkPin("2580")).toBe(true);
    expect(waitUntil()).toBe(0);
  });

  it("el contador de fallos se recuerda en el dispositivo aunque alguien borre localStorage", async () => {
    await setPin("2580");
    await checkPin("0000");
    await checkPin("0000");
    expect(failCount()).toBe(2);
    storage.removeItem("fisiolab.lock.fails");
    expect(failCount()).toBe(0);
    await syncFailsFromDevice();
    expect(failCount()).toBe(2);
  });

  it("recuerda que aquí hubo PIN hasta que se quita a propósito en Ajustes", async () => {
    setLockScope("cuenta-a");
    expect(await pinWasSet("cuenta-a")).toBe(false);
    await setPin("2580");
    expect(await pinWasSet("cuenta-a")).toBe(true);
    // Borrarlo del navegador (o quitarlo tras olvidarlo) no borra la marca.
    clearLock();
    expect(getLock()).toBeNull();
    expect(await pinWasSet("cuenta-a")).toBe(true);
    // Quitarlo en Ajustes, sí.
    clearLock(true);
    expect(await pinWasSet("cuenta-a")).toBe(false);
    expect(await pinWasSet("cuenta-b")).toBe(false);
  });

  it("el PIN de antes (del dispositivo) pasa a ser de la primera cuenta que entra", async () => {
    await setPin("1357");
    expect(storage.getItem("fisiolab.lock")).not.toBeNull();
    setLockScope("cuenta-a");
    expect(getLock()?.length).toBe(4);
    expect(storage.getItem("fisiolab.lock")).toBeNull();
    expect(storage.getItem("fisiolab.lock.cuenta-a")).not.toBeNull();
    expect(await checkPin("1357")).toBe(true);
    // Otra cuenta en el mismo dispositivo empieza sin PIN.
    setLockScope("cuenta-b");
    expect(getLock()).toBeNull();
  });
});
