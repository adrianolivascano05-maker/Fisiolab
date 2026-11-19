// Entrar con Google sin servidor: OAuth 2.0 para aplicaciones web de cliente (flujo con redirección). La app
// manda a Google con su ID de cliente y Google vuelve a la app con un token de una hora en la dirección
// (#access_token=…). El token da acceso al nombre y el correo de quien entra, a la carpeta oculta de la app en su
// Drive (drive.appdata, la copia de la base; solo sin servidor de Cloudflare) y al calendario que crea la app en su
// Google Calendar (calendar.app.created: citas). Ningún permiso para guardar archivos a la vista en su Drive. El del calendario solo se pide a
// quien activa «Apuntar las citas en mi Google Calendar» (wantCalendar): así entrar no pide nada que Google considere
// sensible y no hace falta verificar la app para pasar de 100 usuarios. No hay contraseñas ni secretos en la app.
//
// Con el token de acceso llega también un token de identidad (id_token): un certificado firmado por Google que dice
// quién ha entrado y para qué app es. Es lo que se manda al servidor de la clínica (que comprueba la firma); lleva un
// «nonce» al azar que la app pide y luego comprueba, para que no valga una respuesta de Google que no se pidió aquí.
// El token de acceso solo se usa para hablar con Google (Drive, calendario, el nombre de quien entra).
//
// Volver a entrar cuando el token caduca no pide nada si la sesión de Google sigue abierta (prompt=none):
// es un ir y volver de un segundo al abrir la app.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

/**
 * Con el servidor de Cloudflare la copia no va a Drive: no se pide la carpeta oculta (CloudGate lo dice al leer la
 * configuración, antes de ir a Google o de leer su respuesta).
 */
let copyInDrive = true;
export function setCopyInDrive(v: boolean) {
  copyInDrive = v;
}
const CALENDAR_WANTED = "fisiolab.oauth.calendar";
/** Pedir también el permiso del calendario al ir a Google (al activar el calendario en Ajustes). */
export function wantCalendar(v: boolean) {
  if (v) localStorage.setItem(CALENDAR_WANTED, "1");
  else localStorage.removeItem(CALENDAR_WANTED);
}
const calendarWanted = () => localStorage.getItem(CALENDAR_WANTED) === "1" || hasGranted(CALENDAR_SCOPE);
const scopes = () => `openid email profile${copyInDrive ? ` ${APPDATA_SCOPE}` : ""}${calendarWanted() ? ` ${CALENDAR_SCOPE}` : ""}`;

/** `idToken`: el token de identidad de Google, para el servidor de la clínica (los tokens de antes no lo tienen). */
export type Token = { accessToken: string; expiresAt: number; idToken?: string };

// Google deja aceptar unos permisos y otros no: se recuerda qué concedió (para el calendario).
const GRANTED_KEY = "fisiolab.oauth.granted";

/** Si quien ha entrado concedió este permiso la última vez que entró. */
export function hasGranted(scope: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(GRANTED_KEY) ?? "[]") as string[]).includes(scope);
  } catch {
    return false;
  }
}

const TOKEN_KEY = "fisiolab.token"; // sessionStorage: solo esta pestaña, mientras esté abierta
const FLOW_KEY = "fisiolab.oauth"; // lo que hay que recordar mientras se va a Google y se vuelve
const SILENT_KEY = "fisiolab.oauth.silent"; // última vez que se intentó entrar sin preguntar

/** La dirección registrada en Google como «URI de redirección»: la raíz de la app. */
export const redirectUri = () => new URL(import.meta.env.BASE_URL, location.origin).href;

export function getToken(): Token | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as Token | null;
    // Un minuto de margen: que no caduque a mitad de una subida.
    return t && t.expiresAt - 60_000 > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

type Flow = { state: string; nonce?: string; returnTo: string; silent: boolean };

/**
 * Va a Google. `silent`: sin preguntar nada (si la sesión de Google no está abierta, vuelve con un error).
 * `chooseAccount`: deja elegir la cuenta. `returnTo`: la dirección a la que volver (si no, esta misma).
 */
export function startLogin(clientId: string, opts: { hint?: string; silent?: boolean; chooseAccount?: boolean; returnTo?: string } = {}) {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const flow: Flow = { state, nonce, returnTo: opts.returnTo ?? location.pathname + location.search, silent: !!opts.silent };
  sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  if (opts.silent) sessionStorage.setItem(SILENT_KEY, String(Date.now()));
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "token id_token",
    scope: scopes(),
    state,
    nonce,
    include_granted_scopes: "true",
  });
  if (opts.hint) p.set("login_hint", opts.hint);
  if (opts.silent) p.set("prompt", "none");
  else if (opts.chooseAccount) p.set("prompt", "select_account");
  location.assign(`${AUTH_URL}?${p}`);
}

/** Se intentó entrar sin preguntar hace poco: no se repite (evita ir y volver sin parar). */
export const silentTriedRecently = () => Date.now() - Number(sessionStorage.getItem(SILENT_KEY) ?? 0) < 5 * 60_000;

export type RedirectResult = { token: Token | null; error: string | null; silent: boolean };

/**
 * Al volver de Google: toma el token de la dirección, la deja limpia (vuelve a la pantalla donde se estaba) y
 * guarda el token. Null si no se viene de Google.
 */
export function takeRedirectResult(): RedirectResult | null {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (!hash.has("access_token") && !hash.has("id_token") && !hash.has("error")) return null;
  let flow: Flow | null = null;
  try {
    flow = JSON.parse(sessionStorage.getItem(FLOW_KEY) ?? "null") as Flow | null;
  } catch {
    /* sin datos del viaje */
  }
  sessionStorage.removeItem(FLOW_KEY);
  history.replaceState(null, "", flow?.returnTo ?? location.pathname + location.search);
  // El estado tiene que ser el que se mandó: si no, la respuesta no es para esta pestaña.
  if (!flow || hash.get("state") !== flow.state) return { token: null, error: "state_mismatch", silent: false };
  const accessToken = hash.get("access_token");
  if (!accessToken) return { token: null, error: hash.get("error") ?? "unknown", silent: flow.silent };
  if (copyInDrive && !(hash.get("scope") ?? "").includes("drive.appdata")) return { token: null, error: "drive_scope_denied", silent: flow.silent };
  let expiresAt = Date.now() + Number(hash.get("expires_in") ?? 3600) * 1000;
  const idToken = hash.get("id_token") ?? undefined;
  if (idToken) {
    // El nonce tiene que ser el que se mandó (la firma la comprueba el servidor, que es quien se fía de él).
    const claims = jwtClaims(idToken);
    if (!claims || !flow.nonce || claims.nonce !== flow.nonce) return { token: null, error: "nonce_mismatch", silent: flow.silent };
    if (typeof claims.exp === "number") expiresAt = Math.min(expiresAt, claims.exp * 1000);
  }
  const token: Token = { accessToken, expiresAt, ...(idToken ? { idToken } : {}) };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  localStorage.setItem(GRANTED_KEY, JSON.stringify((hash.get("scope") ?? "").split(" ").filter(Boolean)));
  return { token, error: null, silent: flow.silent };
}

/** Lo que dice un token de identidad (sin comprobar la firma: eso lo hace el servidor). Null si no se puede leer. */
export function jwtClaims(jwt: string): Record<string, unknown> | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64 + "===".slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Al cerrar sesión: el token deja de valer. Si no hay conexión, caduca solo en menos de una hora. */
export async function revokeToken() {
  const t = getToken();
  clearToken();
  sessionStorage.removeItem(SILENT_KEY);
  localStorage.removeItem(GRANTED_KEY);
  if (!t) return;
  try {
    await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `token=${encodeURIComponent(t.accessToken)}` });
  } catch {
    /* caduca solo */
  }
}

/** Textos para los errores con los que puede volver Google. */
export function authErrorText(error: string): string {
  switch (error) {
    case "access_denied":
      return "Has cancelado la entrada con Google.";
    case "drive_scope_denied":
      return "Para guardar tus pacientes en la nube hace falta permitir el acceso a la carpeta de la app en tu Drive.";
    case "state_mismatch":
    case "nonce_mismatch":
      return "La respuesta de Google no era para esta pestaña. Vuelve a intentarlo.";
    default:
      return `Google no ha dejado entrar (${error}). Vuelve a intentarlo.`;
  }
}
