// Pruebas del servidor de datos (worker.js) con una D1 de prueba sobre SQLite WASM (d1shim.ts) y una Google
// simulada: verifyToken de mentira o, para la comprobación de verdad con Google, fetch sustituido.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createD1, type D1Shim, type D1Statement } from "./d1shim";
import { handle } from "./worker.js";

const CLIENT_ID = "1234-abc.apps.googleusercontent.com";
const APP = "https://adrianolivascano05-maker.github.io";
const BASE = "https://cenit-datos.ejemplo.workers.dev";

type User = { sub: string; email: string };
const USERS: Record<string, User> = {
  "tok-ana": { sub: "111", email: "ana@clinica.es" },
  "tok-luis": { sub: "222", email: "Luis@Clinica.es" },
  "tok-intrusa": { sub: "333", email: "intrusa@otra.es" },
};

let db: D1Shim;
let verifyToken: Mock<(token: string) => Promise<User>>;

const env = (over: Record<string, unknown> = {}) => ({
  DB: db,
  GOOGLE_CLIENT_ID: CLIENT_ID,
  ALLOWED_EMAILS: "ana@clinica.es,  luis@clinica.es",
  ALLOWED_ORIGINS: `${APP},http://localhost:5173`,
  ...over,
});

type Opts = { token?: string; body?: string; headers?: Record<string, string> };
function request(method: string, path: string, { token, body, headers = {} }: Opts = {}) {
  return new Request(BASE + path, {
    method,
    body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "text/plain" } : {}),
      ...headers,
    },
  });
}

const call = (method: string, path: string, opts?: Opts, over?: Record<string, unknown>) =>
  handle(request(method, path, opts), env(over), { verifyToken });

/**
 * Una copia «cifrada» de `size` bytes, en base64 como la envía la app: CENITENC1 y luego bytes que no se repiten
 * en cada trozo.
 */
function encrypted(size: number, seed = 1) {
  const bytes = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    bytes[i] = x >>> 24;
  }
  bytes.set(new TextEncoder().encode("CENITENC1"), 0);
  return Buffer.from(bytes).toString("base64");
}

/** Los bytes (aproximados) que el servidor dice que tiene una copia en base64. */
const approxBytes = (text: string) => Math.floor((text.length * 3) / 4);

/** El mismo texto (sin que un fallo imprima megas de diferencias). */
const same = (a: string, b: string) => a === b;

const put = (token: string, body: string, precondition: Record<string, string>) =>
  call("PUT", "/v1/copia", { token, body, headers: precondition });

async function count(sql: string, ...params: unknown[]) {
  const row = await db.prepare(sql).bind(...params).first();
  return Number(row?.n);
}

beforeEach(async () => {
  db = await createD1();
  verifyToken = vi.fn(async (token: string) => {
    const user = USERS[token];
    if (!user) throw new Error("token desconocido");
    return user;
  });
});

describe("salud", () => {
  it("responde sin sesión y sin preguntar a Google", async () => {
    const res = await call("GET", "/v1/salud");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("dice qué falta en la instalación", async () => {
    const res = await call("GET", "/v1/salud", {}, { DB: undefined, ALLOWED_EMAILS: "" });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("«DB»");
    expect(body.error).toContain("ALLOWED_EMAILS");
  });

  it("avisa si faltan las tablas", async () => {
    db.db.exec("DROP TABLE parts");
    const body = (await (await call("GET", "/v1/salud")).json()) as { error: string };
    expect(body.error).toContain("schema.sql");
  });
});

describe("sesión", () => {
  it("401 sin token o con uno que no vale", async () => {
    const none = await call("GET", "/v1/copia/info");
    expect(none.status).toBe(401);
    expect(((await none.json()) as { error: string }).error).toMatch(/sesión/);
    expect((await call("GET", "/v1/copia/info", { token: "tok-falso" })).status).toBe(401);
    expect((await call("GET", "/v1/copia", { headers: { Authorization: "Basic abc" } })).status).toBe(401);
  });

  it("403 si el correo no está en la lista; sin mayúsculas que valgan", async () => {
    expect((await call("GET", "/v1/copia/info", { token: "tok-intrusa" })).status).toBe(403);
    expect((await call("GET", "/v1/copia/info", { token: "tok-luis" })).status).toBe(200);
  });

  it("con ALLOWED_EMAILS vacío no entra nadie", async () => {
    const res = await call("GET", "/v1/copia/info", { token: "tok-ana" }, { ALLOWED_EMAILS: " " });
    expect(res.status).toBe(403);
  });

  it("recuerda el token comprobado unos minutos, como mucho", async () => {
    let now = 1_000_000;
    const deps = { verifyToken, now: () => now };
    const info = () => handle(request("GET", "/v1/copia/info", { token: "tok-ana-cache" }), env(), deps);
    USERS["tok-ana-cache"] = USERS["tok-ana"]!;
    expect((await info()).status).toBe(200);
    expect((await info()).status).toBe(200);
    expect(verifyToken).toHaveBeenCalledTimes(1);
    now += 301_000;
    expect((await info()).status).toBe(200);
    expect(verifyToken).toHaveBeenCalledTimes(2);
  });
});

describe("CORS", () => {
  it("a la app le da permiso, también en la consulta previa", async () => {
    const pre = await call("OPTIONS", "/v1/copia", { headers: { Origin: APP, "Access-Control-Request-Method": "PUT" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe(APP);
    expect(pre.headers.get("Vary")).toBe("Origin");
    expect(pre.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type, If-Match, If-None-Match");
    expect(pre.headers.get("Access-Control-Allow-Methods")).toBe("GET, PUT, DELETE, OPTIONS");
    expect(pre.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(verifyToken).not.toHaveBeenCalled();

    const res = await call("GET", "/v1/copia/info", { token: "tok-ana", headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe("ETag");
  });

  it("a otra web no", async () => {
    const pre = await call("OPTIONS", "/v1/copia", { headers: { Origin: "https://malvada.example" } });
    expect(pre.status).toBe(403);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const res = await call("GET", "/v1/salud", { headers: { Origin: "https://malvada.example" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("copia", () => {
  it("sin copia: info vacía, 404 al bajarla y 404 en rutas que no existen", async () => {
    const info = await call("GET", "/v1/copia/info", { token: "tok-ana" });
    expect(info.status).toBe(200);
    expect(await info.json()).toEqual({ version: null, size: 0, updatedAt: null });
    expect((await call("GET", "/v1/copia", { token: "tok-ana" })).status).toBe(404);
    expect((await call("GET", "/v1/otra", { token: "tok-ana" })).status).toBe(404);
    expect((await call("POST", "/v1/copia", { token: "tok-ana" })).status).toBe(404);
  });

  it("crea con If-None-Match: * y solo una vez", async () => {
    const body = encrypted(5000);
    const now = Date.parse("2026-10-20T10:00:00Z");
    const res = await handle(
      request("PUT", "/v1/copia", { token: "tok-ana", body, headers: { "If-None-Match": "*" } }),
      env(),
      { verifyToken, now: () => now },
    );
    expect(res.status).toBe(200);
    const created = (await res.json()) as { version: string; size: number; updatedAt: string };
    expect(created).toEqual({ version: expect.any(String), size: approxBytes(body), updatedAt: "2026-10-20T10:00:00.000Z" });
    expect(created.size - 5000).toBeLessThanOrEqual(2);
    expect(res.headers.get("ETag")).toBe(`"${created.version}"`);

    const again = await put("tok-ana", encrypted(10), { "If-None-Match": "*" });
    expect(again.status).toBe(412);
    expect(await again.json()).toEqual({ error: expect.any(String), version: created.version });

    const info = await call("GET", "/v1/copia/info", { token: "tok-ana" });
    expect(await info.json()).toEqual(created);
    const got = await call("GET", "/v1/copia", { token: "tok-ana" });
    expect(got.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(got.headers.get("ETag")).toBe(`"${created.version}"`);
    expect(await got.text()).toBe(body);
  });

  it("428 sin condición, 415 sin cifrar y 413 si pasa de 50 MB", async () => {
    expect((await put("tok-ana", encrypted(100), {})).status).toBe(428);
    expect((await put("tok-ana", encrypted(100), { "If-None-Match": '"abc"' })).status).toBe(428);

    const plain = Buffer.from("SQLite format 3\u0000 pacientes…").toString("base64");
    const refused = await put("tok-ana", plain, { "If-None-Match": "*" });
    expect(refused.status).toBe(415);
    expect(await refused.json()).toEqual({ error: "Solo se guardan copias cifradas." });
    // Los bytes cifrados sin pasar a base64, o solo la marca, tampoco.
    expect((await put("tok-ana", "CENITENC1\u0001\u0002", { "If-None-Match": "*" })).status).toBe(415);
    expect((await put("tok-ana", "Q0VOSVRFTkMx", { "If-None-Match": "*" })).status).toBe(415);

    const max = Math.ceil((50 * 1024 * 1024) / 3) * 4;
    const tooBig = "Q0VOSVRFTkMx" + "A".repeat(max - 12 + 1);
    expect((await put("tok-ana", tooBig, { "If-None-Match": "*" })).status).toBe(413);
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(0);
  });

  it("sustituye con la versión vigente (con comillas o sin ellas) y no con una vieja", async () => {
    const first = (await (await put("tok-ana", encrypted(3000, 1), { "If-None-Match": "*" })).json()) as { version: string };

    const second = await put("tok-ana", encrypted(4000, 2), { "If-Match": `"${first.version}"` });
    expect(second.status).toBe(200);
    const v2 = ((await second.json()) as { version: string }).version;
    expect(v2).not.toBe(first.version);

    const stale = await put("tok-ana", encrypted(4000, 3), { "If-Match": `"${first.version}"` });
    expect(stale.status).toBe(412);
    expect(await stale.json()).toEqual({ error: expect.stringContaining("ha cambiado"), version: v2 });

    const third = await put("tok-ana", encrypted(2000, 4), { "If-Match": v2 });
    expect(third.status).toBe(200);
    const v3 = ((await third.json()) as { version: string }).version;

    // Solo quedan los trozos de la copia vigente.
    expect(await count("SELECT count(*) AS n FROM parts WHERE owner = '111' AND version <> ?", v3)).toBe(0);
    const got = await call("GET", "/v1/copia", { token: "tok-ana" });
    expect(await got.text()).toBe(encrypted(2000, 4));
  });

  it("If-Match sin copia: 412 con versión null", async () => {
    const res = await put("tok-ana", encrypted(100), { "If-Match": '"no-existe"' });
    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({ error: expect.any(String), version: null });
  });

  it("una copia de 2,5 MB va en trozos y vuelve idéntica", async () => {
    const body = encrypted(2_500_000, 7); // 3 333 336 caracteres
    const res = await put("tok-ana", body, { "If-None-Match": "*" });
    expect(res.status).toBe(200);
    const { version } = (await res.json()) as { version: string };
    expect(await count("SELECT count(*) AS n FROM parts WHERE owner = '111' AND version = ?", version)).toBe(4);
    expect(await count("SELECT max(length(data)) AS n FROM parts")).toBe(1_000_000);
    expect(await count("SELECT count(*) AS n FROM parts WHERE typeof(data) <> 'text'")).toBe(0);

    const got = await call("GET", "/v1/copia", { token: "tok-ana" });
    expect(got.status).toBe(200);
    expect(same(await got.text(), body)).toBe(true);

    const info = (await (await call("GET", "/v1/copia/info", { token: "tok-ana" })).json()) as { size: number };
    expect(info.size).toBe(approxBytes(body));
    expect(info.size - 2_500_000).toBeLessThanOrEqual(2);
  });

  it("borra la copia (y responde 204 aunque no haya nada)", async () => {
    await put("tok-ana", encrypted(1_200_000), { "If-None-Match": "*" });
    const del = await call("DELETE", "/v1/copia", { token: "tok-ana" });
    expect(del.status).toBe(204);
    expect(del.headers.get("Cache-Control")).toBe("no-store");
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(0);
    expect(await (await call("GET", "/v1/copia/info", { token: "tok-ana" })).json()).toEqual({ version: null, size: 0, updatedAt: null });
    expect((await call("GET", "/v1/copia", { token: "tok-ana" })).status).toBe(404);
    expect((await call("DELETE", "/v1/copia", { token: "tok-ana" })).status).toBe(204);
  });

  it("cada cuenta ve solo lo suyo", async () => {
    const ana = encrypted(1000, 1);
    const luis = encrypted(2000, 2);
    await put("tok-ana", ana, { "If-None-Match": "*" });
    expect((await call("GET", "/v1/copia", { token: "tok-luis" })).status).toBe(404);
    expect((await put("tok-luis", luis, { "If-None-Match": "*" })).status).toBe(200);

    expect(await (await call("GET", "/v1/copia", { token: "tok-ana" })).text()).toBe(ana);
    expect(await (await call("GET", "/v1/copia", { token: "tok-luis" })).text()).toBe(luis);

    await call("DELETE", "/v1/copia", { token: "tok-luis" });
    expect((await call("GET", "/v1/copia", { token: "tok-ana" })).status).toBe(200);
  });
});

describe("subidas y lecturas a la vez", () => {
  /** La D1 de prueba, pero `before` se ejecuta justo antes de la primera sentencia que empiece por `prefix`. */
  function racing(prefix: string, before: () => Promise<unknown>) {
    let done = false;
    const wrap = (s: D1Statement): D1Statement =>
      new Proxy(s, {
        get(target, prop, receiver) {
          if (prop === "bind") return (...v: unknown[]) => wrap(target.bind(...v));
          if ((prop === "run" || prop === "all" || prop === "first") && !done && target.sql.startsWith(prefix)) {
            return async () => {
              done = true;
              await before();
              return target[prop]();
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    return { prepare: (sql: string) => wrap(db.prepare(sql)), batch: (s: D1Statement[]) => db.batch(s) };
  }

  const putWith = (DB: unknown, body: string, headers: Record<string, string>) =>
    handle(request("PUT", "/v1/copia", { token: "tok-ana", body, headers }), env({ DB }), { verifyToken });

  it("si otra subida gana justo antes, 412 y la perdedora no deja trozos", async () => {
    const v1 = ((await (await put("tok-ana", encrypted(1500), { "If-None-Match": "*" })).json()) as { version: string }).version;
    // La otra subida cambia la copia vigente entre la comprobación y la escritura de esta.
    const DB = racing("UPDATE heads", () => db.prepare("UPDATE heads SET version = 'v-otra' WHERE owner = '111'").run());
    const res = await putWith(DB, encrypted(2_100_000, 5), { "If-Match": v1 });
    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({ error: expect.any(String), version: "v-otra" });
    expect(await count("SELECT count(*) AS n FROM parts WHERE version <> ?", v1)).toBe(0);
    expect(await count("SELECT count(*) AS n FROM parts WHERE version = ?", v1)).toBe(1);
  });

  it("con una subida completa de otro dispositivo entre medias, gana la primera", async () => {
    const v1 = ((await (await put("tok-ana", encrypted(1500), { "If-None-Match": "*" })).json()) as { version: string }).version;
    const DB = racing("UPDATE heads", () => put("tok-ana", encrypted(1500, 9), { "If-Match": v1 }));
    expect((await putWith(DB, encrypted(2_100_000, 5), { "If-Match": v1 })).status).toBe(412);
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(1);
    expect(await (await call("GET", "/v1/copia", { token: "tok-ana" })).text()).toBe(encrypted(1500, 9));
  });

  it("si la limpieza tardía de otra subida borra trozos de la que gana, se vuelven a poner", async () => {
    const v1 = ((await (await put("tok-ana", encrypted(1500), { "If-None-Match": "*" })).json()) as { version: string }).version;
    // La subida que dejó v1 vigente aún no había borrado «las demás versiones»: lo hace ahora, con los trozos de esta ya puestos.
    const DB = racing("UPDATE heads", () => db.prepare("DELETE FROM parts WHERE owner = '111' AND version <> ?").bind(v1).run());
    const body = encrypted(2_100_000, 6);
    expect((await putWith(DB, body, { "If-Match": v1 })).status).toBe(200);
    const got = await call("GET", "/v1/copia", { token: "tok-ana" });
    expect(got.status).toBe(200);
    expect(same(await got.text(), body)).toBe(true);
  });

  it("si la copia cambia a mitad de la lectura, se vuelve a leer", async () => {
    const v1 = ((await (await put("tok-ana", encrypted(2_000_000, 1), { "If-None-Match": "*" })).json()) as { version: string }).version;
    const DB = racing("SELECT idx, data FROM parts", () => put("tok-ana", encrypted(1_500_000, 2), { "If-Match": v1 }));
    const res = await handle(request("GET", "/v1/copia", { token: "tok-ana" }), env({ DB }), { verifyToken });
    expect(res.status).toBe(200);
    expect(same(await res.text(), encrypted(1_500_000, 2))).toBe(true);
  });

  it("si faltan trozos de la copia vigente, 503", async () => {
    await put("tok-ana", encrypted(2_000_000), { "If-None-Match": "*" });
    db.db.exec("DELETE FROM parts WHERE idx = 1");
    expect((await call("GET", "/v1/copia", { token: "tok-ana" })).status).toBe(503);
  });
});

describe("comprobación con Google", () => {
  const tokenInfo = vi.fn<(url: string) => Response>();
  beforeEach(() => {
    tokenInfo.mockReset();
    vi.stubGlobal("fetch", async (url: string) => tokenInfo(url));
  });
  afterEach(() => vi.unstubAllGlobals());

  const google = (status: number, body: Record<string, unknown>) =>
    tokenInfo.mockReturnValueOnce(new Response(JSON.stringify(body), { status }));
  const valid = { aud: CLIENT_ID, azp: CLIENT_ID, sub: "111", email: "ana@clinica.es", email_verified: "true", expires_in: "3599" };
  // Sin deps: la comprobación de verdad. Un token distinto en cada caso para que no salga del recuerdo.
  const info = (token: string) => handle(request("GET", "/v1/copia/info", { token }), env());

  it("acepta un token de esta app con el correo verificado", async () => {
    google(200, valid);
    expect((await info("g/ok+1")).status).toBe(200);
    expect(tokenInfo).toHaveBeenCalledWith("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=g%2Fok%2B1");
    google(200, { ...valid, aud: "otra-app", email_verified: true });
    expect((await info("g-azp")).status).toBe(200);
  });

  it("rechaza tokens de otra app, correos sin verificar y tokens caducados", async () => {
    google(200, { ...valid, aud: "otra-app", azp: "otra-app" });
    expect((await info("g-otra")).status).toBe(401);
    google(200, { ...valid, email_verified: "false" });
    expect((await info("g-sin-verificar")).status).toBe(401);
    google(400, { error: "invalid_token" });
    expect((await info("g-caducado")).status).toBe(401);
    google(200, { ...valid, email: "intrusa@otra.es" });
    expect((await info("g-intrusa")).status).toBe(403);
  });

  it("si Google no responde, 503 (no es culpa de la sesión)", async () => {
    google(500, {});
    expect((await info("g-caida")).status).toBe(503);
  });
});
