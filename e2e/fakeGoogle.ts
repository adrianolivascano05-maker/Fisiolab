// Google de mentira para las pruebas de la nube: la pantalla de entrada (vuelve a la app con un token), el nombre
// y correo de la cuenta, y la carpeta de la app en Drive (en memoria, una por cuenta). Así se prueba todo el ir y
// venir sin cuentas reales ni red.
import type { BrowserContext, Request, Route } from "@playwright/test";

export type FakeUser = { sub: string; email: string; name: string };
type File = { id: string; owner: string; bytes: Buffer; version: number; modifiedTime: string; name: string; mimeType: string; parents: string[]; trashed?: boolean };
export type FakeEvent = { id: string; status: string; summary: string; description: string; start: { dateTime: string }; end: { dateTime: string } };
type Calendar = { id: string; owner: string; summary: string; events: Map<string, FakeEvent> };

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-upload-content-type",
  "access-control-expose-headers": "location",
};

export class FakeGoogle {
  files: File[] = [];
  calendars: Calendar[] = [];
  private tokens = new Map<string, FakeUser>();
  private next = 1;
  /** Si es false, entrar sin preguntar (prompt=none) falla como cuando la sesión de Google está cerrada. */
  sessionOpen = true;
  /** Permisos que la persona no acepta en la pantalla de Google (p. ej. «drive.file»). */
  withheld: string[] = [];

  constructor(private users: Record<string, FakeUser>) {}

  /** La copia de una cuenta, como texto (SQLite guarda el texto tal cual: se puede buscar un nombre). */
  driveText(who: string): string {
    return this.appData(who)[0]?.bytes.toString("latin1") ?? "";
  }
  /** Las copias de la carpeta oculta de la app. */
  appData(who: string): File[] {
    return this.files.filter((f) => f.owner === this.users[who]!.sub && f.parents.includes("appDataFolder"));
  }
  /** Los archivos a la vista (carpetas, informes, CSV). */
  visible(who: string): File[] {
    return this.files.filter((f) => f.owner === this.users[who]!.sub && !f.parents.includes("appDataFolder"));
  }
  /** Los eventos no cancelados de los calendarios de una cuenta. */
  events(who: string): FakeEvent[] {
    return this.calendars.filter((c) => c.owner === this.users[who]!.sub).flatMap((c) => [...c.events.values()].filter((e) => e.status !== "cancelled"));
  }
  /** Para buscar un texto con tildes dentro de la copia. */
  static enc = (s: string) => Buffer.from(s, "utf8").toString("latin1");

  /** Copias en el servidor de Cloudflare simulado, por `sub`, ya decodificadas (solo con `server` en install). */
  server = new Map<string, { bytes: Buffer; version: string }>();
  static SERVER = "https://cenit-datos.pruebas.workers.dev";

  /**
   * Simula Google en este contexto. `who`: la cuenta que elegiría la persona en Google. `publish`: la app publicada
   * lleva el ID de cliente (si no, hay que pegarlo en el dispositivo). `server`: la app usa además el servidor de
   * la clínica en Cloudflare (cloudflare/worker.js), simulado aquí con las mismas reglas.
   */
  async install(ctx: BrowserContext, who: () => string, { publish = true, server = false } = {}) {
    if (publish)
      await ctx.route("**/cloud.json", (r) =>
        r.fulfill({ json: { googleClientId: "123456789012-pruebas.apps.googleusercontent.com", ...(server ? { cloudflareUrl: FakeGoogle.SERVER } : {}) } }),
      );
    if (server) await ctx.route(`${FakeGoogle.SERVER}/**`, (r) => this.worker(r));
    await ctx.route("https://accounts.google.com/o/oauth2/v2/auth?**", (r) => this.auth(r, who()));
    await ctx.route("https://www.googleapis.com/**", (r) => this.api(r));
    await ctx.route("https://oauth2.googleapis.com/revoke", (r) => r.fulfill({ status: 200, headers: cors, body: "" }));
  }

  private auth(route: Route, who: string) {
    const u = new URL(route.request().url());
    const back = new URL(u.searchParams.get("redirect_uri")!);
    const hint = u.searchParams.get("login_hint");
    const user = hint ? Object.values(this.users).find((x) => x.email === hint)! : this.users[who]!;
    const params = new URLSearchParams({ state: u.searchParams.get("state")! });
    if (u.searchParams.get("prompt") === "none" && !this.sessionOpen) params.set("error", "login_required");
    else {
      const token = `token-${this.next++}`;
      this.tokens.set(token, user);
      params.set("access_token", token);
      params.set("token_type", "Bearer");
      params.set("expires_in", "3599");
      params.set("scope", u.searchParams.get("scope")!.split(" ").filter((sc) => !this.withheld.some((w) => sc.endsWith(w))).join(" "));
    }
    back.hash = params.toString();
    return route.fulfill({ status: 302, headers: { location: back.href } });
  }

  /** El servidor de Cloudflare: una copia por cuenta, con versión, y solo cifrada. */
  private async worker(route: Route) {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, if-match, if-none-match",
      "access-control-expose-headers": "etag",
      "cache-control": "no-store",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const user = this.user(req);
    if (!user) return route.fulfill({ status: 401, headers, json: { error: "Sesión caducada." } });
    const path = new URL(req.url()).pathname;
    const mine = this.server.get(user.sub);
    const meta = (c: { bytes: Buffer; version: string }) => ({ version: c.version, size: c.bytes.length, updatedAt: new Date().toISOString() });
    if (path === "/v1/copia/info") return route.fulfill({ status: 200, headers, json: mine ? meta(mine) : { version: null, size: 0, updatedAt: null } });
    if (path !== "/v1/copia") return route.fulfill({ status: 404, headers, json: { error: "No existe." } });
    if (req.method() === "GET")
      return mine
        ? route.fulfill({ status: 200, headers: { ...headers, etag: `"${mine.version}"`, "content-type": "text/plain; charset=utf-8" }, body: mine.bytes.toString("base64") })
        : route.fulfill({ status: 404, headers, json: { error: "Sin copia." } });
    if (req.method() === "DELETE") {
      this.server.delete(user.sub);
      return route.fulfill({ status: 204, headers });
    }
    // Como el servidor de verdad: la copia llega en base64 y tiene que estar cifrada.
    const body = Buffer.from(req.postData() ?? "", "base64");
    if (!body.subarray(0, 9).equals(Buffer.from("CENITENC1"))) return route.fulfill({ status: 415, headers, json: { error: "Solo se guardan copias cifradas." } });
    const ifMatch = (req.headers()["if-match"] ?? "").replace(/"/g, "");
    const create = req.headers()["if-none-match"] === "*";
    if ((create && mine) || (!create && mine?.version !== ifMatch)) return route.fulfill({ status: 412, headers, json: { error: "La copia ha cambiado.", version: mine?.version ?? null } });
    const copy = { bytes: body, version: `v${this.next++}` };
    this.server.set(user.sub, copy);
    return route.fulfill({ status: 200, headers: { ...headers, etag: `"${copy.version}"` }, json: meta(copy) });
  }

  private user(req: Request) {
    return this.tokens.get((req.headers()["authorization"] ?? "").replace("Bearer ", ""));
  }

  private api(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const user = this.user(req);
    if (!user) return route.fulfill({ status: 401, headers: cors, json: { error: { message: "Invalid Credentials" } } });
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ status: 200, headers: cors, json: body });
    const meta = (f: File) => ({ id: f.id, version: String(f.version), modifiedTime: f.modifiedTime });
    const id = url.pathname.split("/").pop()!;

    if (url.pathname === "/oauth2/v3/userinfo") return json(user);
    if (url.pathname.startsWith("/calendar/v3/")) return this.calendar(route, user, url);
    const mineAll = this.files.filter((f) => f.owner === user.sub);
    const mine = mineAll.filter((f) => f.parents.includes("appDataFolder"));
    if (url.pathname === "/drive/v3/files" && req.method() === "GET") {
      if (url.searchParams.get("spaces") === "appDataFolder")
        return json({ files: [...mine].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).map(meta) });
      // drive.file: solo los archivos a la vista que creó la app; se filtra por nombre y tipo como en la consulta.
      const q = url.searchParams.get("q") ?? "";
      const name = /name = '([^']+)'/.exec(q)?.[1];
      const mime = /mimeType = '([^']+)'/.exec(q)?.[1];
      const found = mineAll.filter((f) => !f.parents.includes("appDataFolder") && !f.trashed && (!name || f.name === name) && (!mime || f.mimeType === mime));
      return json({ files: found.map((f) => ({ id: f.id })) });
    }
    if (url.pathname === "/drive/v3/files" && req.method() === "POST") {
      // Carpeta nueva (solo metadatos).
      const m = req.postDataJSON() as { name: string; mimeType: string; parents?: string[] };
      const f: File = { id: `file-${this.next++}`, owner: user.sub, bytes: Buffer.alloc(0), version: 1, modifiedTime: new Date().toISOString(), name: m.name, mimeType: m.mimeType, parents: m.parents ?? ["root"] };
      this.files.push(f);
      return json({ id: f.id });
    }
    if (url.pathname.startsWith("/drive/v3/files/") && req.method() === "GET") {
      const f = mineAll.find((x) => x.id === id);
      if (!f) return route.fulfill({ status: 404, headers: cors, json: { error: { message: "File not found" } } });
      if (url.searchParams.get("alt") === "media") return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/octet-stream" }, body: f.bytes });
      return json({ id: f.id, trashed: !!f.trashed });
    }
    if (url.pathname.startsWith("/drive/v3/files/") && req.method() === "DELETE") {
      this.files = this.files.filter((x) => !(x.id === id && x.owner === user.sub));
      return route.fulfill({ status: 204, headers: cors });
    }
    if (url.pathname === "/upload/drive/v3/files" && req.method() === "POST") {
      // multipart/related: los metadatos (JSON) y después el archivo.
      const boundary = /boundary=(.+)$/.exec(req.headers()["content-type"] ?? "")![1]!;
      const body = req.postDataBuffer()!;
      const parts = body.toString("latin1").split(`--${boundary}`);
      const m = JSON.parse(Buffer.from(parts[1]!.split("\r\n\r\n")[1]!, "latin1").toString("utf8").trim()) as { name: string; mimeType: string; parents: string[] };
      const head = `--${boundary}${parts[2]!.split("\r\n\r\n")[0]}\r\n\r\n`;
      const start = body.indexOf(Buffer.from(head, "latin1")) + Buffer.byteLength(head, "latin1");
      const end = body.lastIndexOf(Buffer.from(`\r\n--${boundary}--`));
      const f: File = { id: `file-${this.next++}`, owner: user.sub, bytes: body.subarray(start, end), version: 1, modifiedTime: new Date().toISOString(), name: m.name, mimeType: m.mimeType, parents: m.parents };
      this.files.push(f);
      return json({ ...meta(f), webViewLink: `https://drive.google.com/file/d/${f.id}/view` });
    }
    if (url.pathname.startsWith("/upload/drive/v3/files/") && req.method() === "PATCH") {
      const f = mine.find((x) => x.id === id)!;
      f.bytes = req.postDataBuffer()!;
      f.version++;
      f.modifiedTime = new Date().toISOString();
      return json(meta(f));
    }
    return route.fulfill({ status: 400, headers: cors, json: { error: { message: `no simulado: ${req.method()} ${url.pathname}` } } });
  }

  /** Google Calendar: los calendarios que crea la app y sus eventos (ids propios, 409 si ya existe). */
  private calendar(route: Route, user: FakeUser, url: URL) {
    const req = route.request();
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, json: body });
    const notFound = () => json({ error: { message: "Not Found" } }, 404);
    const parts = url.pathname.replace("/calendar/v3/", "").split("/").map(decodeURIComponent);
    if (parts[0] !== "calendars") return notFound();
    if (parts.length === 1 && req.method() === "POST") {
      const body = req.postDataJSON() as { summary: string };
      const c: Calendar = { id: `cal-${this.next++}@group.calendar.google.com`, owner: user.sub, summary: body.summary, events: new Map() };
      this.calendars.push(c);
      return json({ id: c.id, summary: c.summary });
    }
    const c = this.calendars.find((x) => x.id === parts[1] && x.owner === user.sub);
    if (!c) return notFound();
    if (parts.length === 2 && req.method() === "GET") return json({ id: c.id, summary: c.summary });
    if (parts[2] !== "events") return notFound();
    const evId = parts[3];
    if (!evId && req.method() === "GET") {
      const min = Date.parse(url.searchParams.get("timeMin") ?? "1970-01-01T00:00:00Z");
      return json({ items: [...c.events.values()].filter((e) => e.status !== "cancelled" && Date.parse(e.end.dateTime) > min) });
    }
    if (!evId && req.method() === "POST") {
      const e = req.postDataJSON() as FakeEvent;
      if (!/^[a-v0-9]{5,1024}$/.test(e.id)) return json({ error: { message: "Invalid resource id value." } }, 400);
      if (c.events.has(e.id)) return json({ error: { message: "The requested identifier already exists." } }, 409);
      c.events.set(e.id, { ...e, status: "confirmed" });
      return json(e);
    }
    if (evId && req.method() === "PUT") {
      if (!c.events.has(evId)) return notFound();
      const e = req.postDataJSON() as FakeEvent;
      c.events.set(evId, { ...e, id: evId });
      return json(e);
    }
    if (evId && req.method() === "DELETE") {
      const e = c.events.get(evId);
      if (!e || e.status === "cancelled") return json({ error: { message: "Resource has been deleted" } }, 410);
      e.status = "cancelled";
      return route.fulfill({ status: 204, headers: cors });
    }
    return notFound();
  }
}
