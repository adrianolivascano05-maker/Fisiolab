// Clínicas con equipo, en el servidor de Cloudflare (cloudflare/worker.js). Quien da de alta la clínica la
// administra y añade a su equipo por correo; todos trabajan con la misma base, cuya copia va cifrada con la contraseña
// de la clínica: el servidor, y quien lo gestiona, no pueden leerla.
// En cada dispositivo, cada cuenta recuerda en qué clínica trabaja; cada clínica tiene su base
// (fisiolab-u<cuenta>-c<clínica>.sqlite3), su clave de cifrado y su sincronización. Si se llevan a ella los pacientes
// de la cuenta, pasan a la base de la clínica y la de la cuenta se borra del dispositivo.
import type { DbFile } from "../data/db";
import { dbFileFor, type Account } from "./account";
import type { Token } from "./auth";
import { serverCall } from "./remote";

export type Role = "admin" | "member";
export type Clinic = { id: string; name: string; role: Role };
/** Quién ha entrado según el servidor: sus clínicas y si puede crear una (su correo está en ALLOWED_EMAILS). */
export type Me = { email: string; canCreate: boolean; clinics: Clinic[] };
export type Member = { email: string; role: Role; addedAt: string };

export const ROLE_LABELS: Record<Role, string> = { admin: "Administra", member: "Equipo" };

/** La clínica elegida en este dispositivo. `adopt`: al abrir su base por primera vez, llevar a ella los pacientes de la cuenta. */
export type ChosenClinic = Clinic & { adopt?: boolean };

const key = (a: Account) => `fisiolab.clinic.${a.sub}`;
const NOTICE_KEY = "fisiolab.clinic.notice";

export function chosenClinic(a: Account): ChosenClinic | null {
  try {
    const c = JSON.parse(localStorage.getItem(key(a)) ?? "null") as ChosenClinic | null;
    return c?.id ? c : null;
  } catch {
    return null;
  }
}

export function chooseClinic(a: Account, c: ChosenClinic) {
  localStorage.setItem(key(a), JSON.stringify(c));
}

/** Volver a la pantalla de elegir clínica (su base se queda en el dispositivo). */
export function forgetClinic(a: Account) {
  localStorage.removeItem(key(a));
}

/** Ya se han llevado los pacientes de la cuenta (o no había): no se vuelve a intentar. */
export function adoptedIntoClinic(a: Account) {
  const c = chosenClinic(a);
  if (c?.adopt) chooseClinic(a, { id: c.id, name: c.name, role: c.role });
}

/** La base de la clínica en el dispositivo. */
export function clinicDbFile(a: Account, c: ChosenClinic): DbFile {
  const own = dbFileFor(a).name;
  return { name: `${own}-c${c.id.replace(/[^0-9a-zA-Z]/g, "")}`, from: c.adopt ? own : undefined, member: a.sub };
}

/** De quién son la clave de cifrado y la sincronización en este dispositivo: la cuenta en esa clínica. */
export const clinicScope = (a: Account, c: Clinic) => `${a.sub}.c${c.id}`;

/** Un aviso para la pantalla de elegir clínica (p. ej., que te han quitado de una), una sola vez. */
export function setClinicNotice(text: string) {
  sessionStorage.setItem(NOTICE_KEY, text);
}
export function takeClinicNotice(): string | null {
  const text = sessionStorage.getItem(NOTICE_KEY);
  sessionStorage.removeItem(NOTICE_KEY);
  return text;
}

const json = (data: unknown): RequestInit => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
const path = (id: string, rest = "") => `/v1/clinicas/${encodeURIComponent(id)}${rest}`;

/** Lo que la app pide al servidor sobre clínicas y equipo. */
export function clinicApi(baseUrl: string) {
  const call = (t: Token, p: string, init?: RequestInit) => serverCall(baseUrl, t, p, init);
  return {
    me: async (t: Token) => (await (await call(t, "/v1/yo")).json()) as Me,
    create: async (t: Token, name: string) => (await (await call(t, "/v1/clinicas", { method: "POST", ...json({ name }) })).json()) as Clinic,
    rename: async (t: Token, id: string, name: string) => (await (await call(t, path(id), { method: "PATCH", ...json({ name }) })).json()) as Clinic,
    remove: async (t: Token, id: string) => {
      await call(t, path(id), { method: "DELETE" });
    },
    members: async (t: Token, id: string) => ((await (await call(t, path(id, "/miembros"))).json()) as { members: Member[] }).members,
    putMember: async (t: Token, id: string, email: string, role: Role) =>
      (await (await call(t, path(id, `/miembros/${encodeURIComponent(email.trim().toLowerCase())}`), { method: "PUT", ...json({ role }) })).json()) as Member,
    removeMember: async (t: Token, id: string, email: string) => {
      await call(t, path(id, `/miembros/${encodeURIComponent(email)}`), { method: "DELETE" });
    },
  };
}
export type ClinicApi = ReturnType<typeof clinicApi>;
