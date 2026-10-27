// Pruebas del servidor de datos (worker.js) con una D1 de prueba sobre SQLite WASM (d1shim.ts) y una Google
// simulada: verifyToken de mentira o, para la comprobación de verdad con Google, fetch sustituido.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createD1, type D1Shim, type D1Statement } from "./d1shim";
import { handle } from "./worker.js";
import { EXPECTED_SERVER_VERSION } from "../src/cloud/serverStatus";

const CLIENT_ID = "1234-abc.apps.googleusercontent.com";
const APP = "https://adrianolivascano05-maker.github.io";
const BASE = "https://cenit-datos.ejemplo.workers.dev";

type User = { sub: string; email: string };
const USERS: Record<string, User> = {
  "tok-ana": { sub: "111", email: "ana@clinica.es" },
  "tok-luis": { sub: "222", email: "Luis@Clinica.es" },
  "tok-intrusa": { sub: "333", email: "intrusa@otra.es" },
  "tok-eva": { sub: "444", email: "eva@clinica.es" },
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
    // Con la versión del servidor: la que espera la app (src/cloud/serverStatus.ts) no puede ser posterior.
    const body = (await res.json()) as { ok: boolean; version: string };
    expect(body).toEqual({ ok: true, version: expect.stringMatching(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/) });
    expect(body.version >= EXPECTED_SERVER_VERSION).toBe(true);
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

  it("avisa si faltan las tablas (también las de clínicas, de una versión anterior)", async () => {
    db.db.exec("DROP TABLE clinic_status");
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
    expect(pre.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
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
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      // Siempre con tiempo límite: si Google se cuelga, la petición no se queda esperando.
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return tokenInfo(url);
    });
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
    // Se ha cortado por tardar demasiado.
    tokenInfo.mockImplementationOnce(() => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect((await info("g-lenta")).status).toBe(503);
  });
});

describe("clínicas", () => {
  type Clinic = { id: string; name: string; role: string; suspended?: boolean };
  const send = (method: string, path: string, token: string, data?: unknown) =>
    call(method, path, { token, body: data === undefined ? undefined : JSON.stringify(data) });
  type Me = { email: string; canCreate: boolean; operator: boolean; clinics: Clinic[]; deleted: { id: string; name: string; purgeAfter: string }[]; request: { clinic: string; status: string; createdAt: string } | null };
  const me = async (token: string, over?: Record<string, unknown>, now?: () => number) =>
    (await (await handle(request("GET", "/v1/yo", { token }), env(over), { verifyToken, now })).json()) as Me;
  async function clinic(token = "tok-ana", name = "Fisiolab Centro") {
    const res = await send("POST", "/v1/clinicas", token, { name });
    expect(res.status).toBe(201);
    return (await res.json()) as Clinic;
  }
  const members = async (id: string, token = "tok-ana") =>
    ((await (await call("GET", `/v1/clinicas/${id}/miembros`, { token })).json()) as { members: { email: string; role: string }[] }).members.map(
      (m) => `${m.email}:${m.role}`,
    );
  const putClinic = (id: string, token: string, body: string, precondition: Record<string, string>) =>
    call("PUT", `/v1/clinicas/${id}/copia`, { token, body, headers: precondition });

  it("quien está en ALLOWED_EMAILS crea su clínica y queda de administrador; los demás, no", async () => {
    expect(await me("tok-eva")).toEqual({ email: "eva@clinica.es", canCreate: false, operator: false, clinics: [], deleted: [], request: null });
    expect((await send("POST", "/v1/clinicas", "tok-eva", { name: "La mía" })).status).toBe(403);
    expect((await send("POST", "/v1/clinicas", "tok-ana", { name: "  " })).status).toBe(400);
    expect((await send("POST", "/v1/clinicas", "tok-ana", { name: "x".repeat(81) })).status).toBe(400);
    expect((await call("POST", "/v1/clinicas", { token: "tok-ana", body: "{no es json" })).status).toBe(400);

    const c = await clinic("tok-ana", "  Fisiolab   Centro ");
    expect(c).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), name: "Fisiolab Centro", role: "admin" });
    expect(await me("tok-ana")).toEqual({ email: "ana@clinica.es", canCreate: true, operator: false, clinics: [c], deleted: [], request: null });
    expect(await members(c.id)).toEqual(["ana@clinica.es:admin"]);
    expect((await call("GET", "/v1/yo")).status).toBe(401);
  });

  it("el administrador añade a su equipo por correo, sin tocar ALLOWED_EMAILS", async () => {
    const c = await clinic();
    expect((await send("PUT", `/v1/clinicas/${c.id}/miembros/${encodeURIComponent("Eva@Clinica.es ")}`, "tok-ana", { role: "member" })).status).toBe(200);
    expect(await me("tok-eva")).toEqual({ email: "eva@clinica.es", canCreate: false, operator: false, clinics: [{ ...c, role: "member" }], deleted: [], request: null });
    expect(await members(c.id, "tok-eva")).toEqual(["ana@clinica.es:admin", "eva@clinica.es:member"]);
    // Un miembro no añade ni quita a nadie, ni cambia el nombre, ni borra la clínica.
    expect((await send("PUT", `/v1/clinicas/${c.id}/miembros/luis@clinica.es`, "tok-eva", { role: "member" })).status).toBe(403);
    expect((await call("DELETE", `/v1/clinicas/${c.id}/miembros/ana@clinica.es`, { token: "tok-eva" })).status).toBe(403);
    expect((await send("PATCH", `/v1/clinicas/${c.id}`, "tok-eva", { name: "Otra" })).status).toBe(403);
    expect((await call("DELETE", `/v1/clinicas/${c.id}`, { token: "tok-eva" })).status).toBe(403);
    // Datos que no valen.
    expect((await send("PUT", `/v1/clinicas/${c.id}/miembros/no-es-correo`, "tok-ana", { role: "member" })).status).toBe(400);
    expect((await send("PUT", `/v1/clinicas/${c.id}/miembros/luis@clinica.es`, "tok-ana", { role: "jefe" })).status).toBe(400);
    expect((await send("PATCH", `/v1/clinicas/${c.id}`, "tok-ana", { name: "Fisiolab Norte" })).status).toBe(200);
    expect((await me("tok-eva")).clinics[0]!.name).toBe("Fisiolab Norte");
  });

  it("siempre queda un administrador; uno mismo puede salir", async () => {
    const c = await clinic();
    const path = (email: string) => `/v1/clinicas/${c.id}/miembros/${email}`;
    expect((await send("PUT", path("ana@clinica.es"), "tok-ana", { role: "member" })).status).toBe(409);
    expect((await call("DELETE", path("ana@clinica.es"), { token: "tok-ana" })).status).toBe(409);
    await send("PUT", path("eva@clinica.es"), "tok-ana", { role: "admin" });
    expect((await send("PUT", path("ana@clinica.es"), "tok-ana", { role: "member" })).status).toBe(200);
    expect(await members(c.id)).toEqual(["eva@clinica.es:admin", "ana@clinica.es:member"]);
    // Ana ya no administra: no puede volver a subirse, pero sí salir.
    expect((await send("PUT", path("ana@clinica.es"), "tok-ana", { role: "admin" })).status).toBe(403);
    expect((await call("DELETE", path("ana@clinica.es"), { token: "tok-ana" })).status).toBe(204);
    expect((await me("tok-ana")).clinics).toEqual([]);
    expect((await call("GET", `/v1/clinicas/${c.id}/copia/info`, { token: "tok-ana" })).status).toBe(403);
    // Quitar a quien no está: nada que hacer.
    expect((await call("DELETE", path("nadie@clinica.es"), { token: "tok-eva" })).status).toBe(204);
  });

  it("el equipo comparte la copia de la clínica; nadie de fuera la ve, tampoco quien gestiona el servidor", async () => {
    const c = await clinic();
    await send("PUT", `/v1/clinicas/${c.id}/miembros/eva@clinica.es`, "tok-ana", { role: "member" });
    const v1 = ((await (await putClinic(c.id, "tok-ana", encrypted(3000, 1), { "If-None-Match": "*" })).json()) as { version: string }).version;
    // Eva la baja y sube su cambio sobre esa versión.
    expect(await (await call("GET", `/v1/clinicas/${c.id}/copia`, { token: "tok-eva" })).text()).toBe(encrypted(3000, 1));
    expect((await putClinic(c.id, "tok-eva", encrypted(3000, 2), { "If-Match": v1 })).status).toBe(200);
    expect((await putClinic(c.id, "tok-ana", encrypted(3000, 3), { "If-Match": v1 })).status).toBe(412);
    // Luis (en ALLOWED_EMAILS, pero no del equipo) e intrusos: ni la copia ni la lista.
    for (const token of ["tok-luis", "tok-intrusa"]) {
      expect((await call("GET", `/v1/clinicas/${c.id}/copia`, { token })).status).toBe(403);
      expect((await call("GET", `/v1/clinicas/${c.id}/miembros`, { token })).status).toBe(403);
      expect((await putClinic(c.id, token, encrypted(10), { "If-None-Match": "*" })).status).toBe(403);
    }
    // Una clínica que no existe responde igual que una ajena.
    expect((await call("GET", "/v1/clinicas/no-existe/copia/info", { token: "tok-ana" })).status).toBe(403);
    expect((await call("GET", `/v1/clinicas/${c.id}/otra`, { token: "tok-ana" })).status).toBe(404);
    // La copia de la clínica no es la personal de nadie.
    expect(await (await call("GET", "/v1/copia/info", { token: "tok-ana" })).json()).toEqual({ version: null, size: 0, updatedAt: null });
    // Sin cifrar, tampoco aquí.
    const plain = Buffer.from("SQLite format 3\u0000").toString("base64");
    expect((await putClinic(c.id, "tok-eva", plain, { "If-Match": "x" })).status).toBe(415);
  });

  it("borrar la copia o la clínica es cosa del administrador; la clínica va 30 días a la papelera y se puede recuperar", async () => {
    const c = await clinic();
    await send("PUT", `/v1/clinicas/${c.id}/miembros/eva@clinica.es`, "tok-ana", { role: "member" });
    await putClinic(c.id, "tok-ana", encrypted(1_200_000), { "If-None-Match": "*" });
    expect((await call("DELETE", `/v1/clinicas/${c.id}/copia`, { token: "tok-eva" })).status).toBe(403);
    expect((await send("DELETE", `/v1/clinicas/${c.id}`, "tok-eva", { declaration: "x".repeat(30) })).status).toBe(403);
    // Sin declaración no se borra.
    expect((await send("DELETE", `/v1/clinicas/${c.id}`, "tok-ana", {})).status).toBe(400);
    const t0 = Date.parse("2026-10-20T10:00:00Z");
    const del = await handle(request("DELETE", `/v1/clinicas/${c.id}`, { token: "tok-ana", body: JSON.stringify({ declaration: "Declaro que conservamos la copia de las historias." }) }), env(), {
      verifyToken,
      now: () => t0,
    });
    expect(await del.json()).toEqual({ purgeAfter: "2026-11-19T10:00:00.000Z" });
    // Nadie la usa, pero sigue entera: quien la administraba puede recuperarla.
    expect((await me("tok-eva", undefined, () => t0)).clinics).toEqual([]);
    expect((await me("tok-ana", undefined, () => t0)).deleted).toEqual([{ id: c.id, name: c.name, deletedAt: "2026-10-20T10:00:00.000Z", purgeAfter: "2026-11-19T10:00:00.000Z" }]);
    expect((await call("GET", `/v1/clinicas/${c.id}/copia/info`, { token: "tok-eva" })).status).toBe(410);
    expect((await call("POST", `/v1/clinicas/${c.id}/recuperar`, { token: "tok-eva" })).status).toBe(403);
    expect(await (await call("POST", `/v1/clinicas/${c.id}/recuperar`, { token: "tok-ana" })).json()).toEqual({ restored: true });
    expect((await me("tok-eva")).clinics.map((x) => x.id)).toEqual([c.id]);
    expect((await call("GET", `/v1/clinicas/${c.id}/copia/info`, { token: "tok-eva" })).status).toBe(200);
    // Borrada otra vez y pasados los 30 días: se va del todo.
    await handle(request("DELETE", `/v1/clinicas/${c.id}`, { token: "tok-ana", body: JSON.stringify({ declaration: "Declaro que conservamos la copia de las historias." }) }), env(), {
      verifyToken,
      now: () => t0,
    });
    await me("tok-ana", undefined, () => t0 + 31 * 86_400_000);
    for (const t of ["parts", "heads", "members", "clinics", "clinic_status"]) expect(await count(`SELECT count(*) AS n FROM ${t}`), t).toBe(0);
  });

  it("panel del proveedor: ve las clínicas (sin pacientes), da de alta a quien crea clínicas, suspende y recupera", async () => {
    const op = { OPERATOR_EMAILS: "luis@clinica.es" };
    const opCall = (method: string, path: string, data?: unknown) =>
      handle(request(method, path, { token: "tok-luis", body: data === undefined ? undefined : JSON.stringify(data) }), env(op), { verifyToken });
    expect((await call("GET", "/v1/proveedor", { token: "tok-ana" }, op)).status).toBe(403);
    expect((await me("tok-luis", op)).operator).toBe(true);
    // Alta de Eva sin tocar ALLOWED_EMAILS: ya puede crear su clínica.
    expect((await opCall("PUT", "/v1/proveedor/altas/Eva@Clinica.es")).status).toBe(204);
    expect((await me("tok-eva")).canCreate).toBe(true);
    const c = await clinic("tok-eva", "Clínica Eva");
    await putClinic(c.id, "tok-eva", encrypted(3000), { "If-None-Match": "*" });
    const panel = (await (await opCall("GET", "/v1/proveedor")).json()) as {
      clinics: { id: string; name: string; members: number; admins: string[]; size: number; lastSync: string | null; suspendedAt: string | null }[];
      creators: { email: string; source: string }[];
    };
    expect(panel.clinics).toEqual([expect.objectContaining({ id: c.id, name: "Clínica Eva", members: 1, admins: ["eva@clinica.es"], size: expect.any(Number), suspendedAt: null })]);
    expect(panel.creators.map((x) => `${x.email}:${x.source}`)).toEqual(["ana@clinica.es:variable", "luis@clinica.es:variable", "eva@clinica.es:panel"]);
    // Suspendida: puede bajar su copia, no subir ni cambiar el equipo.
    expect((await opCall("POST", `/v1/proveedor/clinicas/${c.id}/suspender`, { suspended: true })).status).toBe(200);
    expect((await me("tok-eva")).clinics[0]).toMatchObject({ suspended: true });
    expect((await call("GET", `/v1/clinicas/${c.id}/copia`, { token: "tok-eva" })).status).toBe(200);
    expect((await putClinic(c.id, "tok-eva", encrypted(10), { "If-Match": "x" })).status).toBe(423);
    expect((await send("PUT", `/v1/clinicas/${c.id}/miembros/ana@clinica.es`, "tok-eva", { role: "member" })).status).toBe(423);
    await opCall("POST", `/v1/proveedor/clinicas/${c.id}/suspender`, { suspended: false });
    expect((await me("tok-eva")).clinics[0]!.suspended).toBeUndefined();
    // Una clínica borrada se puede recuperar desde el panel; el contrato, solo para el proveedor.
    await send("DELETE", `/v1/clinicas/${c.id}`, "tok-eva", { declaration: "Declaro que conservamos la copia de las historias." });
    expect((await opCall("POST", `/v1/proveedor/clinicas/${c.id}/recuperar`)).status).toBe(200);
    expect((await me("tok-eva")).clinics).toHaveLength(1);
    expect(((await (await opCall("GET", "/v1/proveedor/contrato")).json()) as { html: string }).html).toContain("BORRADOR");
    expect((await call("GET", "/v1/proveedor/contrato", { token: "tok-eva" }, op)).status).toBe(403);
    expect((await opCall("DELETE", "/v1/proveedor/altas/eva@clinica.es")).status).toBe(204);
    expect((await me("tok-eva")).canCreate).toBe(false);
  });

  it("solicitudes de acceso: cualquiera con Google lo pide; el proveedor acepta o rechaza", async () => {
    const op = { OPERATOR_EMAILS: "luis@clinica.es" };
    const opCall = (method: string, path: string, data?: unknown) =>
      handle(request(method, path, { token: "tok-luis", body: data === undefined ? undefined : JSON.stringify(data) }), env(op), { verifyToken });
    type Req = { clinic: string; status: string; createdAt: string };
    // Sin nombre de clínica no; quien ya puede crear clínicas no lo necesita.
    expect((await send("POST", "/v1/solicitud", "tok-eva", { clinic: "  " })).status).toBe(400);
    expect((await send("POST", "/v1/solicitud", "tok-ana", { clinic: "La de Ana" })).status).toBe(409);
    const res = await send("POST", "/v1/solicitud", "tok-eva", { clinic: "  Fisio   Eva ", note: "Somos 4 en Sevilla" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ clinic: "Fisio Eva", status: "pending" });
    expect((await me("tok-eva")).request).toMatchObject({ clinic: "Fisio Eva", status: "pending" } satisfies Partial<Req>);
    // Cambiar lo pedido mientras está pendiente.
    await send("POST", "/v1/solicitud", "tok-eva", { clinic: "Fisio Eva Sevilla" });
    expect((await me("tok-eva")).request).toMatchObject({ clinic: "Fisio Eva Sevilla" });
    // El proveedor la ve (y cuántas hay pendientes); nadie más.
    // Y lo que tiene pendiente en Cloudflare: la versión pegada y si hay almacén R2.
    expect((await me("tok-luis", op)) as unknown).toMatchObject({ pendingRequests: 1, server: { version: EXPECTED_SERVER_VERSION, docs: false } });
    expect((await me("tok-luis", { ...op, DOCS: {} })) as unknown).toMatchObject({ server: { docs: true } });
    expect((await me("tok-eva", op)) as unknown).not.toHaveProperty("pendingRequests");
    expect((await me("tok-eva", op)) as unknown).not.toHaveProperty("server");
    const panel = (await (await opCall("GET", "/v1/proveedor")).json()) as { requests: (Req & { email: string; note: string })[] };
    expect(panel.requests).toEqual([expect.objectContaining({ email: "eva@clinica.es", clinic: "Fisio Eva Sevilla", note: "", status: "pending" })]);
    expect((await call("POST", "/v1/proveedor/solicitudes/eva@clinica.es", { token: "tok-ana", body: "{}" }, op)).status).toBe(403);
    // Aceptada: ya puede crear su clínica y la solicitud desaparece.
    expect((await opCall("POST", "/v1/proveedor/solicitudes/eva@clinica.es", { accept: true })).status).toBe(200);
    expect(await me("tok-eva")).toMatchObject({ canCreate: true, request: null });
    expect((await opCall("POST", "/v1/proveedor/solicitudes/eva@clinica.es", { accept: true })).status).toBe(404);

    // Rechazada: no se puede volver a pedir hasta que el proveedor la borre.
    await send("POST", "/v1/solicitud", "tok-intrusa", { clinic: "Otra" });
    await opCall("POST", "/v1/proveedor/solicitudes/intrusa@otra.es", { accept: false });
    expect((await me("tok-intrusa")).request).toMatchObject({ status: "rejected" });
    expect((await send("POST", "/v1/solicitud", "tok-intrusa", { clinic: "Otra más" })).status).toBe(409);
    expect((await call("DELETE", "/v1/solicitud", { token: "tok-intrusa" })).status).toBe(204);
    expect((await me("tok-intrusa")).request).toMatchObject({ status: "rejected" });
    expect((await opCall("DELETE", "/v1/proveedor/solicitudes/intrusa@otra.es")).status).toBe(204);
    expect((await send("POST", "/v1/solicitud", "tok-intrusa", { clinic: "Otra más" })).status).toBe(200);
    // Retirarla uno mismo; darle de alta a mano también la cierra.
    expect((await call("DELETE", "/v1/solicitud", { token: "tok-intrusa" })).status).toBe(204);
    expect((await me("tok-intrusa")).request).toBeNull();
    await send("POST", "/v1/solicitud", "tok-intrusa", { clinic: "Otra más" });
    await opCall("PUT", "/v1/proveedor/altas/intrusa@otra.es");
    expect(await me("tok-intrusa")).toMatchObject({ canCreate: true, request: null });
  });

  it("como mucho 200 solicitudes pendientes a la vez", async () => {
    for (let i = 0; i < 200; i++)
      await db.prepare("INSERT INTO access_requests (email, clinic, note, status, created_at) VALUES (?, 'x', '', 'pending', '2026-01-01')").bind(`p${i}@x.es`).run();
    expect((await send("POST", "/v1/solicitud", "tok-eva", { clinic: "Una más" })).status).toBe(429);
  });

  it("la clave de recuperación: la guarda y la lee solo quien administra; se va con la clínica", async () => {
    const c = await clinic();
    await send("PUT", `/v1/clinicas/${c.id}/miembros/eva@clinica.es`, "tok-ana", { role: "member" });
    const path = `/v1/clinicas/${c.id}/recuperacion`;
    expect(await (await call("GET", path, { token: "tok-ana" })).json()).toEqual({ blob: null, updatedAt: null });
    expect((await send("PUT", path, "tok-ana", { blob: "" })).status).toBe(400);
    expect((await send("PUT", path, "tok-ana", { blob: '{"v":1}' })).status).toBe(200);
    expect(((await (await call("GET", path, { token: "tok-ana" })).json()) as { blob: string }).blob).toBe('{"v":1}');
    expect((await call("GET", path, { token: "tok-eva" })).status).toBe(403);
    expect((await send("PUT", path, "tok-eva", { blob: "x" })).status).toBe(403);
    await send("DELETE", `/v1/clinicas/${c.id}`, "tok-ana", { declaration: "Declaro que conservamos la copia de las historias." });
    await me("tok-ana", undefined, () => Date.now() + 31 * 86_400_000);
    expect(await count("SELECT count(*) AS n FROM recovery")).toBe(0);
  });

  it("sincronización por cambios: la app nueva convierte la clínica y las versiones anteriores reciben 426", async () => {
    const c = await clinic();
    await send("PUT", `/v1/clinicas/${c.id}/miembros/eva@clinica.es`, "tok-ana", { role: "member" });
    const base = `/v1/clinicas/${c.id}/copia`;
    type Info = { version: string | null; epoch: string | null; base: number | null; last: number; deltas: number; deltaSize: number };
    const info = async (token = "tok-ana") => (await (await call("GET", `${base}/info?v=2`, { token })).json()) as Info;
    const post = (token: string, body: string) => call("POST", `${base}/cambios?v=2`, { token, body });
    type Got = { epoch: string; base: number; deltas: { seq: number; data: string }[]; more: boolean };
    const since = async (n: number, token = "tok-ana") => (await (await call("GET", `${base}/cambios?v=2&desde=${n}`, { token })).json()) as Got;

    // Antes de convertirla: la app anterior trabaja como siempre y los cambios no se aceptan.
    const v1 = ((await (await putClinic(c.id, "tok-eva", encrypted(3000, 1), { "If-None-Match": "*" })).json()) as { version: string }).version;
    expect(await info()).toMatchObject({ version: v1, epoch: null, base: null, last: 0, deltas: 0 });
    expect((await post("tok-ana", encrypted(100))).status).toBe(409);
    expect((await call("GET", `${base}/cambios`, { token: "tok-ana" })).status).toBe(404);
    // La subida con ?v=2 necesita «seq».
    expect((await call("PUT", `${base}?v=2`, { token: "tok-ana", body: encrypted(3000, 2), headers: { "If-Match": v1 } })).status).toBe(400);

    // La app nueva la convierte: sube la copia entera con seq=0.
    const conv = await call("PUT", `${base}?v=2&seq=0`, { token: "tok-ana", body: encrypted(3000, 2), headers: { "If-Match": v1 } });
    expect(conv.status).toBe(200);
    const { version: v2, epoch } = (await conv.json()) as { version: string; epoch: string };
    expect(epoch).toMatch(/^[0-9a-f-]{36}$/);
    // Desde ahora, la app anterior no puede ni mirar la copia: tiene que actualizarse.
    for (const path of [`${base}/info`, base]) {
      const old = await call("GET", path, { token: "tok-eva" });
      expect(old.status).toBe(426);
      expect(((await old.json()) as { error: string }).error).toMatch(/actualiza la app/);
    }
    expect((await putClinic(c.id, "tok-eva", encrypted(3000, 3), { "If-Match": v2 })).status).toBe(426);

    // Cambios: números correlativos; cada uno baja lo que va después del suyo.
    expect((await (await post("tok-eva", encrypted(200, 4))).json()) as { seq: number }).toEqual({ seq: 1 });
    expect((await (await post("tok-ana", encrypted(200, 5))).json()) as { seq: number }).toEqual({ seq: 2 });
    expect(await since(0)).toEqual({ epoch, base: 0, deltas: [{ seq: 1, data: encrypted(200, 4) }, { seq: 2, data: encrypted(200, 5) }], more: false });
    expect((await since(1, "tok-eva")).deltas.map((d) => d.seq)).toEqual([2]);
    expect(await info()).toMatchObject({ version: v2, epoch, base: 0, last: 2, deltas: 2 });
    // Sin cifrar no; nadie de fuera.
    expect((await post("tok-ana", Buffer.from("{}").toString("base64"))).status).toBe(415);
    expect((await post("tok-luis", encrypted(100))).status).toBe(403);
    expect((await post("tok-ana", encrypted(1_000_001))).status).toBe(413);

    // Copia entera hasta el 2: los cambios hasta el 2 sobran; el siguiente sigue la cuenta.
    const v3 = ((await (await call("PUT", `${base}?v=2&seq=2`, { token: "tok-eva", body: encrypted(3000, 6), headers: { "If-Match": v2 } })).json()) as { version: string }).version;
    expect(await count("SELECT count(*) AS n FROM deltas")).toBe(0);
    expect(await info()).toMatchObject({ version: v3, epoch, base: 2, last: 2, deltas: 0 });
    expect((await (await post("tok-ana", encrypted(200, 7))).json()) as { seq: number }).toEqual({ seq: 3 });
    // Quien se quedó atrás (desde 1) tiene que bajar la copia entera.
    expect(await since(1)).toEqual({ epoch, base: 2, deltas: [], more: false });
    expect((await since(2)).deltas.map((d) => d.seq)).toEqual([3]);

    // Muchos cambios: llegan por tandas.
    for (let i = 0; i < 120; i++) await post("tok-ana", encrypted(50, 100 + i));
    const first = await since(2);
    expect(first.deltas.length).toBe(100);
    expect(first.more).toBe(true);
    const rest = await since(first.deltas.at(-1)!.seq);
    expect(rest.deltas.length).toBe(21);
    expect(rest.more).toBe(false);

    // Borrar la copia (contraseña olvidada) empieza otra época.
    expect((await call("DELETE", `${base}?v=2`, { token: "tok-ana" })).status).toBe(204);
    expect(await info()).toMatchObject({ version: null, epoch: null, base: null, last: 0, deltas: 0 });
    const again = await call("PUT", `${base}?v=2&seq=0`, { token: "tok-ana", body: encrypted(3000, 8), headers: { "If-None-Match": "*" } });
    expect(((await again.json()) as { epoch: string }).epoch).not.toBe(epoch);

    // La papelera y el borrado definitivo se llevan también los cambios.
    await post("tok-ana", encrypted(100, 9));
    expect((await send("DELETE", `/v1/clinicas/${c.id}`, "tok-ana", { declaration: "Conservo la copia de seguridad descargada." })).status).toBe(200);
    expect((await post("tok-ana", encrypted(100, 10))).status).toBe(410);
    await me("tok-ana", undefined, () => Date.now() + 31 * 86_400_000);
    expect(await count("SELECT count(*) AS n FROM deltas")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM delta_base")).toBe(0);
  });

  it("suspendida: se bajan los cambios, no se suben", async () => {
    const c = await clinic();
    const base = `/v1/clinicas/${c.id}/copia`;
    await call("PUT", `${base}?v=2&seq=0`, { token: "tok-ana", body: encrypted(3000), headers: { "If-None-Match": "*" } });
    await call("POST", `${base}/cambios?v=2`, { token: "tok-ana", body: encrypted(100) });
    const ops = { OPERATOR_EMAILS: "ana@clinica.es" };
    await handle(request("POST", `/v1/proveedor/clinicas/${c.id}/suspender`, { token: "tok-ana", body: JSON.stringify({ suspended: true }) }), env(ops), { verifyToken });
    expect((await call("POST", `${base}/cambios?v=2`, { token: "tok-ana", body: encrypted(100) })).status).toBe(423);
    expect((await call("GET", `${base}/cambios?v=2&desde=0`, { token: "tok-ana" })).status).toBe(200);
  });

  it("formularios para el paciente: el equipo los deja, el paciente responde sin sesión una vez y el equipo recoge", async () => {
    const c = await clinic();
    const fid = "f".repeat(10) + "Abc_123-xyz789";
    const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const pub = (method: string, path: string, data?: unknown) => call(method, path, { body: data === undefined ? undefined : JSON.stringify(data) });
    // Solo el equipo deja formularios, con id largo, cifrado y caducidad de 30 días como mucho.
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-eva", { id: fid, request: "QUJD", expiresAt })).status).toBe(403);
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: "corto", request: "QUJD", expiresAt })).status).toBe(400);
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: fid, request: "no es base64!", expiresAt })).status).toBe(400);
    const late = new Date(Date.now() + 40 * 86_400_000).toISOString();
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: fid, request: "QUJD", expiresAt: late })).status).toBe(400);
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: fid, request: "QUJD", expiresAt })).status).toBe(201);
    expect((await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: fid, request: "QUJD", expiresAt })).status).toBe(409);

    // El paciente lo abre sin cuenta; aún no hay nada que recoger.
    expect(await (await pub("GET", `/v1/formularios/${fid}`)).json()).toEqual({ request: "QUJD", expiresAt, answered: false });
    expect((await pub("GET", `/v1/formularios/${"x".repeat(30)}`)).status).toBe(404);
    expect(((await (await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-ana")).json()) as { forms: unknown[] }).forms).toEqual([]);
    // Responde una sola vez.
    expect((await pub("POST", `/v1/formularios/${fid}/respuesta`, { response: "" })).status).toBe(400);
    expect((await pub("POST", `/v1/formularios/${fid}/respuesta`, { response: "UkVTUA==" })).status).toBe(200);
    expect((await pub("POST", `/v1/formularios/${fid}/respuesta`, { response: "T1RSQQ==" })).status).toBe(409);
    expect(((await (await pub("GET", `/v1/formularios/${fid}`)).json()) as { answered: boolean }).answered).toBe(true);
    // La consulta de la sincronización (cada minuto) ya dice que hay una respuesta: la app no pregunta aparte.
    const waiting = async () => ((await (await call("GET", `/v1/clinicas/${c.id}/copia/info?v=2&trozos=1`, { token: "tok-ana" })).json()) as { forms: number }).forms;
    expect(await waiting()).toBe(1);

    // El equipo recoge la respuesta y la borra; quien no es del equipo, no.
    expect((await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-eva")).status).toBe(403);
    const { forms } = (await (await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-ana")).json()) as { forms: { id: string; response: string }[] };
    expect(forms).toEqual([{ id: fid, response: "UkVTUA==", answeredAt: expect.any(String) }]);
    expect((await send("DELETE", `/v1/clinicas/${c.id}/formularios/${fid}`, "tok-ana")).status).toBe(204);
    // Recogido: ya no hay nada cifrado, pero el paciente ve que lo envió.
    expect(await (await pub("GET", `/v1/formularios/${fid}`)).json()).toEqual({ request: "", expiresAt, answered: true });
    expect(((await (await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-ana")).json()) as { forms: unknown[] }).forms).toEqual([]);
    expect(await count("SELECT count(*) AS n FROM patient_forms WHERE response IS NOT NULL OR request <> ''")).toBe(0);
    expect(await waiting()).toBe(0);
    // Uno sin responder que se anula desaparece.
    const other = "h".repeat(30);
    await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: other, request: "QUJD", expiresAt });
    expect((await send("DELETE", `/v1/clinicas/${c.id}/formularios/${other}`, "tok-ana")).status).toBe(204);
    expect((await pub("GET", `/v1/formularios/${other}`)).status).toBe(404);
  });

  it("formularios: los caducados sin responder se borran y ya no se pueden responder", async () => {
    const c = await clinic();
    const fid = "g".repeat(30);
    const t = Date.now();
    await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", { id: fid, request: "QUJD", expiresAt: new Date(t + 86_400_000).toISOString() });
    const later = () => t + 2 * 86_400_000;
    const res = await handle(request("POST", `/v1/formularios/${fid}/respuesta`, { body: JSON.stringify({ response: "UkVTUA==" }) }), env(), { verifyToken, now: later });
    expect(res.status).toBe(404);
    expect((await handle(request("GET", `/v1/formularios/${fid}`), env(), { verifyToken, now: later })).status).toBe(404);
    // Lo borra el equipo al mirar (una petición sin sesión no hace trabajar a la base).
    await handle(request("GET", `/v1/clinicas/${c.id}/formularios`, { token: "tok-ana" }), env(), { verifyToken, now: later });
    expect(await count("SELECT count(*) AS n FROM patient_forms")).toBe(0);
  });

  it("dos dispositivos que mandan el mismo formulario a la vez: el segundo recibe 409, no un error interno", async () => {
    const c = await clinic();
    const body = { id: "a".repeat(22), request: "UkVRVQ==", expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
    // El otro guarda el suyo justo antes de que este lo guarde.
    let done = false;
    const DB = {
      prepare(sql: string) {
        const st = db.prepare(sql);
        if (!sql.startsWith("INSERT INTO patient_forms") || done) return st;
        done = true;
        return {
          bind: (...v: unknown[]) => {
            const bound = st.bind(...v);
            return {
              run: async () => {
                await send("POST", `/v1/clinicas/${c.id}/formularios`, "tok-ana", body);
                return bound.run();
              },
            };
          },
        };
      },
      batch: (x: D1Statement[]) => db.batch(x),
    };
    const res = await handle(request("POST", `/v1/clinicas/${c.id}/formularios`, { token: "tok-ana", body: JSON.stringify(body) }), env({ DB }), { verifyToken });
    expect(res.status).toBe(409);
    expect(await count("SELECT count(*) AS n FROM patient_forms")).toBe(1);
  });

  it("los formularios caducados se limpian como mucho cada 10 minutos, no en cada consulta", async () => {
    const c = await clinic();
    const deletes: string[] = [];
    const DB = {
      prepare(sql: string) {
        if (sql.startsWith("DELETE FROM patient_forms")) deletes.push(sql);
        return db.prepare(sql);
      },
      batch: (x: D1Statement[]) => db.batch(x),
    };
    const t0 = Date.parse("2030-01-01T10:00:00Z");
    const ask = (t: number) => handle(request("GET", `/v1/clinicas/${c.id}/formularios`, { token: "tok-ana" }), env({ DB }), { verifyToken, now: () => t });
    for (const m of [0, 1, 2, 9]) expect((await ask(t0 + m * 60_000)).status).toBe(200);
    expect(deletes).toHaveLength(1);
    await ask(t0 + 11 * 60_000);
    expect(deletes).toHaveLength(2);
  });

  it("las respuestas llevan nosniff: el navegador no ejecuta como otra cosa lo que dice ser texto o JSON", async () => {
    const c = await clinic();
    expect((await call("GET", `/v1/clinicas/${c.id}/miembros`, { token: "tok-ana" })).headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect((await call("GET", "/v1/no-existe")).headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("los cambios se mandan por tandas de 3 MB sin leer de la base los que no caben; con 100 justos, no hay más", async () => {
    const c = await clinic();
    const base = `/v1/clinicas/${c.id}/copia`;
    await call("PUT", `${base}?v=2&seq=0`, { token: "tok-ana", body: encrypted(3000), headers: { "If-None-Match": "*" } });
    for (let i = 0; i < 8; i++) expect((await call("POST", `${base}/cambios?v=2`, { token: "tok-ana", body: encrypted(700_000, 10 + i) })).status).toBe(200);
    // Cuántos lotes enteros se leen de la base.
    let read = 0;
    const DB = {
      prepare(sql: string) {
        const st = db.prepare(sql);
        if (!sql.startsWith("SELECT seq, data FROM deltas")) return st;
        return {
          bind: (...v: unknown[]) => {
            const bound = st.bind(...v);
            return {
              all: async () => {
                const r = await bound.all();
                read += r.results.length;
                return r;
              },
            };
          },
        };
      },
      batch: (x: D1Statement[]) => db.batch(x),
    };
    type Got = { deltas: { seq: number; data: string }[]; more: boolean };
    const since = async (n: number) => (await (await handle(request("GET", `${base}/cambios?v=2&desde=${n}`, { token: "tok-ana" }), env({ DB }), { verifyToken })).json()) as Got;
    const first = await since(0);
    expect(first.deltas.map((d) => d.seq)).toEqual([1, 2, 3]);
    expect(first.deltas.reduce((n, d) => n + d.data.length, 0)).toBeLessThanOrEqual(3_000_000);
    expect(first.more).toBe(true);
    expect(read).toBe(3);
    // Lo que queda, en orden, hasta el final.
    const seen = [...first.deltas];
    for (let page = first; page.more; ) {
      page = await since(seen.at(-1)!.seq);
      seen.push(...page.deltas);
    }
    expect(seen.map((d) => d.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seen[4]!.data).toBe(encrypted(700_000, 14));

    // Exactamente 100 lotes pequeños desde el último: una tanda y no hay más.
    for (let i = 0; i < 100; i++) await call("POST", `${base}/cambios?v=2`, { token: "tok-ana", body: encrypted(50, 200 + i) });
    const all = await since(8);
    expect(all.deltas).toHaveLength(100);
    expect(all.more).toBe(false);
  });

  it("la reserva online y los enlaces para anular ya no existen: 404", async () => {
    const c = await clinic();
    expect((await call("GET", "/v1/reservas/fisiolab-centro")).status).toBe(404);
    expect((await call("POST", "/v1/citas/codigo-de-una-cita-antigua/anular")).status).toBe(404);
    for (const [method, rest] of [["PUT", "/reservas"], ["GET", "/reservas"], ["POST", "/reservas/recogidas"], ["POST", "/enlaces"]] as const) {
      expect((await call(method, `/v1/clinicas/${c.id}${rest}`, { token: "tok-ana", body: method === "GET" ? undefined : "{}" })).status, `${method} ${rest}`).toBe(404);
    }
  });

  it("la copia personal de antes sigue solo para ALLOWED_EMAILS", async () => {
    expect((await call("GET", "/v1/copia/info", { token: "tok-eva" })).status).toBe(403);
    expect((await call("GET", "/v1/copia/info", { token: "tok-ana" })).status).toBe(200);
  });
});

/**
 * Un almacén R2 de prueba en memoria: put, get, delete y subidas por trozos, con las reglas de R2 (todos los trozos
 * menos el último, del mismo tamaño y de 5 MiB como poco).
 */
class FakeR2 {
  readonly objects = new Map<string, Uint8Array>();
  readonly uploads = new Map<string, { key: string; parts: Map<number, { etag: string; bytes: Uint8Array }> }>();
  private next = 1;
  async put(key: string, value: Uint8Array) {
    this.objects.set(key, new Uint8Array(value));
    return { key };
  }
  async get(key: string) {
    const b = this.objects.get(key);
    return b ? { body: new Blob([b as BlobPart]).stream(), size: b.byteLength } : null;
  }
  async delete(keys: string | string[]) {
    for (const k of [keys].flat()) this.objects.delete(k);
  }
  async createMultipartUpload(key: string) {
    const uploadId = `subida-${this.next++}`;
    this.uploads.set(uploadId, { key, parts: new Map() });
    return this.resumeMultipartUpload(key, uploadId);
  }
  resumeMultipartUpload(key: string, uploadId: string) {
    const find = () => {
      const u = this.uploads.get(uploadId);
      if (!u || u.key !== key) throw new Error("NoSuchUpload");
      return u;
    };
    return {
      uploadId,
      uploadPart: async (partNumber: number, value: Uint8Array) => {
        const etag = `etag-${this.next++}`;
        find().parts.set(partNumber, { etag, bytes: new Uint8Array(value) });
        return { partNumber, etag };
      },
      complete: async (parts: { partNumber: number; etag: string }[]) => {
        const u = find();
        const got = parts.map((p) => {
          const part = u.parts.get(p.partNumber);
          if (!part || part.etag !== p.etag) throw new Error("InvalidPart");
          return part.bytes;
        });
        const size = got[0]!.byteLength;
        if (got.slice(0, -1).some((b) => b.byteLength !== size || b.byteLength < 5 * 1024 * 1024)) throw new Error("EntityTooSmall");
        const all = new Uint8Array(got.reduce((n, b) => n + b.byteLength, 0));
        let at = 0;
        for (const b of got) {
          all.set(b, at);
          at += b.byteLength;
        }
        this.objects.set(key, all);
        this.uploads.delete(uploadId);
        return { size: all.byteLength };
      },
      abort: async () => {
        find();
        this.uploads.delete(uploadId);
      },
    };
  }
}

/** Un documento «cifrado» de `size` bytes, como lo sube la app: CENITDOC1 y después bytes de relleno. */
function sealedDoc(size: number, seed = 1) {
  const bytes = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    bytes[i] = x >>> 24;
  }
  bytes.set(new TextEncoder().encode("CENITDOC1"), 0);
  return bytes;
}

describe("documentos", () => {
  let r2: FakeR2;
  beforeEach(() => {
    r2 = new FakeR2();
  });
  type Opts = { token?: string; body?: Uint8Array; json?: unknown };
  const go = (method: string, path: string, { token, body, json }: Opts = {}, over: Record<string, unknown> = {}, now?: () => number) =>
    handle(
      new Request(BASE + path, {
        method,
        body: json !== undefined ? JSON.stringify(json) : (body as BodyInit | undefined),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/octet-stream" } : {}) },
      }),
      env({ DOCS: r2, ...over }),
      { verifyToken, now },
    );
  async function clinic(token = "tok-ana") {
    const res = await go("POST", "/v1/clinicas", { token, json: { name: "Fisiolab Centro" } });
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  }
  const usage = async (id: string) => (await (await go("GET", `/v1/clinicas/${id}/documentos`, { token: "tok-ana" })).json()) as Record<string, unknown>;
  const DOC = "d".repeat(22);
  const expiresAt = () => new Date(Date.now() + 14 * 86_400_000).toISOString();

  it("sin R2 la app sabe que no hay documentos, y las rutas dicen qué falta", async () => {
    const id = await clinic();
    expect(await (await go("GET", `/v1/clinicas/${id}/documentos`, { token: "tok-ana" }, { DOCS: undefined })).json()).toEqual({ enabled: false });
    const res = await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(100) }, { DOCS: undefined });
    expect(res.status).toBe(501);
    expect(((await res.json()) as { error: string }).error).toContain("R2");
  });

  it("el equipo sube, baja y borra; quien no es del equipo, no; si ya está, no se vuelve a guardar", async () => {
    const id = await clinic();
    const doc = sealedDoc(1000);
    expect((await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-eva", body: doc })).status).toBe(403);
    const res = await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: doc });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: DOC, size: 1000 });
    expect([...r2.objects.keys()]).toEqual([`${id}/${DOC}`]);
    expect((await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(1000, 2) })).status).toBe(200);
    expect(r2.objects.get(`${id}/${DOC}`)).toEqual(doc);

    expect((await go("GET", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-eva" })).status).toBe(403);
    const got = await go("GET", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" });
    expect(got.status).toBe(200);
    expect(got.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(doc);
    expect(await usage(id)).toEqual({ enabled: true, count: 1, used: 1000, total: 1000, cap: 10_000_000_000, warnAt: 7_000_000_000, maxBytes: 5 * 1024 * 1024 });

    expect((await go("DELETE", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" })).status).toBe(204);
    expect(r2.objects.size).toBe(0);
    expect((await go("GET", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" })).status).toBe(404);
    expect((await go("DELETE", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" })).status).toBe(204);
    expect((await usage(id)).count).toBe(0);
  });

  it("solo documentos cifrados, de 5 MB como mucho y con un id válido", async () => {
    const id = await clinic();
    const put = (doc: string, body: Uint8Array) => go("PUT", `/v1/clinicas/${id}/documentos/${doc}`, { token: "tok-ana", body });
    expect((await put(DOC, new TextEncoder().encode("%PDF-1.7 sin cifrar"))).status).toBe(415);
    expect((await put(DOC, sealedDoc(5 * 1024 * 1024 + 70 * 1024))).status).toBe(413);
    expect((await put("corto", sealedDoc(100))).status).toBe(400);
    expect((await put(`${DOC}.1`, sealedDoc(100))).status).toBe(400);
    expect((await put(DOC, sealedDoc(5 * 1024 * 1024))).status).toBe(201);
    expect(r2.objects.size).toBe(1);
  });

  it("el almacén entero no pasa de 10 GB: al llegar al tope no se guarda nada más", async () => {
    const id = await clinic();
    await db.prepare("INSERT INTO documents (clinic_id, id, form_id, size, created_at) VALUES ('otra', ?, NULL, ?, '2026-10-01')").bind(DOC, 9_999_999_500).run();
    const res = await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(1000) });
    expect(res.status).toBe(507);
    expect(((await res.json()) as { error: string }).error).toContain("10 GB");
    expect(r2.objects.size).toBe(0);
    expect(await usage(id)).toMatchObject({ used: 0, total: 9_999_999_500 });
    expect((await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(400) })).status).toBe(201);
  });

  it("suspendida: los documentos se bajan, pero no se suben ni se borran", async () => {
    const id = await clinic();
    await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(100) });
    await db.prepare("INSERT INTO clinic_status (clinic_id, suspended_at) VALUES (?, '2026-10-01')").bind(id).run();
    expect((await go("GET", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" })).status).toBe(200);
    expect((await go("PUT", `/v1/clinicas/${id}/documentos/${"e".repeat(22)}`, { token: "tok-ana", body: sealedDoc(100) })).status).toBe(423);
    expect((await go("DELETE", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana" })).status).toBe(423);
    expect(r2.objects.size).toBe(1);
  });

  it("el paciente sube sus documentos con el enlace (sin sesión) y la clínica se queda con los que quiere", async () => {
    const id = await clinic();
    const fid = "p".repeat(24);
    const form = (body: Record<string, unknown>) => go("POST", `/v1/clinicas/${id}/formularios`, { token: "tok-ana", json: { id: fid, request: "QUJD", expiresAt: expiresAt(), ...body } });
    expect((await form({ maxDocs: 11 })).status).toBe(400);
    expect((await form({ maxDocs: 1.5 })).status).toBe(400);
    expect((await form({ maxDocs: 2 })).status).toBe(201);
    const upload = (n: number, body: Uint8Array) => go("PUT", `/v1/formularios/${fid}/documentos/${n}`, { body });
    expect((await upload(1, sealedDoc(300))).status).toBe(200);
    expect((await upload(3, sealedDoc(300))).status).toBe(400);
    expect((await upload(2, sealedDoc(500))).status).toBe(200);
    // Mientras no envía, puede cambiarlo: se sustituye.
    expect((await upload(2, sealedDoc(200, 7))).status).toBe(200);
    expect([...r2.objects.keys()].sort()).toEqual([`${id}/${fid}.1`, `${id}/${fid}.2`]);
    expect(await usage(id)).toMatchObject({ count: 0, used: 0, total: 500 });
    // La clínica los baja con su id (para abrirlos con la clave del enlace).
    expect(new Uint8Array(await (await go("GET", `/v1/clinicas/${id}/documentos/${fid}.2`, { token: "tok-ana" })).arrayBuffer())).toEqual(sealedDoc(200, 7));
    // Enviado: ya no se pueden subir más.
    expect((await go("POST", `/v1/formularios/${fid}/respuesta`, { json: { response: "UkVTUA==" } })).status).toBe(200);
    expect((await upload(1, sealedDoc(300))).status).toBe(409);
    // Se queda con el primero; al recoger el formulario, el otro se borra.
    expect((await go("POST", `/v1/clinicas/${id}/documentos/${fid}.1/guardar`, { token: "tok-eva" })).status).toBe(403);
    expect((await go("POST", `/v1/clinicas/${id}/documentos/${fid}.1/guardar`, { token: "tok-ana" })).status).toBe(200);
    expect((await go("POST", `/v1/clinicas/${id}/documentos/${"z".repeat(22)}/guardar`, { token: "tok-ana" })).status).toBe(404);
    expect((await go("DELETE", `/v1/clinicas/${id}/formularios/${fid}`, { token: "tok-ana" })).status).toBe(204);
    expect([...r2.objects.keys()]).toEqual([`${id}/${fid}.1`]);
    expect(await usage(id)).toMatchObject({ count: 1, used: 300, total: 300 });
    expect(await count("SELECT count(*) AS n FROM doc_requests")).toBe(0);
  });

  it("un formulario que no pide documentos no admite subidas, y sin R2 no se pueden pedir", async () => {
    const id = await clinic();
    const fid = "q".repeat(24);
    await go("POST", `/v1/clinicas/${id}/formularios`, { token: "tok-ana", json: { id: fid, request: "QUJD", expiresAt: expiresAt() } });
    expect((await go("PUT", `/v1/formularios/${fid}/documentos/1`, { body: sealedDoc(100) })).status).toBe(400);
    expect((await go("GET", `/v1/formularios/${fid}/documentos/1`)).status).toBe(404);
    expect((await go("PUT", `/v1/formularios/${"x".repeat(30)}/documentos/1`, { body: sealedDoc(100) })).status).toBe(404);
    const other = { id: "r".repeat(24), request: "QUJD", expiresAt: expiresAt(), maxDocs: 1 };
    expect((await go("POST", `/v1/clinicas/${id}/formularios`, { token: "tok-ana", json: other }, { DOCS: undefined })).status).toBe(501);
    expect(r2.objects.size).toBe(0);
  });

  it("los documentos de un enlace que caduca sin recoger se borran al limpiar los formularios", async () => {
    const id = await clinic();
    const fid = "s".repeat(24);
    await go("POST", `/v1/clinicas/${id}/formularios`, { token: "tok-ana", json: { id: fid, request: "QUJD", expiresAt: expiresAt(), maxDocs: 1 } });
    await go("PUT", `/v1/formularios/${fid}/documentos/1`, { body: sealedDoc(100) });
    expect(r2.objects.size).toBe(1);
    const later = () => Date.parse("2033-01-01T10:00:00Z");
    expect((await go("GET", `/v1/clinicas/${id}/formularios`, { token: "tok-ana" }, {}, later)).status).toBe(200);
    expect(r2.objects.size).toBe(0);
    expect(await count("SELECT count(*) AS n FROM documents")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM doc_requests")).toBe(0);
  });

  it("al borrar la clínica para siempre se borran sus documentos; el proveedor ve cuánto ocupan", async () => {
    const id = await clinic();
    await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(1000) });
    const panel = (await (await go("GET", "/v1/proveedor", { token: "tok-ana" }, { OPERATOR_EMAILS: "ana@clinica.es" })).json()) as {
      clinics: { id: string; docs: number }[];
      documents: Record<string, unknown>;
    };
    expect(panel.clinics.find((c) => c.id === id)?.docs).toBe(1000);
    expect(panel.documents).toEqual({ enabled: true, total: 1000, copies: 0, cap: 10_000_000_000, warnAt: 7_000_000_000 });

    const declaration = "Conservo la copia descargada de la clínica.";
    expect((await go("DELETE", `/v1/clinicas/${id}`, { token: "tok-ana", json: { declaration } })).status).toBe(200);
    expect(r2.objects.size).toBe(1); // 30 días en la papelera
    const later = () => Date.now() + 31 * 86_400_000;
    await go("GET", "/v1/yo", { token: "tok-ana" }, {}, later);
    expect(r2.objects.size).toBe(0);
    expect(await count("SELECT count(*) AS n FROM documents")).toBe(0);
  });

  it("DOCS_CAP_GB cambia el tope del almacén; se avisa al 70 %", async () => {
    const id = await clinic();
    expect(await (await go("GET", `/v1/clinicas/${id}/documentos`, { token: "tok-ana" }, { DOCS_CAP_GB: "50" })).json()).toMatchObject({
      cap: 50_000_000_000,
      warnAt: 35_000_000_000,
    });
    await db.prepare("INSERT INTO documents (clinic_id, id, form_id, size, created_at) VALUES ('otra', ?, NULL, ?, '2026-10-01')").bind(DOC, 1_999_999_500).run();
    const res = await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { token: "tok-ana", body: sealedDoc(1000) }, { DOCS_CAP_GB: "2" });
    expect(res.status).toBe(507);
    expect(((await res.json()) as { error: string }).error).toContain("2 GB");
    // Un valor que no es un número no deja el almacén sin tope: vuelve a los 10 GB.
    expect(await (await go("GET", `/v1/clinicas/${id}/documentos`, { token: "tok-ana" }, { DOCS_CAP_GB: "mucho" })).json()).toMatchObject({ cap: 10_000_000_000 });
  });

  it("la comprobación de la instalación avisa si faltan las tablas de los documentos", async () => {
    db.db.exec("DROP TABLE documents");
    const body = (await (await go("GET", "/v1/salud")).json()) as { error: string };
    expect(body.error).toContain("schema.sql");
  });
});

/** Una copia «cifrada por trozos» de `size` bytes, como la sube la app nueva: CENITENC2 y bytes que no se repiten. */
function sealedCopy(size: number, seed = 1) {
  const bytes = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    bytes[i] = x >>> 24;
  }
  bytes.set(new TextEncoder().encode("CENITENC2"), 0);
  return bytes;
}

describe("peticiones de hoy (panel del proveedor)", () => {
  const op = { OPERATOR_EMAILS: "luis@clinica.es" };
  const keys = { CF_ACCOUNT_ID: "cuenta123", CF_API_TOKEN: "secreto-de-prueba" };
  const NOW = Date.UTC(2026, 9, 27, 15, 30);
  type Usage = { configured: boolean; today?: number | null; errors?: number | null; since?: string; limit: number; warnAt: number; error?: string };
  const ask = async (over: Record<string, unknown>, cf?: typeof fetch, token = "tok-luis") => {
    const res = await handle(request("GET", "/v1/proveedor/peticiones", { token }), env({ ...op, ...over }), { verifyToken, now: () => NOW, fetch: cf });
    return { status: res.status, body: (await res.json()) as Usage };
  };
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as Mock & typeof fetch;
  const rows = (...n: [number, number][]) => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: n.map(([requests, errors], i) => ({ sum: { requests, errors }, dimensions: { scriptName: `w${i}` } })) }] } } });

  it("solo lo ve quien gestiona el servidor", async () => {
    expect((await ask(keys, answer(rows([1, 0])), "tok-ana")).status).toBe(403);
  });

  it("sin token, dice que falta configurarlo (y el límite del plan gratuito)", async () => {
    const cf = answer(rows([1, 0]));
    expect((await ask({}, cf)).body).toEqual({ configured: false, limit: 100_000, warnAt: 70_000 });
    expect(cf).not.toHaveBeenCalled();
  });

  it("suma las de hoy de toda la cuenta, desde las 00:00 UTC, con el token de solo lectura", async () => {
    const cf = answer(rows([60_000, 12], [15_000, 3]));
    const { status, body } = await ask(keys, cf);
    expect(status).toBe(200);
    expect(body).toEqual({ configured: true, today: 75_000, errors: 15, since: "2026-10-27T00:00:00.000Z", limit: 100_000, warnAt: 70_000 });
    const [url, init] = (cf as unknown as Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secreto-de-prueba");
    const sent = JSON.parse(String(init.body)) as { query: string; variables: Record<string, string> };
    expect(sent.variables).toEqual({ account: "cuenta123", start: "2026-10-27T00:00:00.000Z", end: "2026-10-27T15:30:00.000Z" });
    expect(sent.query).toContain("workersInvocationsAdaptive");
    expect(JSON.stringify(body)).not.toContain("secreto");
  });

  it("DAILY_REQUESTS cambia el límite; 0 es el plan de pago, sin límite al día", async () => {
    expect((await ask({ ...keys, DAILY_REQUESTS: "200000" }, answer(rows([1, 0])))).body).toMatchObject({ limit: 200_000, warnAt: 140_000 });
    expect((await ask({ ...keys, DAILY_REQUESTS: "0" }, answer(rows([1, 0])))).body).toMatchObject({ limit: 0, warnAt: 0, today: 1 });
  });

  it("si Cloudflare falla, lo dice sin romper el panel", async () => {
    expect((await ask(keys, answer({}, 403))).body).toMatchObject({ configured: true, today: null, error: expect.stringContaining("Account Analytics") });
    expect((await ask(keys, answer({ errors: [{ message: "no autorizado" }] }))).body.error).toContain("no autorizado");
    expect((await ask(keys, answer({ data: { viewer: { accounts: [] } } }))).body.error).toContain("CF_ACCOUNT_ID");
    expect((await ask(keys, answer({}, 500))).body.error).toContain("500");
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const { status, body } = await ask(keys, down);
    expect(status).toBe(200);
    expect(body).toMatchObject({ today: null, error: expect.stringContaining("No se ha podido") });
  });
});

describe("copia de la clínica en R2", () => {
  let r2: FakeR2;
  beforeEach(() => {
    r2 = new FakeR2();
  });
  const MiB = 1024 * 1024;
  type Opts = { token?: string; body?: Uint8Array | string; json?: unknown; headers?: Record<string, string> };
  const go = (method: string, path: string, { token = "tok-ana", body, json, headers = {} }: Opts = {}, over: Record<string, unknown> = {}, now?: () => number) =>
    handle(
      new Request(BASE + path, {
        method,
        body: json !== undefined ? JSON.stringify(json) : (body as BodyInit | undefined),
        headers: { Authorization: `Bearer ${token}`, ...headers },
      }),
      env({ DOCS: r2, ...over }),
      { verifyToken, now },
    );
  async function clinic() {
    const res = await go("POST", "/v1/clinicas", { json: { name: "Fisiolab Centro" } });
    const id = ((await res.json()) as { id: string }).id;
    await go("PUT", `/v1/clinicas/${id}/miembros/eva@clinica.es`, { json: { role: "member" } });
    return id;
  }
  const NEW = "?v=2&trozos=1";
  type Started = { version: string; upload: string; partBytes: number };
  /** Como la app nueva: empieza, sube los trozos y termina. Devuelve la respuesta del final. */
  async function upload(id: string, bytes: Uint8Array, precondition: Record<string, string>, { seq = 0, token = "tok-ana" } = {}) {
    const base = `/v1/clinicas/${id}/copia/subida`;
    const start = await go("POST", `${base}${NEW}`, { token, headers: precondition });
    if (start.status !== 200) return start;
    const { version, upload, partBytes } = (await start.json()) as Started;
    const parts = [];
    for (let n = 1; (n - 1) * partBytes < bytes.byteLength; n++) {
      const res = await go("PUT", `${base}/${version}/${n}${NEW}&id=${upload}`, { token, body: bytes.subarray((n - 1) * partBytes, n * partBytes) });
      expect(res.status).toBe(200);
      parts.push((await res.json()) as { part: number; etag: string });
    }
    return go("POST", `${base}/${version}/fin${NEW}&id=${upload}&seq=${seq}`, { token, headers: precondition, json: { parts, size: bytes.byteLength } });
  }
  const versionOf = async (res: Response) => ((await res.json()) as { version: string }).version;
  const r2Keys = () => [...r2.objects.keys()].filter((k) => k.startsWith("copias/"));

  it("la app nueva la sube por trozos y la baja tal cual; las versiones anteriores tienen que actualizarse", async () => {
    const id = await clinic();
    const copy = sealedCopy(17 * MiB + 123);
    const res = await upload(id, copy, { "If-None-Match": "*" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string; size: number; epoch: string; base: number };
    expect(body).toMatchObject({ size: copy.byteLength, base: 0 });
    expect(body.epoch).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("ETag")).toBe(`"${body.version}"`);
    // En R2, en bytes; en D1 solo la cabecera (parts = 0) y ningún trozo.
    expect(r2Keys()).toEqual([`copias/clinic:${id}/${body.version}`]);
    expect(await db.prepare("SELECT parts, size FROM heads").first()).toEqual({ parts: 0, size: copy.byteLength });
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(0);

    const info = (await (await go("GET", `/v1/clinicas/${id}/copia/info${NEW}`, { token: "tok-eva" })).json()) as Record<string, unknown>;
    expect(info).toMatchObject({ version: body.version, size: copy.byteLength, pieces: true, epoch: body.epoch, base: 0, last: 0 });
    const got = await go("GET", `/v1/clinicas/${id}/copia${NEW}`, { token: "tok-eva" });
    expect(got.status).toBe(200);
    expect(got.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(got.headers.get("ETag")).toBe(`"${body.version}"`);
    expect(Buffer.from(await got.arrayBuffer()).equals(Buffer.from(copy))).toBe(true);
    // Los cambios siguen igual.
    expect((await go("POST", `/v1/clinicas/${id}/copia/cambios${NEW}`, { body: encrypted(200) })).status).toBe(200);

    // La versión anterior (sin &trozos=1) no sabe leerla: 426 en todo; y la de antes de los cambios, también.
    for (const [method, path] of [
      ["GET", "/copia/info?v=2"],
      ["GET", "/copia?v=2"],
      ["GET", "/copia/cambios?v=2&desde=0"],
      ["POST", "/copia/cambios?v=2"],
      ["PUT", "/copia?v=2&seq=1"],
      ["GET", "/copia"],
    ] as const) {
      const old = await go(method, `/v1/clinicas/${id}${path}`, { token: "tok-eva", body: method === "GET" ? undefined : encrypted(300), headers: { "If-Match": body.version } });
      expect(old.status, `${method} ${path}`).toBe(426);
    }
    // Ni la subida por trozos existe para ellas.
    expect((await go("POST", `/v1/clinicas/${id}/copia/subida?v=2`, { headers: { "If-Match": body.version } })).status).toBe(404);
    expect(r2Keys().length).toBe(1);
  });

  it("sustituir: solo con la versión vigente; la anterior se borra; si otra gana entre medias, 412 y no queda nada", async () => {
    const id = await clinic();
    const v1 = await versionOf(await upload(id, sealedCopy(6 * MiB, 1), { "If-None-Match": "*" }));
    expect((await upload(id, sealedCopy(MiB, 2), { "If-None-Match": "*" })).status).toBe(412);
    expect((await upload(id, sealedCopy(MiB, 2), { "If-Match": "otra" })).status).toBe(412);

    // Dos dispositivos empiezan a la vez con la misma versión: gana el primero que termina.
    const base = `/v1/clinicas/${id}/copia/subida`;
    const startB = (await (await go("POST", `${base}${NEW}`, { token: "tok-eva", headers: { "If-Match": v1 } })).json()) as Started;
    const partB = (await (await go("PUT", `${base}/${startB.version}/1${NEW}&id=${startB.upload}`, { token: "tok-eva", body: sealedCopy(MiB, 3) })).json()) as {
      part: number;
      etag: string;
    };
    const winner = await upload(id, sealedCopy(9 * MiB, 4), { "If-Match": `"${v1}"` }, { seq: 0 });
    expect(winner.status).toBe(200);
    const v2 = await versionOf(winner);
    const lost = await go("POST", `${base}/${startB.version}/fin${NEW}&id=${startB.upload}&seq=0`, {
      token: "tok-eva",
      headers: { "If-Match": v1 },
      json: { parts: [partB], size: MiB },
    });
    expect(lost.status).toBe(412);
    expect(((await lost.json()) as { version: string }).version).toBe(v2);
    expect(r2Keys()).toEqual([`copias/clinic:${id}/${v2}`]);
    expect(r2.uploads.size).toBe(0);
  });

  it("solo copias cifradas, en trozos de 8 MiB como mucho, con condición y con todos sus trozos; dejarla no deja nada", async () => {
    const id = await clinic();
    const base = `/v1/clinicas/${id}/copia/subida`;
    expect((await go("POST", `${base}${NEW}`)).status).toBe(428);
    const s = (await (await go("POST", `${base}${NEW}`, { headers: { "If-None-Match": "*" } })).json()) as Started;
    expect(s.partBytes).toBe(8 * MiB);
    const part = (n: number, body: Uint8Array) => go("PUT", `${base}/${s.version}/${n}${NEW}&id=${s.upload}`, { body });
    expect((await part(1, new TextEncoder().encode("SQLite format 3\u0000 sin cifrar"))).status).toBe(415);
    expect((await part(1, sealedCopy(8 * MiB + 1))).status).toBe(413);
    expect((await part(300, sealedCopy(MiB))).status).toBe(413);
    expect((await go("PUT", `${base}/${s.version}/1${NEW}`, { body: sealedCopy(MiB) })).status).toBe(400);
    const p1 = (await (await part(1, sealedCopy(8 * MiB))).json()) as { part: number; etag: string };
    const p2 = (await (await part(2, sealedCopy(MiB, 2))).json()) as { part: number; etag: string };
    const fin = (parts: unknown, size: unknown = 9 * MiB, headers: Record<string, string> = { "If-None-Match": "*" }, seq = "&seq=0") =>
      go("POST", `${base}/${s.version}/fin${NEW}&id=${s.upload}${seq}`, { headers, json: { parts, size } });
    expect((await fin([p2, p1])).status).toBe(400);
    expect((await fin([p1, p2], undefined, {})).status).toBe(428);
    expect((await fin([p1, p2], undefined, undefined, "")).status).toBe(400);
    expect((await fin([p1, p2], "mucho")).status).toBe(400);
    // Si la app se deja un trozo, R2 juntaría una copia cortada: no se guarda.
    expect((await fin([p1])).status).toBe(400);
    expect(r2Keys()).toEqual([]);
    expect(await count("SELECT count(*) AS n FROM heads")).toBe(0);
    // Esa subida ya no existe (R2 la cerró al juntarla).
    expect((await fin([p1, p2])).status).toBe(502);
    // Dejarla: R2 se olvida de los trozos y no queda copia.
    expect((await go("DELETE", `${base}/${s.version}${NEW}&id=${s.upload}`, { token: "tok-eva" })).status).toBe(204);
    expect(r2.uploads.size).toBe(0);
    expect((await go("GET", `/v1/clinicas/${id}/copia/info${NEW}`)).status).toBe(200);
    expect(r2Keys()).toEqual([]);
    // Quien no es del equipo, nada.
    expect((await go("POST", `${base}${NEW}`, { token: "tok-luis", headers: { "If-None-Match": "*" } })).status).toBe(403);
  });

  it("sin almacén R2 todo sigue en D1; con él, la copia pasa de D1 a R2 al subirla y vuelve si se sube entera", async () => {
    const id = await clinic();
    const copy = `/v1/clinicas/${id}/copia`;
    // Sin R2: la app lo sabe por la info y sube la copia entera, como siempre.
    expect(await (await go("GET", `${copy}/info${NEW}`, {}, { DOCS: undefined })).json()).toMatchObject({ version: null, pieces: false });
    expect((await go("POST", `${copy}/subida${NEW}`, { headers: { "If-None-Match": "*" } }, { DOCS: undefined })).status).toBe(501);
    const d1 = await go("PUT", `${copy}${NEW}&seq=0`, { body: encrypted(2_500_000), headers: { "If-None-Match": "*" } }, { DOCS: undefined });
    const v1 = await versionOf(d1);
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(4);
    const text = await (await go("GET", `${copy}${NEW}`)).text();
    expect(same(text, encrypted(2_500_000))).toBe(true);

    // Al activar R2, la siguiente copia entera va allí y los trozos de D1 sobran.
    const v2 = await versionOf(await upload(id, sealedCopy(MiB), { "If-Match": v1 }));
    expect(await count("SELECT count(*) AS n FROM parts")).toBe(0);
    expect(r2Keys()).toEqual([`copias/clinic:${id}/${v2}`]);
    // Si un dispositivo sube la copia entera a D1 (p. ej. con R2 quitado), la de R2 se borra.
    const v3 = await versionOf(await go("PUT", `${copy}${NEW}&seq=0`, { body: encrypted(3000, 2), headers: { "If-Match": v2 } }));
    expect(r2Keys()).toEqual([]);
    expect(await (await go("GET", `${copy}/info${NEW}`)).json()).toMatchObject({ version: v3, size: Math.floor((encrypted(3000, 2).length * 3) / 4) });
    // Y si la copia está en R2 pero se quita el enlace, lo dice.
    await upload(id, sealedCopy(MiB), { "If-Match": v3 });
    const broken = await go("GET", `${copy}${NEW}`, {}, { DOCS: undefined });
    expect(broken.status).toBe(500);
    expect(((await broken.json()) as { error: string }).error).toContain("DOCS");
  });

  it("borrarla (o borrar la clínica) la borra de R2; cuenta en el almacén, pero el tope nunca la rechaza", async () => {
    const id = await clinic();
    const DOC = "d".repeat(22);
    await db.prepare("INSERT INTO documents (clinic_id, id, form_id, size, created_at) VALUES ('otra', ?, NULL, ?, '2026-10-01')").bind(DOC, 9_999_000_000).run();
    // El almacén está casi lleno: la copia se guarda igual (los pacientes no pueden quedarse sin sincronizar)…
    const v1 = await versionOf(await upload(id, sealedCopy(2 * MiB), { "If-None-Match": "*" }));
    // …y con ella pasa del tope: los documentos ya no.
    const doc = new Uint8Array(1000);
    doc.set(new TextEncoder().encode("CENITDOC1"), 0);
    expect((await go("PUT", `/v1/clinicas/${id}/documentos/${DOC}`, { body: doc })).status).toBe(507);
    const usage = (await (await go("GET", `/v1/clinicas/${id}/documentos`)).json()) as { total: number };
    expect(usage.total).toBe(9_999_000_000 + 2 * MiB);
    const panel = (await (await go("GET", "/v1/proveedor", {}, { OPERATOR_EMAILS: "ana@clinica.es" })).json()) as {
      clinics: { id: string; size: number }[];
      documents: { total: number; copies: number };
    };
    expect(panel.clinics.find((c) => c.id === id)?.size).toBe(2 * MiB);
    expect(panel.documents).toMatchObject({ total: 9_999_000_000 + 2 * MiB, copies: 2 * MiB });
    // Y lo que ocupa la base D1, con su límite (500 MB, o D1_CAP_MB) y el aviso al 70 %.
    const db1 = (await (await go("GET", "/v1/proveedor", {}, { OPERATOR_EMAILS: "ana@clinica.es", D1_CAP_MB: "10000" })).json()) as {
      database: { bytes: number; cap: number; warnAt: number };
    };
    expect(db1.database.bytes).toBeGreaterThan(0);
    expect(db1.database).toMatchObject({ cap: 10_000_000_000, warnAt: 7_000_000_000 });
    expect(((await (await go("GET", "/v1/proveedor", {}, { OPERATOR_EMAILS: "ana@clinica.es" })).json()) as typeof db1).database.cap).toBe(500_000_000);

    // Borrar la copia es de quien administra; dejar una subida, de cualquiera del equipo (arriba).
    expect((await go("DELETE", `/v1/clinicas/${id}/copia${NEW}`, { token: "tok-eva" })).status).toBe(403);
    expect((await go("DELETE", `/v1/clinicas/${id}/copia${NEW}`)).status).toBe(204);
    expect(r2Keys()).toEqual([]);
    expect(v1).toMatch(/^[0-9a-f-]{36}$/);

    // Suspendida: se baja, no se sube.
    await upload(id, sealedCopy(MiB), { "If-None-Match": "*" });
    await db.prepare("INSERT INTO clinic_status (clinic_id, suspended_at) VALUES (?, '2026-10-01')").bind(id).run();
    expect((await go("GET", `/v1/clinicas/${id}/copia${NEW}`)).status).toBe(200);
    expect((await go("POST", `/v1/clinicas/${id}/copia/subida${NEW}`, { headers: { "If-None-Match": "*" } })).status).toBe(423);
    await db.prepare("UPDATE clinic_status SET suspended_at = NULL WHERE clinic_id = ?").bind(id).run();

    // La clínica a la papelera y, a los 30 días, fuera también de R2.
    expect((await go("DELETE", `/v1/clinicas/${id}`, { json: { declaration: "Conservo la copia descargada de la clínica." } })).status).toBe(200);
    expect(r2Keys().length).toBe(1);
    await go("GET", "/v1/yo", {}, {}, () => Date.now() + 31 * 86_400_000);
    expect(r2Keys()).toEqual([]);
  });
});
