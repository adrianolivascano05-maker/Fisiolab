import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveKeyBytes, forgetKey, newRecoveryCode, newSalt, sealForRecovery, storeKey } from "../cloud/crypt";
import { clearLock, setLockScope, setPin } from "./pin";
import { checkClinicPassword, checkRecoveryCode, PROOF_MAX_FAILS, proofNeeded, proofWaitUntil } from "./pinProof";

const recovery = { blob: null as string | null };
vi.mock("../cloud/auth", () => ({ getToken: () => ({ accessToken: "t", expiresAt: Date.now() + 3_600_000 }) }));
vi.mock("../cloud/clinic", () => ({ clinicApi: () => ({ getRecovery: async () => recovery.blob }) }));

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

const SUB = "cuenta-a";
const SCOPE = "cuenta-a.c1";
const PASSWORD = "frase de la clínica 2026";

describe("demostrar que se puede abrir la clínica antes de poner un PIN nuevo", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("navigator", { onLine: true });
    setLockScope(SUB);
    recovery.blob = null;
  });
  afterEach(async () => {
    clearLock(true);
    await forgetKey(SCOPE);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** La clave de la clínica, guardada en este dispositivo como al escribir la contraseña (sync.ts). */
  async function keyStored(password = PASSWORD, salt = newSalt()) {
    const k = await deriveKeyBytes(password, salt);
    await storeKey(SCOPE, salt, k.key);
    return { salt, raw: k.raw };
  }

  it("la primera vez en el dispositivo no hay nada que demostrar; con PIN y clave, la contraseña; con PIN y sin clave, solo borrar", async () => {
    expect(await proofNeeded(SUB, SCOPE)).toBe("none");
    await setPin("2580");
    expect(await proofNeeded(SUB, SCOPE)).toBe("wipe");
    await keyStored();
    expect(await proofNeeded(SUB, SCOPE)).toBe("password");
    // Alguien borra el PIN del navegador: la marca sigue y hay que demostrarlo igual.
    clearLock();
    expect(await proofNeeded(SUB, SCOPE)).toBe("password");
    expect(await proofNeeded(SUB, null)).toBe("wipe");
  });

  it("la contraseña de la clínica se comprueba con la clave guardada, sin conexión", async () => {
    await keyStored();
    expect(await checkClinicPassword(SCOPE, "otra contraseña larga")).toBe(false);
    expect(await checkClinicPassword(SCOPE, PASSWORD)).toBe(true);
    expect(await checkClinicPassword("otra.c9", PASSWORD)).toBe(false);
  });

  it("tras 5 fallos hay que esperar 30 s, el doble cada vez; mientras, ni la buena vale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
    await keyStored();
    for (let i = 0; i < PROOF_MAX_FAILS; i++) expect(await checkClinicPassword(SCOPE, "mala mala mala")).toBe(false);
    expect(proofWaitUntil(SCOPE)).toBe(Date.now() + 30_000);
    expect(await checkClinicPassword(SCOPE, PASSWORD)).toBe(false);
    vi.setSystemTime(new Date("2026-10-30T10:00:31Z"));
    expect(await checkClinicPassword(SCOPE, "mala mala mala")).toBe(false);
    expect(proofWaitUntil(SCOPE)).toBe(Date.now() + 60_000);
    vi.setSystemTime(new Date("2026-10-30T10:02:00Z"));
    expect(await checkClinicPassword(SCOPE, PASSWORD)).toBe(true);
    expect(proofWaitUntil(SCOPE)).toBe(0);
  });

  it("el código de recuperación abre la clave del servidor y se compara con la guardada", async () => {
    const { salt, raw } = await keyStored();
    const code = newRecoveryCode();
    recovery.blob = await sealForRecovery(raw, salt, code);
    expect(await checkRecoveryCode("https://servidor", "1", SCOPE, "AAAAA-BBBBB-CCCCC-DDDDD")).toBe(false);
    expect(proofWaitUntil(SCOPE)).toBe(0);
    expect(await checkRecoveryCode("https://servidor", "1", SCOPE, code)).toBe(true);
  });

  it("un código de una contraseña anterior, sin conexión o sin código en el servidor: lo dice claro", async () => {
    const { raw } = await keyStored();
    const code = newRecoveryCode();
    recovery.blob = await sealForRecovery(raw, newSalt(), code);
    await expect(checkRecoveryCode("https://servidor", "1", SCOPE, code)).rejects.toThrow("Ese código es de una contraseña anterior.");
    recovery.blob = null;
    await expect(checkRecoveryCode("https://servidor", "1", SCOPE, code)).rejects.toThrow("no tiene código de recuperación");
    vi.stubGlobal("navigator", { onLine: false });
    await expect(checkRecoveryCode("https://servidor", "1", SCOPE, code)).rejects.toThrow("hace falta conexión");
  });
});
