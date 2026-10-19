// Configuración de la nube: public/cloud.json, que se lee al abrir la app. Con «googleClientId» vacío la app
// funciona como siempre, solo en el dispositivo y sin cuentas. Con el ID de cliente de Google (src/cloud/README.md),
// cada fisioterapeuta entra con su cuenta y sus datos se guardan también en su Google Drive.

export type CloudConfig = { googleClientId: string };

const KEY = "fisiolab.cloud.config";

const read = (): CloudConfig | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as CloudConfig | null;
  } catch {
    return null;
  }
};

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
  return config?.googleClientId ? config : null;
}
