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
/** `suspended`: el proveedor la ha suspendido (se puede bajar la copia, no subir). */
export type Clinic = { id: string; name: string; role: Role; suspended?: boolean };
/** Una clínica borrada que quien la administraba aún puede recuperar (hasta `purgeAfter`). */
export type DeletedClinic = { id: string; name: string; deletedAt: string; purgeAfter: string };
/**
 * Quién ha entrado según el servidor: sus clínicas, las que borró y aún puede recuperar, si puede crear una y si
 * gestiona el servidor (el panel del proveedor).
 */
export type Me = {
  email: string;
  canCreate: boolean;
  operator?: boolean;
  clinics: Clinic[];
  deleted?: DeletedClinic[];
  /** Su solicitud para dar de alta una clínica, si la ha hecho y aún no se ha aceptado. */
  request?: AccessRequest | null;
  /** Solo para el proveedor: solicitudes por atender. */
  pendingRequests?: number;
};
/** Una solicitud de acceso: el nombre de la clínica que quiere dar de alta y si está pendiente o se rechazó. */
export type AccessRequest = { clinic: string; status: "pending" | "rejected"; createdAt: string };
export type OperatorRequest = AccessRequest & { email: string; note: string; answeredAt: string | null };

/** El panel del proveedor (cloudflare/worker.js, /v1/proveedor). */
export type OperatorClinic = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: number;
  admins: string[];
  size: number;
  lastSync: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  declaration: string | null;
  purgeAfter: string | null;
};
export type Creator = { email: string; source: "variable" | "panel"; addedBy?: string; addedAt?: string };
export type Member = { email: string; role: Role; addedAt: string };

export const ROLE_LABELS: Record<Role, string> = { admin: "Administra", member: "Equipo" };

/** La clínica elegida en este dispositivo. `adopt`: al abrir su base por primera vez, llevar a ella los pacientes de la cuenta. */
export type ChosenClinic = Clinic & { adopt?: boolean };

const key = (a: Account) => `fisiolab.clinic.${a.sub}`;
const NOTICE_KEY = "fisiolab.clinic.notice";
const OPERATOR_KEY = "fisiolab.operator";

/** Si esta cuenta gestiona el servidor (lo último que dijo el servidor): para enseñar «Proveedor» en Ajustes. */
export const isOperator = (a: Account) => localStorage.getItem(`${OPERATOR_KEY}.${a.sub}`) === "1";
export function rememberOperator(a: Account, operator: boolean) {
  if (operator) localStorage.setItem(`${OPERATOR_KEY}.${a.sub}`, "1");
  else localStorage.removeItem(`${OPERATOR_KEY}.${a.sub}`);
}

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
    /** Pedir al proveedor permiso para dar de alta una clínica, y retirar la petición. */
    requestAccess: async (t: Token, clinic: string, note: string) =>
      (await (await call(t, "/v1/solicitud", { method: "POST", ...json({ clinic, note }) })).json()) as AccessRequest,
    withdrawRequest: async (t: Token) => {
      await call(t, "/v1/solicitud", { method: "DELETE" });
    },
    create: async (t: Token, name: string) => (await (await call(t, "/v1/clinicas", { method: "POST", ...json({ name }) })).json()) as Clinic,
    rename: async (t: Token, id: string, name: string) => (await (await call(t, path(id), { method: "PATCH", ...json({ name }) })).json()) as Clinic,
    /** A la papelera 30 días, con la declaración de quien la borra. Devuelve hasta cuándo se puede recuperar. */
    remove: async (t: Token, id: string, declaration: string) =>
      ((await (await call(t, path(id), { method: "DELETE", ...json({ declaration }) })).json()) as { purgeAfter: string }).purgeAfter,
    restore: async (t: Token, id: string) => {
      await call(t, path(id, "/recuperar"), { method: "POST" });
    },
    members: async (t: Token, id: string) => ((await (await call(t, path(id, "/miembros"))).json()) as { members: Member[] }).members,
    putMember: async (t: Token, id: string, email: string, role: Role) =>
      (await (await call(t, path(id, `/miembros/${encodeURIComponent(email.trim().toLowerCase())}`), { method: "PUT", ...json({ role }) })).json()) as Member,
    removeMember: async (t: Token, id: string, email: string) => {
      await call(t, path(id, `/miembros/${encodeURIComponent(email)}`), { method: "DELETE" });
    },
    /** La clave de la copia cerrada con el código de recuperación (crypt.ts), o null si aún no hay. */
    getRecovery: async (t: Token, id: string) => ((await (await call(t, path(id, "/recuperacion"))).json()) as { blob: string | null }).blob,
    putRecovery: async (t: Token, id: string, blob: string) => {
      await call(t, path(id, "/recuperacion"), { method: "PUT", ...json({ blob }) });
    },
    /** Panel del proveedor: solo para OPERATOR_EMAILS. */
    operator: {
      overview: async (t: Token) =>
        (await (await call(t, "/v1/proveedor")).json()) as { clinics: OperatorClinic[]; creators: Creator[]; requests?: OperatorRequest[] },
      /** Aceptar (podrá dar de alta su clínica) o rechazar una solicitud; o borrarla (podrá volver a pedirlo). */
      answer: async (t: Token, email: string, accept: boolean) => {
        await call(t, `/v1/proveedor/solicitudes/${encodeURIComponent(email)}`, { method: "POST", ...json({ accept }) });
      },
      dropRequest: async (t: Token, email: string) => {
        await call(t, `/v1/proveedor/solicitudes/${encodeURIComponent(email)}`, { method: "DELETE" });
      },
      contract: async (t: Token) => ((await (await call(t, "/v1/proveedor/contrato")).json()) as { html: string }).html,
      addCreator: async (t: Token, email: string) => {
        await call(t, `/v1/proveedor/altas/${encodeURIComponent(email.trim().toLowerCase())}`, { method: "PUT" });
      },
      removeCreator: async (t: Token, email: string) => {
        await call(t, `/v1/proveedor/altas/${encodeURIComponent(email)}`, { method: "DELETE" });
      },
      suspend: async (t: Token, id: string, suspended: boolean) => {
        await call(t, `/v1/proveedor/clinicas/${encodeURIComponent(id)}/suspender`, { method: "POST", ...json({ suspended }) });
      },
      restore: async (t: Token, id: string) => {
        await call(t, `/v1/proveedor/clinicas/${encodeURIComponent(id)}/recuperar`, { method: "POST" });
      },
    },
  };
}
export type ClinicApi = ReturnType<typeof clinicApi>;
