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
    expect((await me("tok-luis", op)) as unknown).toMatchObject({ pendingRequests: 1 });
    expect((await me("tok-eva", op)) as unknown).not.toHaveProperty("pendingRequests");
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

    // El equipo recoge la respuesta y la borra; quien no es del equipo, no.
    expect((await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-eva")).status).toBe(403);
    const { forms } = (await (await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-ana")).json()) as { forms: { id: string; response: string }[] };
    expect(forms).toEqual([{ id: fid, response: "UkVTUA==", answeredAt: expect.any(String) }]);
    expect((await send("DELETE", `/v1/clinicas/${c.id}/formularios/${fid}`, "tok-ana")).status).toBe(204);
    // Recogido: ya no hay nada cifrado, pero el paciente ve que lo envió.
    expect(await (await pub("GET", `/v1/formularios/${fid}`)).json()).toEqual({ request: "", expiresAt, answered: true });
    expect(((await (await send("GET", `/v1/clinicas/${c.id}/formularios`, "tok-ana")).json()) as { forms: unknown[] }).forms).toEqual([]);
    expect(await count("SELECT count(*) AS n FROM patient_forms WHERE response IS NOT NULL OR request <> ''")).toBe(0);
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

  describe("reserva online", () => {
    const hour = 3_600_000;
    const T = Date.parse("2026-10-26T07:00:00.000Z");
    const at = (h: number) => new Date(T + h * hour).toISOString();
    const page = { clinic: "Fisiolab Centro", kinds: [{ id: "primera", label: "Primera visita", minutes: 60 }], minNoticeHours: 2, pros: [{ id: "p1", name: "Laura" }, { id: "p2", name: "Pablo" }] };
    const windows = [
      { pro: "p1", from: at(3), to: at(5) }, // de 3 a 5 horas desde ahora
      { pro: "p2", from: at(4), to: at(6) },
    ];
    const key = { kty: "EC", crv: "P-256", x: "x", y: "y" };
    const hash = (n: number) => String(n).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, "a");
    // Con la forma de lo que cifra el móvil del paciente (el servidor no lo puede abrir, solo mira la forma).
    const SEALED = `CB1.${"A".repeat(87)}=.${"B".repeat(16)}.${"C".repeat(40)}`;
    const pub = (method: string, path: string, data?: unknown, now = () => T, ip = "1.2.3.4") =>
      handle(request(method, path, { body: data === undefined ? undefined : JSON.stringify(data), headers: { "CF-Connecting-IP": ip } }), env(), { verifyToken, now });
    const team = (method: string, path: string, token: string, data?: unknown, now = () => T) =>
      handle(request(method, path, { token, body: data === undefined ? undefined : JSON.stringify(data) }), env(), { verifyToken, now });
    const book = (over: Record<string, unknown> = {}, ip?: string) =>
      pub("POST", "/v1/reservas/fisiolab-centro", { kind: "primera", pro: "p1", startsAt: at(3), payload: SEALED, cancelHash: hash(1), ...over }, () => T, ip);

    it("el equipo publica la página con franjas libres; el paciente reserva sin sesión y el hueco se ocupa", async () => {
      const c = await clinic();
      expect((await call("GET", "/v1/reservas/fisiolab-centro")).status).toBe(404);
      // Solo el equipo, con una dirección válida y la clave pública.
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-eva", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows })).status).toBe(403);
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "Fisiolab Centro", publicKey: key, page, windows })).status).toBe(400);
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", page, windows })).status).toBe(400);
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows })).status).toBe(200);
      // Otra clínica no puede quedarse con la misma dirección.
      const otra = await clinic("tok-luis", "Otra");
      expect((await team("PUT", `/v1/clinicas/${otra.id}/reservas`, "tok-luis", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows })).status).toBe(409);

      const shown = (await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { page: typeof page; publicKey: unknown; windows: unknown[] };
      expect(shown).toEqual({ page, publicKey: key, windows });
      // Datos que faltan, una hora que no está libre o sin la antelación mínima: no.
      expect((await book({ kind: "otra" })).status).toBe(400);
      expect((await book({ payload: "en claro" })).status).toBe(400);
      expect((await book({ payload: "CB1.a.b.c" })).status).toBe(400);
      expect((await book({ cancelHash: "corto" })).status).toBe(400);
      expect((await book({ startsAt: at(1) })).status).toBe(400);
      expect((await book({ startsAt: at(4.5) })).status).toBe(409); // la cita acabaría a las 5,5 h, fuera de su franja
      const ok = await book();
      expect(ok.status).toBe(201);
      expect(await ok.json()).toEqual({ id: expect.any(String), startsAt: at(3), minutes: 60, pro: "p1" });
      // Ese hueco ya no sale y no se puede volver a coger; con «cualquiera», el siguiente fisio libre.
      const after = (await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { windows: { pro: string; from: string; to: string }[] };
      expect(after.windows).toEqual([{ pro: "p1", from: at(4), to: at(5) }, { pro: "p2", from: at(4), to: at(6) }]);
      expect((await book({ cancelHash: hash(2) }, "5.6.7.8")).status).toBe(409);
      const any = await book({ pro: "", startsAt: at(4), cancelHash: hash(3) }, "5.6.7.8");
      expect(((await any.json()) as { pro: string }).pro).toBe("p1");
      // Lo cifrado del paciente nunca sale por la ruta pública.
      expect(JSON.stringify(after)).not.toContain("CB1.");
    });

    it("dos personas que reservan a la vez la misma hora con el mismo fisio: solo una se la queda", async () => {
      const c = await clinic();
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows });
      // La otra persona guarda su reserva justo después de que esta haya mirado los huecos y antes de que guarde la suya.
      const other = (start: string) =>
        db
          .prepare("INSERT INTO bookings (id, clinic_id, starts_at, minutes, pro, kind, payload, cancel_hash, client, created_at) VALUES (?, ?, ?, 60, 'p1', 'primera', 'x', ?, 'otro', ?)")
          .bind(crypto.randomUUID(), c.id, start, hash(Math.floor(Math.random() * 1e9)), at(0))
          .run();
      const racing = (start: string) => ({
        prepare(sql: string) {
          const st = db.prepare(sql);
          if (!sql.startsWith("INSERT INTO bookings")) return st;
          return {
            bind: (...v: unknown[]) => {
              const b = st.bind(...v);
              return {
                run: async () => {
                  await other(start);
                  return b.run();
                },
              };
            },
          };
        },
        batch: (steps: Parameters<typeof db.batch>[0]) => db.batch(steps),
      });
      const post = (start: string, n: number) =>
        handle(request("POST", "/v1/reservas/fisiolab-centro", { body: JSON.stringify({ kind: "primera", pro: "p1", startsAt: at(3), payload: SEALED, cancelHash: hash(n) }) }), env({ DB: racing(start) }), { verifyToken, now: () => T });
      // Se solapa (empieza media hora después): no.
      expect((await post(at(3.5), 5)).status).toBe(409);
      expect(await count("SELECT count(*) AS n FROM bookings WHERE client <> 'otro'")).toBe(0);
      // La otra acaba justo cuando empieza esta: sí.
      await db.prepare("DELETE FROM bookings").run();
      expect((await post(at(2), 6)).status).toBe(201);
    });

    it("el equipo recoge las reservas (se borran los datos cifrados) y ve las anulaciones; el paciente anula con su enlace", async () => {
      const c = await clinic();
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows });
      const token = "codigo-para-anular-123456";
      const cancelHash = await (async () => {
        const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
        return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
      })();
      const { id } = (await (await book({ cancelHash })).json()) as { id: string };
      type Inbox = { slug: string | null; bookings: { id: string; payload: string | null; collected: boolean; cancelledAt: string | null }[]; cancels: { ref: string }[] };
      const inbox = async () => (await (await team("GET", `/v1/clinicas/${c.id}/reservas`, "tok-ana")).json()) as Inbox;
      expect((await team("GET", `/v1/clinicas/${c.id}/reservas`, "tok-eva")).status).toBe(403);
      const first = await inbox();
      expect(first.slug).toBe("fisiolab-centro");
      expect(first.bookings).toEqual([expect.objectContaining({ id, payload: SEALED, collected: false, cancelledAt: null, kind: "primera", minutes: 60, pro: "p1" })]);
      expect((await team("POST", `/v1/clinicas/${c.id}/reservas/recogidas`, "tok-ana", { bookings: [id] })).status).toBe(204);
      expect((await inbox()).bookings).toEqual([]);
      expect(await count("SELECT count(*) AS n FROM bookings WHERE payload IS NOT NULL")).toBe(0);
      // Recién recogida, su hueco sigue ocupado (otro dispositivo de la clínica puede no tener aún la cita); pasado un
      // rato manda lo que publica la app.
      const slots = async (now: () => number) => ((await (await pub("GET", "/v1/reservas/fisiolab-centro", undefined, now)).json()) as { windows: { pro: string }[] }).windows;
      expect((await slots(() => T + 60_000)).filter((w) => w.pro === "p1")).toEqual([{ pro: "p1", from: at(4), to: at(5) }]);
      expect((await slots(() => T + 16 * 60_000)).filter((w) => w.pro === "p1")).toEqual([{ pro: "p1", from: at(3), to: at(5) }]);

      // El paciente ve su cita con su enlace y la anula; la clínica lo ve una vez.
      const seen = (await (await pub("GET", `/v1/citas/${token}`)).json()) as Record<string, unknown>;
      expect(seen).toEqual({ startsAt: at(3), with: "Laura", clinic: "Fisiolab Centro", cancelled: false, past: false, slug: "fisiolab-centro", pro: "p1" });
      expect((await pub("GET", `/v1/citas/${"x".repeat(24)}`)).status).toBe(404);
      expect((await pub("POST", `/v1/citas/${token}/anular`)).status).toBe(200);
      expect(((await (await pub("GET", `/v1/citas/${token}`)).json()) as { cancelled: boolean }).cancelled).toBe(true);
      expect((await inbox()).bookings).toEqual([expect.objectContaining({ id, collected: true, cancelledAt: expect.any(String) })]);
      await team("POST", `/v1/clinicas/${c.id}/reservas/recogidas`, "tok-ana", { bookings: [id] });
      expect((await inbox()).bookings).toEqual([]);
      // Anulada, el hueco vuelve a estar libre.
      expect((await book({ cancelHash: hash(4) }, "9.9.9.9")).status).toBe(201);
    });

    it("enlaces para anular citas que da la clínica, y no se anula una cita que ya ha pasado", async () => {
      const c = await clinic();
      const token = "otro-codigo-para-anular-99";
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      const h = [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
      expect((await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: "malo", ref: "cita-1", startsAt: at(24), label: "" }] })).status).toBe(400);
      expect((await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-1", startsAt: at(24), label: "con Pablo" }] })).status).toBe(200);
      // La cita se mueve: el mismo enlace, con la hora nueva.
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-1", startsAt: at(48), label: "con Pablo" }] });
      expect(await (await pub("GET", `/v1/citas/${token}`)).json()).toEqual({ startsAt: at(48), with: "con Pablo", clinic: "Fisiolab Centro", cancelled: false, past: false, slug: null, pro: null });
      expect((await pub("POST", `/v1/citas/${token}/anular`, undefined, () => T + 49 * hour)).status).toBe(409);
      expect((await pub("POST", `/v1/citas/${token}/anular`)).status).toBe(200);
      const inbox = (await (await team("GET", `/v1/clinicas/${c.id}/reservas`, "tok-ana")).json()) as { cancels: { hash: string; ref: string }[] };
      expect(inbox.cancels).toEqual([expect.objectContaining({ hash: h, ref: "cita-1" })]);
      await team("POST", `/v1/clinicas/${c.id}/reservas/recogidas`, "tok-ana", { cancels: [h] });
      expect(((await (await team("GET", `/v1/clinicas/${c.id}/reservas`, "tok-ana")).json()) as { cancels: unknown[] }).cancels).toEqual([]);
    });

    it("si la clínica mueve o anula la cita, el paciente lo ve en su enlace (y no vuelve como aviso)", async () => {
      const c = await clinic();
      const token = "codigo-de-una-cita-movida-1";
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      const h = [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-9", startsAt: at(24), label: "", minutes: 45, pro: null }] });
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-9", startsAt: at(26), label: "", minutes: 45, pro: null, cancelled: true }] });
      expect(await (await pub("GET", `/v1/citas/${token}`)).json()).toEqual(expect.objectContaining({ startsAt: at(26), cancelled: true }));
      expect(await (await pub("POST", `/v1/citas/${token}/anular`)).json()).toEqual({ cancelled: true });
      expect(((await (await team("GET", `/v1/clinicas/${c.id}/reservas`, "tok-ana")).json()) as { cancels: unknown[] }).cancels).toEqual([]);
    });

    it("al anular una cita que dio la clínica, el hueco sale libre en la página al momento (junto al de al lado)", async () => {
      const c = await clinic();
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows });
      const token = "codigo-de-una-cita-de-pablo";
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      const h = [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
      // Pablo tiene una cita justo después de su franja libre; otra cita sin nadie de la reserva no abre hueco.
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-2", startsAt: at(6), label: "con Pablo", minutes: 60, pro: "p2" }, { hash: hash(7), ref: "cita-3", startsAt: at(8), label: "", minutes: 45, pro: null }] });
      expect((await pub("POST", `/v1/citas/${token}/anular`)).status).toBe(200);
      const shown = (await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { windows: unknown[] };
      expect(shown.windows).toEqual([{ pro: "p1", from: at(3), to: at(5) }, { pro: "p2", from: at(4), to: at(7) }]);
      // Y ya se puede reservar esa hora con él.
      expect((await book({ pro: "p2", startsAt: at(6), cancelHash: hash(8) })).status).toBe(201);
    });

    it("agenda cerrada: al anular, solo queda libre lo que está dentro de cuándo se puede reservar; la página no enseña ese contorno", async () => {
      const c = await clinic();
      // Pablo cierra su agenda a partir de la hora 7: se puede reservar con él de 4 a 7.
      const envelope = [{ pro: "p1", from: at(3), to: at(5) }, { pro: "p2", from: at(4), to: at(7) }];
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows, envelope });
      const shown = (await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { page: Record<string, unknown> };
      expect(shown.page).toEqual(page);
      const token = "cita-de-pablo-que-cruza-su-cierre";
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      const h = [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
      // Una cita de 6 a 8 (dada antes de cerrar): al anularla, solo sale libre de 6 a 7.
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: h, ref: "cita-5", startsAt: at(6), label: "con Pablo", minutes: 120, pro: "p2" }] });
      expect((await pub("POST", `/v1/citas/${token}/anular`)).status).toBe(200);
      const after = (await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { windows: unknown[] };
      expect(after.windows).toEqual([{ pro: "p1", from: at(3), to: at(5) }, { pro: "p2", from: at(4), to: at(7) }]);
    });

    it("si la app vuelve a publicar antes de recoger una anulación, ese hueco sigue libre (la app aún tiene la cita)", async () => {
      const c = await clinic();
      const sha = async (t: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const envelope = [{ pro: "p1", from: at(3), to: at(5) }, { pro: "p2", from: at(4), to: at(7) }];
      const publish = (w: unknown[]) => team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows: w, envelope });
      const shown = async () => ((await (await pub("GET", "/v1/reservas/fisiolab-centro")).json()) as { windows: unknown[] }).windows;
      await publish(windows);
      // Una reserva por internet que la clínica ya ha recogido (la app la tiene en la agenda y publica sin ese rato).
      const { id } = (await (await book({ cancelHash: await sha("codigo-de-la-reserva-de-marta") })).json()) as { id: string };
      await team("POST", `/v1/clinicas/${c.id}/reservas/recogidas`, "tok-ana", { bookings: [id] });
      // Y una cita que dio la clínica a Pablo, de 6 a 7.
      await team("POST", `/v1/clinicas/${c.id}/enlaces`, "tok-ana", { links: [{ hash: await sha("codigo-de-la-cita-de-luis"), ref: "cita-9", startsAt: at(6), label: "con Pablo", minutes: 60, pro: "p2" }] });
      const busy = [{ pro: "p1", from: at(4), to: at(5) }, { pro: "p2", from: at(4), to: at(6) }];
      await publish(busy);
      // Los dos pacientes anulan; la app aún no lo ha visto y vuelve a publicar con sus citas: los huecos siguen libres.
      expect((await pub("POST", "/v1/citas/codigo-de-la-reserva-de-marta/anular")).status).toBe(200);
      expect((await pub("POST", "/v1/citas/codigo-de-la-cita-de-luis/anular")).status).toBe(200);
      await publish(busy);
      expect(await shown()).toEqual([{ pro: "p1", from: at(3), to: at(5) }, { pro: "p2", from: at(4), to: at(7) }]);
      // Cuando la clínica las recoge, manda lo que publica la app (que ya sabe que están anuladas).
      await team("POST", `/v1/clinicas/${c.id}/reservas/recogidas`, "tok-ana", { bookings: [id], cancels: [await sha("codigo-de-la-cita-de-luis")] });
      await publish(busy);
      expect(await shown()).toEqual(busy);
    });

    it("solo las horas de la lista; al apagar la reserva, la dirección sigue siendo de la clínica", async () => {
      const c = await clinic();
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page: { ...page, step: 15 }, windows });
      expect((await book({ startsAt: new Date(T + 3 * hour + 7 * 60_000).toISOString() })).status).toBe(400);
      expect((await book({ startsAt: new Date(T + 3 * hour + 15 * 60_000).toISOString() })).status).toBe(201);
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: false })).status).toBe(200);
      expect((await pub("GET", "/v1/reservas/fisiolab-centro")).status).toBe(404);
      const otra = await clinic("tok-luis", "Otra");
      expect((await team("PUT", `/v1/clinicas/${otra.id}/reservas`, "tok-luis", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows })).status).toBe(409);
      // Al volver a encenderla, la misma dirección.
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows })).status).toBe(200);
      expect((await pub("GET", "/v1/reservas/fisiolab-centro")).status).toBe(200);
    });

    it("límites: tres reservas al día desde un mismo origen; sin página, nada; apagar la reserva quita la página", async () => {
      const c = await clinic();
      const wide = [{ pro: "p1", from: at(3), to: at(30) }];
      await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: true, slug: "fisiolab-centro", publicKey: key, page, windows: wide });
      for (let i = 0; i < 3; i++) expect((await book({ startsAt: at(3 + i * 2), cancelHash: hash(10 + i) })).status).toBe(201);
      expect((await book({ startsAt: at(12), cancelHash: hash(20) })).status).toBe(429);
      expect((await book({ startsAt: at(12), cancelHash: hash(20) }, "8.8.8.8")).status).toBe(201);
      expect((await team("PUT", `/v1/clinicas/${c.id}/reservas`, "tok-ana", { enabled: false })).status).toBe(200);
      expect((await pub("GET", "/v1/reservas/fisiolab-centro")).status).toBe(404);
    });
  });

  it("la copia personal de antes sigue solo para ALLOWED_EMAILS", async () => {
    expect((await call("GET", "/v1/copia/info", { token: "tok-eva" })).status).toBe(403);
    expect((await call("GET", "/v1/copia/info", { token: "tok-ana" })).status).toBe(200);
  });
});
