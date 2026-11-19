// Entrar con Google (auth.ts): con el token de acceso llega el de identidad, y su «nonce» tiene que ser el que se pidió.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToken, jwtClaims, startLogin, takeRedirectResult } from "./auth";

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims: Record<string, unknown>) => `${b64u({ alg: "RS256", kid: "k" })}.${b64u(claims)}.firma`;

// Sin navegador: lo justo de sessionStorage, localStorage, location e history.
const storage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
};
let sent: URL;
const loc = { origin: "https://app.ejemplo", pathname: "/", search: "", hash: "", assign: (u: string) => void (sent = new URL(u)) };
beforeEach(() => {
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("location", loc);
  vi.stubGlobal("history", {
    replaceState: (_: unknown, __: string, url: string) => {
      const u = new URL(url, loc.origin);
      Object.assign(loc, { pathname: u.pathname, search: u.search, hash: u.hash });
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Vuelve de Google con lo que se le pase en la dirección. */
function back(params: Record<string, string>) {
  history.replaceState(null, "", `/#${new URLSearchParams(params)}`);
  return takeRedirectResult();
}

describe("entrar con Google", () => {
  it("pide también el token de identidad con un nonce, y lo guarda si el nonce es el suyo", () => {
    startLogin("id-cliente");
    expect(sent.searchParams.get("response_type")).toBe("token id_token");
    const nonce = sent.searchParams.get("nonce")!;
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    const exp = Math.floor(Date.now() / 1000) + 1800;
    const idToken = jwt({ nonce, exp, sub: "1" });
    const r = back({ state: sent.searchParams.get("state")!, access_token: "acc", expires_in: "3599", id_token: idToken, scope: "openid drive.appdata" });
    expect(r?.error).toBeNull();
    expect(r?.token).toMatchObject({ accessToken: "acc", idToken, expiresAt: exp * 1000 });
    expect(getToken()?.idToken).toBe(idToken);
    expect(location.hash).toBe("");
  });

  it("un token de identidad con otro nonce no se acepta", () => {
    startLogin("id-cliente");
    const r = back({ state: sent.searchParams.get("state")!, access_token: "acc", expires_in: "3599", id_token: jwt({ nonce: "otro" }), scope: "openid drive.appdata" });
    expect(r).toMatchObject({ token: null, error: "nonce_mismatch" });
    expect(getToken()).toBeNull();
  });

  it("lee lo que dice un token, y null si no se puede", () => {
    expect(jwtClaims(jwt({ nonce: "ñ€", sub: "1" }))).toEqual({ nonce: "ñ€", sub: "1" });
    expect(jwtClaims("nada")).toBeNull();
    expect(jwtClaims("a.@@@.c")).toBeNull();
  });
});
