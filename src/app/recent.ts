// El último paciente abierto en esta pestaña: para enlazar lo que se hace en otra sección con él (p. ej. registrar
// un test de la Biblioteca: el paciente que se estaba viendo sale el primero al elegir).
const KEY = "fisiolab.last-patient";

export function rememberPatient(id: string) {
  try {
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
