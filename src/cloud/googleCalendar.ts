// Las citas solas en Google Calendar (src/cloud/README.md). Con el permiso calendar.app.created la app crea su
// propio calendario («Cénit · Citas») en la cuenta de quien entra y solo puede tocar ese calendario, no los demás.
// Cada siguiente cita (la de la última sesión de cada paciente) es un evento con un id fijo sacado de la sesión:
// apuntarla dos veces, o desde dos dispositivos, deja un solo evento. Las citas que ya han pasado o empezado no
// se tocan nunca.
import { visitEvent, end, type CalendarEvent, type EventNames } from "../clinical/calendar";
import { upcomingVisits } from "../data/clinical";
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import type { Account } from "./account";
import { getToken, hasGranted, CALENDAR_SCOPE } from "./auth";
import { AuthError, call, GoogleError } from "./drive";

const API = "https://www.googleapis.com/calendar/v3";
export const CALENDAR_NAME = "Cénit · Citas";
const TZ = "Europe/Madrid";

/** Ajustes sincronizados: si se apuntan las citas y cómo sale el paciente; y el id del calendario de la app. */
export const CALENDAR_SETTINGS = "calendar_auto";
const CALENDAR_ID = "calendar_id";
export type CalendarSettings = { enabled: boolean; names: EventNames };
// Por defecto, solo las iniciales: el nombre completo de un paciente no tiene por qué estar en Google.
export const defaultCalendarSettings: CalendarSettings = { enabled: true, names: "initials" };

export async function getCalendarSettings(db: Db): Promise<CalendarSettings> {
  return { ...defaultCalendarSettings, ...((await getSetting<Partial<CalendarSettings>>(db, CALENDAR_SETTINGS)) ?? {}) };
}

// ---------- API de Google Calendar ----------

type GEvent = { id: string; status?: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string } };

/** El id del evento: Google solo acepta letras de la a a la v y números (base32hex). */
export function eventId(sessionId: string): string {
  const hex = /^[0-9a-f-]+$/i.test(sessionId)
    ? sessionId.toLowerCase().replace(/-/g, "")
    : Array.from(new TextEncoder().encode(sessionId), (b) => b.toString(16).padStart(2, "0")).join("");
  return `cenit${hex}`;
}

const json = { "Content-Type": "application/json; charset=UTF-8" };

/** El calendario de la app: el guardado si sigue existiendo; si no, uno nuevo. */
export async function ensureCalendar(token: string, id: string | null): Promise<string> {
  if (id) {
    try {
      await call(token, `${API}/calendars/${encodeURIComponent(id)}`);
      return id;
    } catch (e) {
      if (!(e instanceof GoogleError && (e.status === 404 || e.status === 410))) throw e;
    }
  }
  const res = await call(token, `${API}/calendars`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ summary: CALENDAR_NAME, description: "Citas de fisioterapia que apunta la app Cénit · Fisiolab.", timeZone: TZ }),
  });
  return ((await res.json()) as { id: string }).id;
}

async function listFuture(token: string, cal: string, now: Date): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let page: string | undefined;
  do {
    const p = new URLSearchParams({ timeMin: now.toISOString(), singleEvents: "true", maxResults: "2500" });
    if (page) p.set("pageToken", page);
    const r = (await (await call(token, `${API}/calendars/${encodeURIComponent(cal)}/events?${p}`)).json()) as { items?: GEvent[]; nextPageToken?: string };
    out.push(...(r.items ?? []));
    page = r.nextPageToken;
  } while (page);
  return out;
}

const body = (id: string, e: CalendarEvent) => ({
  id,
  status: "confirmed",
  summary: e.title,
  description: e.description,
  start: { dateTime: e.start, timeZone: TZ },
  end: { dateTime: end(e).toISOString(), timeZone: TZ },
});

const same = (g: GEvent, e: CalendarEvent) =>
  g.status !== "cancelled" &&
  g.summary === e.title &&
  g.description === e.description &&
  Date.parse(g.start?.dateTime ?? "") === Date.parse(e.start) &&
  Date.parse(g.end?.dateTime ?? "") === end(e).getTime();

export type CalendarChanges = { added: number; updated: number; removed: number };

/**
 * Deja el calendario de la app con estas citas futuras (id → evento): crea las que faltan, cambia las que han
 * cambiado y quita las que ya no están (una cita cambiada de sesión o de paciente borrado). Solo eventos futuros.
 */
export async function syncEvents(token: string, cal: string, wanted: Map<string, CalendarEvent>, now = new Date()): Promise<CalendarChanges> {
  const changes: CalendarChanges = { added: 0, updated: 0, removed: 0 };
  const existing = new Map((await listFuture(token, cal, now)).map((g) => [g.id, g]));
  const base = `${API}/calendars/${encodeURIComponent(cal)}/events`;
  for (const [id, e] of wanted) {
    if (Date.parse(e.start) <= now.getTime()) continue;
    const g = existing.get(id);
    if (g && same(g, e)) continue;
    if (g) {
      await call(token, `${base}/${id}`, { method: "PUT", headers: json, body: JSON.stringify(body(id, e)) });
      changes.updated++;
      continue;
    }
    try {
      await call(token, base, { method: "POST", headers: json, body: JSON.stringify(body(id, e)) });
      changes.added++;
    } catch (err) {
      // El id ya existió (un evento borrado se queda como «cancelado»): se recupera con PUT.
      if (!(err instanceof GoogleError && err.status === 409)) throw err;
      await call(token, `${base}/${id}`, { method: "PUT", headers: json, body: JSON.stringify(body(id, e)) });
      changes.updated++;
    }
  }
  for (const [id, g] of existing) {
    const start = Date.parse(g.start?.dateTime ?? g.start?.date ?? "");
    if (wanted.has(id) || !id.startsWith("cenit") || g.status === "cancelled" || !(start > now.getTime())) continue;
    try {
      await call(token, `${base}/${id}`, { method: "DELETE" });
      changes.removed++;
    } catch (err) {
      if (!(err instanceof GoogleError && (err.status === 404 || err.status === 410))) throw err;
    }
  }
  return changes;
}

// ---------- Cuándo ----------

export type CalendarStatus = "off" | "no-permission" | "idle" | "working" | "error";
export type CalendarState = { status: CalendarStatus; lastAt: string | null; error: string | null; upcoming: number };

const RECHECK_MS = 30 * 60_000;

/**
 * Pasa las citas al calendario después de cada sincronización con Drive (así ya están las de otros
 * dispositivos). Si las citas no han cambiado desde la última vez, no pregunta a Google hasta pasada media hora
 * (por si se borró algo a mano en el calendario).
 */
export class CalendarSync {
  private state: CalendarState = { status: "idle", lastAt: null, error: null, upcoming: 0 };
  private listeners = new Set<(s: CalendarState) => void>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private db: Db,
    private account: Account,
  ) {
    this.state.lastAt = this.memo()?.at ?? null;
  }

  get current() {
    return this.state;
  }
  subscribe(fn: (s: CalendarState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(patch: Partial<CalendarState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private get memoKey() {
    return `fisiolab.calendar.${this.account.sub}`;
  }
  private memo(): { sig: string; at: string } | null {
    try {
      return JSON.parse(localStorage.getItem(this.memoKey) ?? "null") as { sig: string; at: string } | null;
    } catch {
      return null;
    }
  }

  /** `force`: aunque nada haya cambiado (el botón «Apuntar ahora»). */
  run(force = false): Promise<void> {
    if (this.running) {
      // Ya va una: se repite al acabar (puede haber llegado una cita nueva entre medias).
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        let f = force;
        do {
          this.again = false;
          await this.once(f);
          f = false;
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async once(force: boolean) {
    const settings = await getCalendarSettings(this.db);
    if (!settings.enabled) return this.set({ status: "off", error: null });
    if (!hasGranted(CALENDAR_SCOPE)) return this.set({ status: "no-permission", error: null });
    const token = getToken();
    if (!token || !navigator.onLine) return;
    const now = new Date();
    const visits = await upcomingVisits(this.db, now);
    const wanted = new Map<string, CalendarEvent>();
    for (const v of visits) {
      const e = visitEvent(v, { id: v.patientId, name: v.name }, settings.names);
      if (e) wanted.set(eventId(v.id), e);
    }
    const calId = await getSetting<string>(this.db, CALENDAR_ID);
    const sig = JSON.stringify([calId, [...wanted]]);
    const memo = this.memo();
    if (!force && memo?.sig === sig && now.getTime() - Date.parse(memo.at) < RECHECK_MS) return this.set({ status: "idle", upcoming: wanted.size });

    this.set({ status: "working", error: null });
    try {
      const cal = await ensureCalendar(token.accessToken, calId);
      if (cal !== calId) await setSetting(this.db, CALENDAR_ID, cal);
      await syncEvents(token.accessToken, cal, wanted, now);
      const at = new Date().toISOString();
      localStorage.setItem(this.memoKey, JSON.stringify({ sig: JSON.stringify([cal, [...wanted]]), at }));
      this.set({ status: "idle", lastAt: at, upcoming: wanted.size });
    } catch (e) {
      if (e instanceof AuthError && /permiso/.test(e.message)) this.set({ status: "no-permission", error: null });
      else if (e instanceof AuthError) this.set({ status: "idle" }); // token caducado: lo resuelve la sincronización
      else this.set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
}
