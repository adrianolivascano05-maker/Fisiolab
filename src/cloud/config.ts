// Configuración de la nube: public/cloud.json, que se lee al abrir la app. Con «googleClientId» vacío la app
// funciona como siempre, solo en el dispositivo y sin cuentas. Con el ID de cliente de Google (src/cloud/README.md),
// cada fisioterapeuta entra con su cuenta y sus datos se guardan también en su Google Drive o, con «cloudflareUrl»,
// cifrados en el servidor de la clínica en Cloudflare (cloudflare/README.md).
// Mientras la app publicada no lleve el ID, se puede pegar en un dispositivo (pantalla «Iniciar sesión con Google»):
// vale solo para ese dispositivo, y el de cloud.json tiene preferencia.

export type CloudConfig = {
  googleClientId: string;
  /**
   * El servidor de la clínica en Cloudflare (cloudflare/README.md). Con él, la copia de los pacientes va ahí,
   * siempre cifrada, y no a Google Drive: Google queda solo para entrar.
   */
  cloudflareUrl?: string;
  /**
   * Dónde abren los pacientes sus formularios (src/clinical/patientForms.ts), p. ej. «https://cenitfisiolab.pages.dev/»:
   * la app publicada también ahí, con un nombre de la clínica. Sin él, la dirección de la app en que se crea el enlace.
   */
  formsUrl?: string;
};

const KEY = "fisiolab.cloud.config";
const DEVICE_KEY = "fisiolab.cloud.clientId";

/** Forma de un ID de cliente de Google: «123456789012-abc….apps.googleusercontent.com». */
export const isClientId = (id: string) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id.trim());

/** El ID pegado en este dispositivo. */
export function setDeviceClientId(id: string) {
  localStorage.setItem(DEVICE_KEY, id.trim());
}

const read = (): CloudConfig | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as CloudConfig | null;
  } catch {
    return null;
  }
};

/** La última configuración leída, sin esperar a la red (para la pantalla de bloqueo, que sale antes que nada). */
export function cachedCloudConfig(): CloudConfig | null {
  const c = read();
  if (c?.googleClientId) return c;
  const onDevice = localStorage.getItem(DEVICE_KEY);
  return onDevice ? { googleClientId: onDevice } : null;
}

/** La configuración, o null si la nube no está activada. Sin conexión, la última que se leyó. */
export async function loadCloudConfig(): Promise<CloudConfig | null> {
  let config = read();
  // Sin red, ni se intenta (el navegador lo apuntaría como error): vale la guardada.
  if (navigator.onLine) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}cloud.json`, { cache: "no-cache" });
      if (res.ok) {
        config = (await res.json()) as CloudConfig;
        localStorage.setItem(KEY, JSON.stringify(config));
      }
    } catch {
      /* la conexión falla aunque el navegador crea que hay: la guardada */
    }
  }
  if (config?.googleClientId) return { ...config, cloudflareUrl: config.cloudflareUrl?.trim() || undefined };
  const onDevice = localStorage.getItem(DEVICE_KEY);
  return onDevice ? { googleClientId: onDevice } : null;
}
