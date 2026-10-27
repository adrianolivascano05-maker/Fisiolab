// La copia de la clínica en el servidor de Cloudflare (remote.ts): por trozos a R2 si el servidor lo dice, o entera en
// base64 como antes. fetch sustituido por un servidor de mentira que apunta lo que le llega.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareStore, RemoteConflict, ServerError } from "./remote";
import { shouldCompact } from "./sync";

const BASE = "https://cenit-datos.pruebas.workers.dev";
const token = { accessToken: "tok", expiresAt: Date.now() + 3_600_000 };
const pieces = (size: number) => {
  const b = new Uint8Array(size).fill(7);
  b.set(new TextEncoder().encode("CENITENC2"), 0);
  return b;
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Seen = { method: string; path: string; body?: Uint8Array | string; headers: Headers };
function server(answer: (r: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const r: Seen = { method: init.method ?? "GET", path: u.pathname + u.search, body: init.body as Seen["body"], headers: new Headers(init.headers) };
    seen.push(r);
    return answer(r);
  });
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("copia de la clínica en el servidor", () => {
  it("con almacén R2: la copia por trozos del tamaño que dice el servidor, y al final cuánto ocupa", async () => {
    const seen = server((r) => {
      if (r.path.includes("/info")) return json({ version: null, pieces: true, last: 0, epoch: null, base: null, deltas: 0, deltaSize: 0 });
      if (r.method === "POST" && r.path.includes("/subida?")) return json({ version: "v-nueva", upload: "sub/1", partBytes: 1000 });
      if (r.method === "PUT") return json({ part: Number(/\/(\d+)\?/.exec(r.path)![1]), etag: `e${(r.body as Uint8Array).byteLength}` });
      return json({ version: "v-nueva", epoch: "ep", base: 4 });
    });
    const store = cloudflareStore(BASE, "c1");
    expect(store.pieces).toBe(false);
    await store.deltas!.info(token);
    expect(store.pieces).toBe(true);
    const copy = await store.create(token, pieces(2500), 4);
    expect(copy).toEqual({ id: "copia", version: "v-nueva", epoch: "ep", base: 4 });
    const puts = seen.filter((r) => r.method === "PUT");
    expect(puts.map((r) => r.path)).toEqual([1, 2, 3].map((n) => `/v1/clinicas/c1/copia/subida/v-nueva/${n}?v=2&trozos=1&id=sub%2F1`));
    expect(puts.map((r) => (r.body as Uint8Array).byteLength)).toEqual([1000, 1000, 500]);
    const fin = seen.at(-1)!;
    expect(fin.path).toBe("/v1/clinicas/c1/copia/subida/v-nueva/fin?v=2&trozos=1&id=sub%2F1&seq=4");
    expect(fin.headers.get("If-None-Match")).toBe("*");
    expect(JSON.parse(fin.body as string)).toEqual({ parts: [1, 2, 3].map((n) => ({ part: n, etag: `e${n === 3 ? 500 : 1000}` })), size: 2500 });
  });

  it("un trozo que falla por la red o el servidor se reintenta; si sigue fallando, se deja la subida", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 });
    let fails = 1;
    const seen = server((r) => {
      if (r.method === "POST" && r.path.includes("/subida?")) return json({ version: "v2", upload: "u", partBytes: 1000 });
      if (r.method === "PUT") {
        if (fails-- > 0) throw new TypeError("Failed to fetch");
        return json({ part: 1, etag: "e" });
      }
      if (r.method === "DELETE") return new Response(null, { status: 204 });
      return json({ version: "v2" });
    });
    const store = cloudflareStore(BASE, "c1");
    await store.update(token, { id: "copia", version: "v1" }, pieces(800), 0);
    expect(seen.filter((r) => r.method === "PUT").length).toBe(2);
    expect(seen.at(-1)!.headers.get("If-Match")).toBe('"v1"');

    // Siempre 503: tres intentos y se deja la subida (el servidor borra los trozos).
    fails = 99;
    seen.length = 0;
    await expect(store.update(token, { id: "copia", version: "v1" }, pieces(800), 0)).rejects.toBeInstanceOf(TypeError);
    expect(seen.filter((r) => r.method === "PUT").length).toBe(3);
    expect(seen.at(-1)!.method).toBe("DELETE");
    expect(seen.at(-1)!.path).toBe("/v1/clinicas/c1/copia/subida/v2?v=2&trozos=1&id=u");
  });

  it("si otro dispositivo ha subido antes, RemoteConflict (sin reintentar); un 4xx tampoco se reintenta", async () => {
    server((r) => (r.method === "POST" ? json({ error: "La copia ha cambiado." }, 412) : json({})));
    await expect(cloudflareStore(BASE, "c1").update(token, { id: "copia", version: "v1" }, pieces(800), 0)).rejects.toBeInstanceOf(RemoteConflict);
    const seen = server((r) => {
      if (r.method === "POST") return json({ version: "v2", upload: "u", partBytes: 1000 });
      if (r.method === "PUT") return json({ error: "Solo se guardan copias cifradas." }, 415);
      return new Response(null, { status: 204 });
    });
    await expect(cloudflareStore(BASE, "c1").update(token, { id: "copia", version: "v1" }, pieces(800), 0)).rejects.toBeInstanceOf(ServerError);
    expect(seen.filter((r) => r.method === "PUT").length).toBe(1);
  });

  it("sin almacén (o la copia de una pieza), entera en base64 como antes; al bajarla, bytes o base64 según venga", async () => {
    const seen = server((r) => {
      if (r.method === "PUT") return json({ version: "v3", epoch: "ep", base: 0 });
      if (r.path.endsWith("?v=2&trozos=1")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "application/octet-stream" } });
      return new Response(btoa("\u0004\u0005"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    });
    const store = cloudflareStore(BASE, "c1");
    const one = new TextEncoder().encode("CENITENC1 copia");
    await store.update(token, { id: "copia", version: "v2" }, one, 9);
    expect(seen[0]!.path).toBe("/v1/clinicas/c1/copia?v=2&trozos=1&seq=9");
    expect(seen[0]!.body).toBe(btoa("CENITENC1 copia"));
    expect(await store.download(token, { id: "copia", version: "v3" })).toEqual(new Uint8Array([1, 2, 3]));
    expect(await cloudflareStore(BASE).download(token, { id: "copia", version: "v3" })).toEqual(new Uint8Array([4, 5]));
  });
});

describe("cuándo se resume (copia entera nueva)", () => {
  it("con una copia pequeña, a los 200 lotes o 2 MB; con una grande se espera más", () => {
    expect(shouldCompact(1_000_000, 199, 0)).toBe(false);
    expect(shouldCompact(1_000_000, 200, 0)).toBe(true);
    expect(shouldCompact(1_000_000, 10, 2 * 1024 * 1024)).toBe(true);
    // 54 MB (10.000 pacientes): a los 1.000 lotes o al 10 % de la copia.
    const big = 54 * 1024 * 1024;
    expect(shouldCompact(big, 999, 5 * 1024 * 1024)).toBe(false);
    expect(shouldCompact(big, 1000, 0)).toBe(true);
    expect(shouldCompact(big, 10, big / 10)).toBe(true);
  });
});
