// Google de mentira para las pruebas de la nube: la pantalla de entrada (vuelve a la app con un token), el nombre
// y correo de la cuenta, y la carpeta de la app en Drive (en memoria, una por cuenta). Así se prueba todo el ir y
// venir sin cuentas reales ni red.
import type { BrowserContext, Request, Route } from "@playwright/test";

export type FakeUser = { sub: string; email: string; name: string };
type File = { id: string; owner: string; bytes: Buffer; version: number; modifiedTime: string };

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-upload-content-type",
  "access-control-expose-headers": "location",
};

export class FakeGoogle {
  files: File[] = [];
  private tokens = new Map<string, FakeUser>();
  private next = 1;
  /** Si es false, entrar sin preguntar (prompt=none) falla como cuando la sesión de Google está cerrada. */
  sessionOpen = true;

  constructor(private users: Record<string, FakeUser>) {}

  /** La copia de una cuenta, como texto (SQLite guarda el texto tal cual: se puede buscar un nombre). */
  driveText(who: string): string {
    return this.files.find((f) => f.owner === this.users[who]!.sub)?.bytes.toString("latin1") ?? "";
  }
  /** Para buscar un texto con tildes dentro de la copia. */
  static enc = (s: string) => Buffer.from(s, "utf8").toString("latin1");

  /** Activa la nube en este contexto y simula Google. `who`: la cuenta que elegiría la persona en Google. */
  async install(ctx: BrowserContext, who: () => string) {
    await ctx.route("**/cloud.json", (r) => r.fulfill({ json: { googleClientId: "pruebas.apps.googleusercontent.com" } }));
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
      params.set("scope", u.searchParams.get("scope")!);
    }
    back.hash = params.toString();
    return route.fulfill({ status: 302, headers: { location: back.href } });
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
    const mine = this.files.filter((f) => f.owner === user.sub);
    const id = url.pathname.split("/").pop()!;

    if (url.pathname === "/oauth2/v3/userinfo") return json(user);
    if (url.pathname === "/drive/v3/files" && req.method() === "GET") {
      if (url.searchParams.get("spaces") !== "appDataFolder") return route.fulfill({ status: 403, headers: cors, json: { error: { message: "solo appDataFolder" } } });
      return json({ files: [...mine].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).map(meta) });
    }
    if (url.pathname.startsWith("/drive/v3/files/") && req.method() === "GET") {
      const f = mine.find((x) => x.id === id);
      return f ? route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/octet-stream" }, body: f.bytes }) : json({});
    }
    if (url.pathname.startsWith("/drive/v3/files/") && req.method() === "DELETE") {
      this.files = this.files.filter((x) => !(x.id === id && x.owner === user.sub));
      return route.fulfill({ status: 204, headers: cors });
    }
    if (url.pathname === "/upload/drive/v3/files" && req.method() === "POST") {
      // multipart/related: metadatos y después el archivo.
      const boundary = /boundary=(.+)$/.exec(req.headers()["content-type"] ?? "")![1]!;
      const body = req.postDataBuffer()!;
      const sep = Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
      const start = body.indexOf(sep) + sep.length;
      const end = body.lastIndexOf(Buffer.from(`\r\n--${boundary}--`));
      const f: File = { id: `file-${this.next++}`, owner: user.sub, bytes: body.subarray(start, end), version: 1, modifiedTime: new Date().toISOString() };
      this.files.push(f);
      return json(meta(f));
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
}
