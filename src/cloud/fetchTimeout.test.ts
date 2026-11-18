// Peticiones con tiempo máximo (fetchTimeout.ts): una conexión parada no deja la sincronización colgada.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RESPONSE_TIMEOUT_MS, timeoutFor } from "./fetchTimeout";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Un servidor que nunca contesta (solo se rinde si le cancelan la petición). */
const silent = () =>
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));

describe("peticiones con tiempo máximo", () => {
  it("sin respuesta, al pasar el tiempo, el mismo error que un corte de red", async () => {
    vi.useFakeTimers();
    silent();
    const p = fetchWithTimeout("https://servidor.test/v1/x");
    const check = expect(p).rejects.toThrow(/Failed to fetch.*tiempo agotado/);
    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS + 10);
    await check;
    vi.useRealTimers();
    await expect(fetchWithTimeout("https://servidor.test/v1/x", {}, 10).catch((e) => e)).resolves.toBeInstanceOf(TypeError);
  });

  it("con respuesta a tiempo, la respuesta; un cuerpo grande tiene más margen", async () => {
    vi.stubGlobal("fetch", async () => new Response("ok"));
    expect(await (await fetchWithTimeout("https://servidor.test/v1/x")).text()).toBe("ok");
    expect(timeoutFor(new Uint8Array(8 * 1024 * 1024))).toBeGreaterThan(RESPONSE_TIMEOUT_MS + 400_000);
    expect(timeoutFor(undefined)).toBe(RESPONSE_TIMEOUT_MS);
  });

  it("si quien llama cancela, su cancelación (no un «tiempo agotado»)", async () => {
    silent();
    const outer = new AbortController();
    const p = fetchWithTimeout("https://servidor.test/v1/x", { signal: outer.signal });
    outer.abort();
    await expect(p).rejects.toThrow(/Aborted/);
  });
});
