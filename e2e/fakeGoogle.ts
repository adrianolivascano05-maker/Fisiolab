// Google de mentira para las pruebas de la nube: la pantalla de entrada (vuelve a la app con un token), el nombre
// y correo de la cuenta, y la carpeta de la app en Drive (en memoria, una por cuenta). Así se prueba todo el ir y
// venir sin cuentas reales ni red.
import { createHash, randomUUID, webcrypto } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { BrowserContext, Request, Route } from "@playwright/test";

export type FakeUser = { sub: string; email: string; name: string };
type File = { id: string; owner: string; bytes: Buffer; version: number; modifiedTime: string; name: string; mimeType: string; parents: string[]; trashed?: boolean };
export type FakeEvent = { id: string; status: string; summary: string; description: string; start: { dateTime: string }; end: { dateTime: string } };
type Calendar = { id: string; owner: string; summary: string; events: Map<string, FakeEvent> };
type BookingWindow = { pro: string; from: string; to: string };
export type FakeBooking = { clinic: string; startsAt: string; minutes: number; pro: string; kind: string; payload: string | null; cancelHash: string; collectedAt?: number; cancelledAt: string | null; cancelSeen: boolean };
type FakeCancelLink = { clinic: string; ref: string; startsAt: string; label: string; minutes: number; pro: string | null; cancelledAt: string | null; cancelSeen: boolean };

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
  /**
   * La copia de una cuenta descifrada con la contraseña, como texto ("" si aún no hay o no se puede abrir). Igual que
   * src/cloud/crypt.ts: «CENITENC1» + sal + vector de inicio + base comprimida y cifrada.
   */
  async drivePlain(who: string, password: string): Promise<string> {
    const bytes = this.appData(who)[0]?.bytes;
    return bytes ? FakeGoogle.open(bytes, password) : "";
  }
  private static keys = new Map<string, Promise<CryptoKey>>();
  static async open(bytes: Buffer, password: string): Promise<string> {
    if (bytes.subarray(0, 9).toString("latin1") !== "CENITENC1") return "";
    const salt = bytes.subarray(9, 25);
    const id = `${password}|${salt.toString("hex")}`;
    if (!FakeGoogle.keys.has(id)) {
      const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
      FakeGoogle.keys.set(id, webcrypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]));
    }
    try {
      const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(25, 37) }, await FakeGoogle.keys.get(id)!, bytes.subarray(37));
      return gunzipSync(Buffer.from(plain)).toString("latin1");
    } catch {
      return "";
    }
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

  /**
   * Copias en el servidor de Cloudflare simulado, ya decodificadas (solo con `server` en install): las de cada clínica
   * con «clinic:<id>» y las personales de antes con el `sub` de la cuenta.
   */
  server = new Map<string, { bytes: Buffer; version: string }>();
  /** Las clínicas del servidor simulado, con su equipo (correo → papel). */
  clinics = new Map<
    string,
    { name: string; members: Map<string, "admin" | "member">; suspended?: boolean; deleted?: { at: string; by: string; declaration: string; purgeAfter: string } }
  >();
  /** Quién gestiona el servidor (OPERATOR_EMAILS): las cuentas con estos nombres. */
  operators: string[] = [];
  /** Altas hechas desde el panel del proveedor (correos). */
  altas = new Set<string>();
  /** Solicitudes de acceso (correo → lo pedido). */
  requests = new Map<string, { clinic: string; note: string; status: "pending" | "rejected"; createdAt: string; answeredAt: string | null }>();
  /** La clave de recuperación de cada clínica (cerrada con su código). */
  recovery = new Map<string, string>();
  /** Quién puede crear clínicas (ALLOWED_EMAILS): las cuentas con estos nombres; null, todas. */
  creators: string[] | null = null;
  /** El servidor de antes de las clínicas: solo la copia de cada cuenta (/v1/copia). */
  oldServer = false;
  /** Sincronización por cambios (?v=2), como el servidor de ahora; false: como uno anterior, solo la copia entera. */
  deltaServer = true;
  /** Los lotes de cambios de cada clínica («clinic:<id>»), cifrados, y desde cuál lleva su copia entera. */
  deltas = new Map<string, { seq: number; data: Buffer }[]>();
  deltaBase = new Map<string, { epoch: string; seq: number }>();
  static SERVER = "https://cenit-datos.pruebas.workers.dev";
  /** Formularios para el paciente (como cloudflare/worker.js): cifrados; el paciente los abre y responde sin sesión. */
  forms = new Map<string, { clinic: string; request: string; expiresAt: string; response?: string; answeredAt?: string }>();
  /** Reserva online (como cloudflare/worker.js): la página de cada clínica, las reservas y los enlaces para anular. */
  bookingPages = new Map<
    string,
    {
      slug: string;
      publicKey: unknown;
      page: { clinic?: string; kinds?: { id: string; minutes: number }[]; minNoticeHours?: number; step?: number; pros?: { id: string; name: string }[]; disabled?: boolean };
      windows: BookingWindow[];
      envelope?: BookingWindow[];
    }
  >();
  bookings = new Map<string, FakeBooking>();
  cancelLinks = new Map<string, FakeCancelLink>();

  /** La copia de una clínica, buscada por su nombre. */
  clinicCopy(name: string) {
    const id = [...this.clinics].find(([, c]) => c.name === name)?.[0];
    return id ? this.server.get(`clinic:${id}`) : undefined;
  }
  /** Los lotes de cambios de una clínica que aún guarda el servidor. */
  clinicDeltas(name: string) {
    const id = [...this.clinics].find(([, c]) => c.name === name)?.[0];
    return id ? (this.deltas.get(`clinic:${id}`) ?? []) : [];
  }
  /** Lo que tiene el servidor de una clínica (la copia entera y sus cambios), descifrado, como texto. */
  async clinicText(name: string, password: string): Promise<string> {
    const parts = [this.clinicCopy(name)?.bytes, ...this.clinicDeltas(name).map((d) => d.data)].filter((b): b is Buffer => !!b);
    return (await Promise.all(parts.map((b) => FakeGoogle.open(b, password)))).join("\n");
  }

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

  /** El servidor de Cloudflare, con las reglas de cloudflare/worker.js: clínicas, su equipo y sus copias, solo cifradas. */
  private async worker(route: Route) {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, if-match, if-none-match",
      "access-control-expose-headers": "etag",
      "cache-control": "no-store",
    };
    const send = (status: number, json?: unknown) => route.fulfill(json === undefined ? { status, headers } : { status, headers, json });
    if (req.method() === "OPTIONS") return send(204);
    // Reservar y anular una cita: sin sesión.
    const booking = await this.publicBooking(req, send);
    if (booking !== false) return booking;
    // Lo que abre el paciente con su enlace: sin sesión.
    const pub = /^\/v1\/formularios\/([A-Za-z0-9_-]{22,64})(\/respuesta)?$/.exec(new URL(req.url()).pathname);
    if (pub) {
      const f = this.forms.get(pub[1]!);
      if (!f || this.clinics.get(f.clinic)?.deleted) return send(404, { error: "Este enlace ya no vale: ha caducado o la clínica lo ha anulado. Pide otro a tu fisioterapeuta." });
      if (!pub[2]) return send(200, { request: f.request, expiresAt: f.expiresAt, answered: !!f.answeredAt });
      if (f.answeredAt) return send(409, { error: "Este formulario ya se envió." });
      f.response = (JSON.parse(req.postData() ?? "{}") as { response: string }).response;
      f.answeredAt = new Date().toISOString();
      return send(200, { ok: true });
    }
    const user = this.user(req);
    if (!user) return send(401, { error: "Sesión caducada." });
    const method = req.method();
    const path = new URL(req.url()).pathname;
    const email = user.email.toLowerCase();
    const canCreate = !this.creators || this.creators.some((who) => this.users[who]!.email === user.email) || this.altas.has(email);
    const operator = this.operators.some((who) => this.users[who]!.email === user.email);
    const body = <T = { name?: string; role?: "admin" | "member" }>() => JSON.parse(req.postData() ?? "{}") as T;

    if (this.oldServer && !path.startsWith("/v1/copia")) return send(404, { error: "Esta dirección no existe." });
    if (path === "/v1/solicitud") {
      if (method === "DELETE") {
        if (this.requests.get(email)?.status === "pending") this.requests.delete(email);
        return send(204);
      }
      if (canCreate) return send(409, { error: "Tu cuenta ya puede dar de alta su clínica." });
      const b = body<{ clinic?: string; note?: string }>();
      const clinic = (b.clinic ?? "").replace(/\s+/g, " ").trim();
      if (!clinic) return send(400, { error: "Escribe el nombre de la clínica." });
      const prev = this.requests.get(email);
      if (prev?.status === "rejected") return send(409, { error: "Tu solicitud no se ha aceptado." });
      const r = { clinic, note: (b.note ?? "").trim(), status: "pending" as const, createdAt: prev?.createdAt ?? new Date().toISOString(), answeredAt: null };
      this.requests.set(email, r);
      return send(200, { clinic, status: "pending", createdAt: r.createdAt });
    }
    if (path === "/v1/yo")
      return send(200, {
        email,
        canCreate,
        operator,
        request: this.requests.has(email) ? { clinic: this.requests.get(email)!.clinic, status: this.requests.get(email)!.status, createdAt: this.requests.get(email)!.createdAt } : null,
        ...(operator ? { pendingRequests: [...this.requests.values()].filter((r) => r.status === "pending").length } : {}),
        clinics: [...this.clinics]
          .filter(([, c]) => c.members.has(email) && !c.deleted)
          .map(([id, c]) => ({ id, name: c.name, role: c.members.get(email), ...(c.suspended ? { suspended: true } : {}) })),
        deleted: [...this.clinics]
          .filter(([, c]) => c.deleted && c.members.get(email) === "admin")
          .map(([id, c]) => ({ id, name: c.name, deletedAt: c.deleted!.at, purgeAfter: c.deleted!.purgeAfter })),
      });
    if (path.startsWith("/v1/proveedor")) {
      if (!operator) return send(403, { error: "Solo quien gestiona el servidor puede verlo." });
      const rest = path.slice("/v1/proveedor".length);
      if (rest === "/contrato") return send(200, { html: "<p><strong>BORRADOR para revisar con un profesional.</strong></p><h2>Contrato de encargo del tratamiento</h2>" });
      const alta = /^\/altas\/(.+)$/.exec(rest);
      if (alta) {
        const who = decodeURIComponent(alta[1]!).toLowerCase();
        if (method === "PUT") {
          this.altas.add(who);
          this.requests.delete(who);
        } else this.altas.delete(who);
        return send(204);
      }
      const answer = /^\/solicitudes\/(.+)$/.exec(rest);
      if (answer) {
        const who = decodeURIComponent(answer[1]!).toLowerCase();
        const r = this.requests.get(who);
        if (method === "DELETE" || !r) {
          this.requests.delete(who);
          return send(r ? 204 : 404);
        }
        if (body<{ accept: boolean }>().accept) {
          this.altas.add(who);
          this.requests.delete(who);
        } else Object.assign(r, { status: "rejected", answeredAt: new Date().toISOString() });
        return send(200, {});
      }
      const act = /^\/clinicas\/([^/]+)\/(suspender|recuperar)$/.exec(rest);
      if (act) {
        const c = this.clinics.get(act[1]!)!;
        if (act[2] === "recuperar") delete c.deleted;
        else c.suspended = body<{ suspended: boolean }>().suspended;
        return send(200, {});
      }
      return send(200, {
        clinics: [...this.clinics].map(([id, c]) => ({
          id,
          name: c.name,
          createdBy: [...c.members.keys()][0],
          createdAt: new Date().toISOString(),
          members: c.members.size,
          admins: [...c.members].filter(([, r]) => r === "admin").map(([e]) => e),
          size: this.server.get(`clinic:${id}`)?.bytes.length ?? 0,
          lastSync: this.server.has(`clinic:${id}`) ? new Date().toISOString() : null,
          suspendedAt: c.suspended ? new Date().toISOString() : null,
          deletedAt: c.deleted?.at ?? null,
          deletedBy: c.deleted?.by ?? null,
          declaration: c.deleted?.declaration ?? null,
          purgeAfter: c.deleted?.purgeAfter ?? null,
        })),
        requests: [...this.requests].map(([e, r]) => ({ email: e, ...r })),
        creators: [...this.altas].map((e) => ({ email: e, source: "panel", addedBy: email, addedAt: new Date().toISOString() })),
      });
    }
    if (path === "/v1/clinicas" && method === "POST") {
      if (!canCreate) return send(403, { error: "Tu cuenta no puede crear clínicas en este servidor." });
      const id = randomUUID();
      this.clinics.set(id, { name: body().name!.trim(), members: new Map([[email, "admin"]]) });
      return send(201, { id, name: this.clinics.get(id)!.name, role: "admin" });
    }

    let owner: string;
    let rest: string;
    let admin = false;
    if (path.startsWith("/v1/copia")) {
      if (!canCreate) return send(403, { error: "Esta cuenta de Google no tiene permiso." });
      owner = user.sub;
      rest = path.slice(3);
    } else {
      const m = /^\/v1\/clinicas\/([^/]+)(\/.*)?$/.exec(path);
      const clinic = m ? this.clinics.get(m[1]!) : undefined;
      const role = clinic?.members.get(email);
      if (!m || !clinic || !role) return send(403, { error: "Tu cuenta no forma parte de esta clínica." });
      const id = m[1]!;
      admin = role === "admin";
      owner = `clinic:${id}`;
      rest = m[2] ?? "";
      const onlyAdmin = () => send(403, { error: "Solo quien administra la clínica puede hacerlo." });
      if (rest === "/recuperar") {
        if (!admin) return onlyAdmin();
        delete clinic.deleted;
        return send(200, { restored: true });
      }
      if (clinic.deleted) return send(410, { error: "Esta clínica está borrada." });
      if (clinic.suspended && method !== "GET" && rest !== "") return send(423, { error: "La clínica está suspendida: no se guardan cambios en el servidor." });
      const admins = () => [...clinic.members.values()].filter((r) => r === "admin").length;
      if (rest === "/reservas" || rest === "/reservas/recogidas" || rest === "/enlaces") return this.clinicBookings(id, rest, method, body, send);
      if (rest === "/formularios" && method === "POST") {
        const b = body<{ id: string; request: string; expiresAt: string }>();
        this.forms.set(b.id, { clinic: id, request: b.request, expiresAt: b.expiresAt });
        return send(201, { id: b.id });
      }
      if (rest === "/formularios" && method === "GET")
        return send(200, {
          forms: [...this.forms].filter(([, f]) => f.clinic === id && f.response).map(([fid, f]) => ({ id: fid, response: f.response, answeredAt: f.answeredAt })),
        });
      const formId = /^\/formularios\/([^/]+)$/.exec(rest);
      if (formId && method === "DELETE") {
        // Recogido: queda que se respondió, sin nada cifrado; anulado sin responder: se borra.
        const f = this.forms.get(formId[1]!);
        if (f?.answeredAt) Object.assign(f, { request: "", response: undefined });
        else this.forms.delete(formId[1]!);
        return send(204);
      }
      if (rest === "" && method === "PATCH") {
        if (!admin) return onlyAdmin();
        clinic.name = body().name!.trim();
        return send(200, { id, name: clinic.name, role });
      }
      if (rest === "" && method === "DELETE") {
        if (!admin) return onlyAdmin();
        const declaration = body<{ declaration?: string }>().declaration ?? "";
        if (declaration.length < 20) return send(400, { error: "Falta la declaración." });
        const purgeAfter = new Date(Date.now() + 30 * 86_400_000).toISOString();
        clinic.deleted = { at: new Date().toISOString(), by: email, declaration, purgeAfter };
        return send(200, { purgeAfter });
      }
      if (rest === "/recuperacion") {
        if (!admin) return onlyAdmin();
        if (method === "GET") return send(200, { blob: this.recovery.get(id) ?? null, updatedAt: null });
        this.recovery.set(id, body<{ blob: string }>().blob);
        return send(200, { updatedAt: new Date().toISOString() });
      }
      if (rest === "/miembros") return send(200, { members: [...clinic.members].map(([e, r]) => ({ email: e, role: r, addedAt: new Date().toISOString() })) });
      const mm = /^\/miembros\/(.+)$/.exec(rest);
      if (mm) {
        const who = decodeURIComponent(mm[1]!).trim().toLowerCase();
        if (method === "PUT") {
          if (!admin) return onlyAdmin();
          const r = body().role!;
          if (clinic.members.get(who) === "admin" && r === "member" && admins() === 1) return send(409, { error: "La clínica tiene que tener al menos un administrador." });
          clinic.members.set(who, r);
          return send(200, { email: who, role: r, addedAt: new Date().toISOString() });
        }
        if (who !== email && !admin) return onlyAdmin();
        if (clinic.members.get(who) === "admin" && admins() === 1) return send(409, { error: "La clínica tiene que tener al menos un administrador." });
        clinic.members.delete(who);
        return send(204);
      }
    }

    const mine = this.server.get(owner);
    const meta = (c: { bytes: Buffer; version: string }) => ({ version: c.version, size: c.bytes.length, updatedAt: new Date().toISOString() });
    // Sincronización por cambios: como cloudflare/worker.js (clinicCopy).
    const query = new URL(req.url()).searchParams;
    const v2 = this.deltaServer && owner.startsWith("clinic:") && query.get("v") === "2";
    const base = this.deltaBase.get(owner);
    const list = this.deltas.get(owner) ?? [];
    if (owner.startsWith("clinic:") && base && !v2) return send(426, { error: "Esta clínica usa ya la sincronización nueva: actualiza la app en este dispositivo." });
    if (v2 && rest === "/copia/info")
      return send(200, {
        ...(mine ? meta(mine) : { version: null, size: 0, updatedAt: null }),
        epoch: base?.epoch ?? null,
        base: base?.seq ?? null,
        last: Math.max(list.at(-1)?.seq ?? 0, base?.seq ?? 0),
        deltas: list.length,
        deltaSize: list.reduce((n, d) => n + d.data.length, 0),
      });
    if (v2 && rest === "/copia/cambios") {
      if (!base) return send(409, { error: "Sube primero la copia entera." });
      if (method === "POST") {
        const data = Buffer.from(req.postData() ?? "", "base64");
        if (!data.subarray(0, 9).equals(Buffer.from("CENITENC1"))) return send(415, { error: "Solo se guardan copias cifradas." });
        const seq = Math.max(list.at(-1)?.seq ?? 0, base.seq) + 1;
        this.deltas.set(owner, [...list, { seq, data }]);
        return send(200, { seq });
      }
      const since = Number(query.get("desde") ?? 0);
      if (since < base.seq) return send(200, { epoch: base.epoch, base: base.seq, deltas: [], more: false });
      const page = list.filter((d) => d.seq > since).slice(0, 100);
      return send(200, { epoch: base.epoch, base: base.seq, deltas: page.map((d) => ({ seq: d.seq, data: d.data.toString("base64") })), more: page.length === 100 });
    }
    if (rest === "/copia/info") return send(200, mine ? meta(mine) : { version: null, size: 0, updatedAt: null });
    if (rest !== "/copia") return send(404, { error: "No existe." });
    if (method === "GET")
      return mine
        ? route.fulfill({ status: 200, headers: { ...headers, etag: `"${mine.version}"`, "content-type": "text/plain; charset=utf-8" }, body: mine.bytes.toString("base64") })
        : send(404, { error: "Sin copia." });
    if (method === "DELETE") {
      if (owner !== user.sub && !admin) return send(403, { error: "Solo quien administra la clínica puede borrar su copia." });
      this.server.delete(owner);
      if (v2) {
        this.deltas.delete(owner);
        this.deltaBase.delete(owner);
      }
      return send(204);
    }
    // Como el servidor de verdad: la copia llega en base64 y tiene que estar cifrada.
    const data = Buffer.from(req.postData() ?? "", "base64");
    if (!data.subarray(0, 9).equals(Buffer.from("CENITENC1"))) return send(415, { error: "Solo se guardan copias cifradas." });
    const ifMatch = (req.headers()["if-match"] ?? "").replace(/"/g, "");
    const create = req.headers()["if-none-match"] === "*";
    if ((create && mine) || (!create && mine?.version !== ifMatch)) return send(412, { error: "La copia ha cambiado.", version: mine?.version ?? null });
    const copy = { bytes: data, version: `v${this.next++}` };
    this.server.set(owner, copy);
    if (v2) {
      const seq = Number(query.get("seq"));
      const b = { epoch: base?.epoch ?? randomUUID(), seq: Math.max(base?.seq ?? 0, seq) };
      this.deltaBase.set(owner, b);
      this.deltas.set(owner, list.filter((d) => d.seq > b.seq));
      return route.fulfill({ status: 200, headers: { ...headers, etag: `"${copy.version}"` }, json: { ...meta(copy), epoch: b.epoch, base: b.seq } });
    }
    return route.fulfill({ status: 200, headers: { ...headers, etag: `"${copy.version}"` }, json: meta(copy) });
  }

  /** Las franjas publicadas menos las reservas que no se han anulado. */
  private openWindows(clinic: string, windows: BookingWindow[]): BookingWindow[] {
    let out = windows.filter((w) => Date.parse(w.to) > Date.now());
    for (const b of this.bookings.values()) {
      // Las que no se han anulado ni recogido (o se acaban de recoger: 15 minutos).
      if (b.clinic !== clinic || b.cancelledAt || (b.collectedAt !== undefined && b.collectedAt < Date.now() - 15 * 60_000)) continue;
      const b0 = Date.parse(b.startsAt);
      const b1 = b0 + b.minutes * 60_000;
      out = out.flatMap((w) => {
        const f0 = Date.parse(w.from);
        const f1 = Date.parse(w.to);
        if (w.pro !== b.pro || b1 <= f0 || b0 >= f1) return [w];
        return [...(b0 > f0 ? [{ pro: w.pro, from: w.from, to: new Date(b0).toISOString() }] : []), ...(b1 < f1 ? [{ pro: w.pro, from: new Date(b1).toISOString(), to: w.to }] : [])];
      });
    }
    return out;
  }

  /** …/v1/reservas/<dirección> y …/v1/citas/<código>[/anular]. `false` si la ruta no es de estas. */
  private async publicBooking(req: Request, send: (status: number, json?: unknown) => Promise<void>): Promise<void | false> {
    const path = new URL(req.url()).pathname;
    const method = req.method();
    const reserva = /^\/v1\/reservas\/([a-z0-9-]{3,40})$/.exec(path);
    if (reserva) {
      const entry = [...this.bookingPages].find(([, p]) => p.slug === reserva[1]);
      if (!entry || this.clinics.get(entry[0])?.deleted || entry[1].page.disabled) return send(404, { error: "Esta clínica no tiene reserva por internet ahora mismo. Llama o escribe a la clínica para pedir cita." });
      const [clinic, p] = entry;
      if (method === "GET") return send(200, { page: p.page, publicKey: p.publicKey, windows: this.openWindows(clinic, p.windows) });
      const b = JSON.parse(req.postData() ?? "{}") as { kind?: string; startsAt?: string; pro?: string; payload?: string; cancelHash?: string };
      const kind = p.page.kinds?.find((k) => k.id === b.kind);
      if (!kind) return send(400, { error: "Elige el tipo de cita." });
      const at = Date.parse(b.startsAt ?? "");
      if (!Number.isFinite(at) || at < Date.now() + (p.page.minNoticeHours ?? 0) * 3_600_000 - 60_000) return send(400, { error: "Esa hora ya no se puede reservar: elige otra." });
      if (p.page.step && at % (p.page.step * 60_000) !== 0) return send(400, { error: "Esa hora ya no se puede reservar: elige otra." });
      if (!b.payload?.startsWith("CB1.") || !/^[0-9a-f]{64}$/.test(b.cancelHash ?? "")) return send(400, { error: "Faltan tus datos." });
      const free = this.openWindows(clinic, p.windows);
      const fits = (pro: string) => free.some((w) => w.pro === pro && Date.parse(w.from) <= at && at + kind.minutes * 60_000 <= Date.parse(w.to));
      const pro = b.pro ? (fits(b.pro) ? b.pro : null) : ([...new Set(free.map((w) => w.pro))].find(fits) ?? null);
      if (pro === null) return send(409, { error: "Ese hueco se acaba de ocupar: elige otra hora." });
      const id = randomUUID();
      const startsAt = new Date(at).toISOString();
      this.bookings.set(id, { clinic, startsAt, minutes: kind.minutes, pro, kind: kind.id, payload: b.payload, cancelHash: b.cancelHash!, cancelledAt: null, cancelSeen: false });
      return send(201, { id, startsAt, minutes: kind.minutes, pro });
    }
    const cita = /^\/v1\/citas\/([A-Za-z0-9_-]{20,64})(\/anular)?$/.exec(path);
    if (!cita) return false;
    const hash = createHash("sha256").update(cita[1]!).digest("hex");
    const fromBooking = [...this.bookings.values()].find((b) => b.cancelHash === hash);
    const link = this.cancelLinks.get(hash);
    const row = link ?? fromBooking;
    if (!row || this.clinics.get(row.clinic)?.deleted) return send(404, { error: "Este enlace no es válido o la cita ya pasó. Si quieres cambiar algo, escribe a la clínica." });
    const page = this.bookingPages.get(row.clinic);
    const past = Date.parse(row.startsAt) <= Date.now();
    if (!cita[2]) {
      const label = link ? link.label : (page?.page.pros?.find((x) => x.id === fromBooking!.pro)?.name ?? "");
      return send(200, {
        startsAt: row.startsAt,
        with: label,
        clinic: page?.page.clinic || this.clinics.get(row.clinic)!.name,
        cancelled: !!row.cancelledAt,
        past,
        slug: page && !page.page.disabled ? page.slug : null,
        pro: link ? link.pro : fromBooking!.pro,
      });
    }
    if (row.cancelledAt) return send(200, { cancelled: true });
    if (past) return send(409, { error: "La cita ya ha pasado: no se puede anular desde aquí." });
    const now = new Date().toISOString();
    if (fromBooking) fromBooking.cancelledAt = now;
    if (link) link.cancelledAt = now;
    // El hueco, libre en la página al momento.
    const minutes = link ? link.minutes : fromBooking!.minutes;
    const pro = link ? link.pro : fromBooking!.pro;
    if (page && !page.page.disabled && pro !== null && minutes > 0) {
      const from = Date.parse(row.startsAt);
      const to = from + minutes * 60_000;
      // Solo dentro de cuándo se puede reservar con ese fisio.
      const pieces = (page.envelope ?? [{ pro, from: row.startsAt, to: new Date(to).toISOString() }])
        .filter((w) => w.pro === pro)
        .map((w) => ({ pro, from: new Date(Math.max(from, Date.parse(w.from))).toISOString(), to: new Date(Math.min(to, Date.parse(w.to))).toISOString() }))
        .filter((w) => w.to > w.from);
      const spans = [...page.windows.filter((w) => w.pro === pro), ...pieces]
        .map((w) => [Date.parse(w.from), Date.parse(w.to)] as [number, number])
        .sort((x, y) => x[0] - y[0]);
      const merged: [number, number][] = [];
      for (const [a, b] of spans) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1]) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
      }
      page.windows = [...page.windows.filter((w) => w.pro !== pro), ...merged.map(([a, b]) => ({ pro, from: new Date(a).toISOString(), to: new Date(b).toISOString() }))];
    }
    return send(200, { cancelled: true });
  }

  /** Lo del equipo: publicar la página, recoger reservas y anulaciones y dar enlaces para anular. */
  private clinicBookings(clinic: string, rest: string, method: string, body: <T>() => T, send: (status: number, json?: unknown) => Promise<void>) {
    if (rest === "/reservas" && method === "PUT") {
      const b = body<{ enabled?: boolean; slug?: string; publicKey?: unknown; page?: never; windows?: BookingWindow[]; envelope?: BookingWindow[] }>();
      if (b.enabled === false) {
        const had = this.bookingPages.get(clinic);
        if (had) Object.assign(had, { page: { disabled: true }, windows: [], envelope: [] });
        return send(200, { enabled: false });
      }
      if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(b.slug ?? "")) return send(400, { error: "La dirección de la página solo puede llevar letras sin tilde, números y guiones (de 3 a 40)." });
      if ([...this.bookingPages].some(([c, p]) => p.slug === b.slug && c !== clinic)) return send(409, { error: "Esa dirección ya la usa otra clínica: elige otra." });
      this.bookingPages.set(clinic, { slug: b.slug!, publicKey: b.publicKey, page: b.page ?? {}, windows: b.windows ?? [], envelope: b.envelope });
      return send(200, { enabled: true, slug: b.slug });
    }
    if (rest === "/reservas") {
      return send(200, {
        slug: this.bookingPages.get(clinic)?.slug ?? null,
        bookings: [...this.bookings]
          .filter(([, b]) => b.clinic === clinic && (b.payload !== null || (b.cancelledAt && !b.cancelSeen)))
          .map(([id, b]) => ({ id, startsAt: b.startsAt, minutes: b.minutes, pro: b.pro, kind: b.kind, payload: b.payload, createdAt: b.startsAt, collected: b.payload === null, cancelledAt: b.cancelledAt })),
        cancels: [...this.cancelLinks]
          .filter(([, l]) => l.clinic === clinic && l.cancelledAt && !l.cancelSeen)
          .map(([hash, l]) => ({ hash, ref: l.ref, startsAt: l.startsAt, cancelledAt: l.cancelledAt })),
      });
    }
    if (rest === "/reservas/recogidas") {
      const b = body<{ bookings?: string[]; cancels?: string[] }>();
      for (const id of b.bookings ?? []) {
        const x = this.bookings.get(id);
        if (x?.clinic !== clinic) continue;
        x.payload = null;
        x.collectedAt ??= Date.now();
        if (x.cancelledAt) x.cancelSeen = true;
      }
      for (const h of b.cancels ?? []) {
        const l = this.cancelLinks.get(h);
        if (l?.clinic === clinic) l.cancelSeen = true;
      }
      return send(204);
    }
    const links = body<{ links?: { hash: string; ref: string; startsAt: string; label: string; minutes?: number; pro?: string | null; cancelled?: boolean }[] }>().links ?? [];
    for (const l of links) {
      if (!/^[0-9a-f]{64}$/.test(l.hash)) return send(400, { error: "Hay un enlace que no es válido." });
      const prev = this.cancelLinks.get(l.hash);
      if (prev && prev.clinic !== clinic) continue;
      const now = new Date().toISOString();
      this.cancelLinks.set(l.hash, {
        clinic,
        ref: l.ref,
        startsAt: l.startsAt,
        label: l.label,
        minutes: l.minutes ?? 0,
        pro: l.pro ?? null,
        cancelledAt: prev?.cancelledAt ?? (l.cancelled ? now : null),
        cancelSeen: (prev?.cancelSeen ?? false) || !!l.cancelled,
      });
      // Anulada por la clínica: también su reserva, si vino de internet.
      if (l.cancelled)
        for (const b of this.bookings.values())
          if (b.clinic === clinic && b.cancelHash === l.hash) Object.assign(b, { cancelledAt: b.cancelledAt ?? now, cancelSeen: true });
    }
    return send(200, { saved: links.length });
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
