// Lo que usa la página que abre el paciente sin cuenta (su formulario): la dirección del servidor de la clínica (la de
// cloud.json, la misma que usa la app) y el texto de sus errores.

export async function serverUrl(): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}cloud.json`, { cache: "no-cache" });
  const url = res.ok ? ((await res.json()) as { cloudflareUrl?: string }).cloudflareUrl?.trim() : "";
  if (!url) throw new Error("Esta app no tiene servidor para formularios.");
  return url.replace(/\/+$/, "");
}

export async function errorText(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? "";
  } catch {
    return "";
  }
}

/** El texto de un fallo de red o del servidor, para el paciente. */
export const failText = (e: unknown, offline = "No hay conexión. Prueba otra vez en un momento.") =>
  e instanceof Error && e.message !== "Failed to fetch" && e.message !== "Load failed" ? e.message : offline;
