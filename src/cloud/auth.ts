// Entrar con Google sin servidor: OAuth 2.0 para aplicaciones web de cliente (flujo con redirección). La app
// manda a Google con su ID de cliente y Google vuelve a la app con un token de una hora en la dirección
// (#access_token=…). El token solo da acceso a la carpeta oculta de la app en el Drive de quien entra
// (drive.appdata) y a su nombre y correo. No hay contraseñas ni secretos en la app.
//
// Volver a entrar cuando el token caduca no pide nada si la sesión de Google sigue abierta (prompt=none):
// es un ir y volver de un segundo al abrir la app.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.appdata";

export type Token = { accessToken: string; expiresAt: number };

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

type Flow = { state: string; returnTo: string; silent: boolean };

/**
 * Va a Google. `silent`: sin preguntar nada (si la sesión de Google no está abierta, vuelve con un error).
 * `chooseAccount`: deja elegir la cuenta.
 */
export function startLogin(clientId: string, opts: { hint?: string; silent?: boolean; chooseAccount?: boolean } = {}) {
  const state = crypto.randomUUID();
  const flow: Flow = { state, returnTo: location.pathname + location.search, silent: !!opts.silent };
  sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  if (opts.silent) sessionStorage.setItem(SILENT_KEY, String(Date.now()));
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: SCOPES,
    state,
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
  if (!hash.has("access_token") && !hash.has("error")) return null;
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
  if (!(hash.get("scope") ?? "").includes("drive.appdata")) return { token: null, error: "drive_scope_denied", silent: flow.silent };
  const token = { accessToken, expiresAt: Date.now() + Number(hash.get("expires_in") ?? 3600) * 1000 };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return { token, error: null, silent: flow.silent };
}

/** Al cerrar sesión: el token deja de valer. Si no hay conexión, caduca solo en menos de una hora. */
export async function revokeToken() {
  const t = getToken();
  clearToken();
  sessionStorage.removeItem(SILENT_KEY);
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
      return "La respuesta de Google no era para esta pestaña. Vuelve a intentarlo.";
    default:
      return `Google no ha dejado entrar (${error}). Vuelve a intentarlo.`;
  }
}
