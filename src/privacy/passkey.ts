// Desbloquear la app con Face ID, Touch ID o la huella (WebAuthn, «passkey» del dispositivo). Es solo para abrir la
// pantalla de bloqueo en este dispositivo: no hay servidor que compruebe nada, igual que con el PIN, que sigue
// valiendo siempre. El dispositivo comprueba a la persona (userVerification) y la app solo mira que lo haya hecho.

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Si este dispositivo tiene Face ID, Touch ID, huella o Windows Hello. */
export async function passkeyAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Crea la passkey de la app en este dispositivo. Devuelve su id, o null si la persona cancela. */
export async function createPasskey(name: string): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: "Cénit · Fisiolab" },
        user: { id: random(16), name, displayName: name },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return cred ? b64(cred.rawId) : null;
  } catch {
    return null;
  }
}

/** Pide Face ID o huella con la passkey de la app. true si el dispositivo ha reconocido a la persona. */
export async function checkPasskey(id: string): Promise<boolean> {
  try {
    const cred = await navigator.credentials.get({
      publicKey: { challenge: random(32), allowCredentials: [{ type: "public-key", id: unb64(id) }], userVerification: "required", timeout: 60_000 },
    });
    return !!cred;
  } catch {
    return false;
  }
}
