// Caducidad sin conexión (CloudGate.tsx): cada vez que el servidor confirma que quien ha entrado sigue en la clínica
// (/v1/yo), se apunta aquí la fecha. Si pasan más días que los que marca la clínica (3, 7 o 14; 7 por defecto) sin
// poder comprobarlo, al abrir la app la clínica sale bloqueada hasta que haya conexión: si sigue en el equipo, se
// abre; si no, se borran sus datos (refreshClinic). Sin conexión no se borra nada (un fallo de red no puede costar
// datos), pero tampoco se enseña. Nada puede borrar un dispositivo que no se vuelve a encender: eso lo cubren el
// bloqueo y el cifrado del propio dispositivo.
export const OFFLINE_DAYS_KEY = "clinic_offline_days";
export const OFFLINE_DAYS_OPTIONS = [3, 7, 14] as const;
export const DEFAULT_OFFLINE_DAYS = 7;
const DAY = 86_400_000;
const key = (scope: string) => `fisiolab.checked.${scope}`;

/** Apunta que el servidor acaba de confirmar que sigue en la clínica. */
export function recordCheck(scope: string, now = Date.now()) {
  localStorage.setItem(key(scope), String(now));
}
/** Cuándo fue la última comprobación; la primera vez (sin dato) cuenta desde ahora, para no bloquear al actualizar la app. */
export function lastCheck(scope: string, now = Date.now()): number {
  const v = Number(localStorage.getItem(key(scope)));
  if (v > 0) return v;
  recordCheck(scope, now);
  return now;
}
export function forgetCheck(scope: string) {
  localStorage.removeItem(key(scope));
}
/** Días enteros desde la última comprobación. */
export const daysSinceCheck = (scope: string, now = Date.now()) => Math.floor((now - lastCheck(scope, now)) / DAY);
/** Si hay que bloquear la clínica hasta comprobarlo. */
export const checkExpired = (scope: string, days: number, now = Date.now()) => daysSinceCheck(scope, now) >= days;
/** El ajuste de la clínica, saneado (3, 7 o 14). */
export const offlineDays = (v: unknown): number => (OFFLINE_DAYS_OPTIONS as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_OFFLINE_DAYS;
