// El último paciente abierto en esta pestaña: para enlazar lo que se hace en otra sección con él (p. ej. registrar
// un test de la Biblioteca: el paciente que se estaba viendo sale el primero al elegir).
const KEY = "fisiolab.last-patient";

/** Los últimos pacientes abiertos en esta pestaña (los ids, del más reciente al más antiguo): para volver sin buscar. */
const RECENT_KEY = "fisiolab.recent-patients";
const RECENT_MAX = 4;

export function recentPatients(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberPatient(id: string) {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentPatients().filter((x) => x !== id)].slice(0, RECENT_MAX)));
    sessionStorage.setItem(KEY, id);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

export function lastPatient(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
