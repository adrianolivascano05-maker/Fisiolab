// Registro de fallos de este dispositivo. Sin servicios externos: los errores se guardan aquí (en el almacenamiento
// del navegador, no en la base, que podría ser justo lo que falla) y solo salen si quien usa la app pulsa «Enviar
// informe de fallo» (Ajustes › Cómo se usa). Así un fallo en el móvil de un compañero deja rastro.
//
// Nunca se guardan datos de pacientes a propósito: el mensaje del error y dónde pasó. Por si un mensaje llevara un
// nombre o un teléfono, el informe se puede leer antes de mandarlo.

export type ErrorEntry = { at: string; where: string; message: string; stack?: string; path?: string };

const KEY = "fisiolab.errors";
const MAX = 40;
const MAX_TEXT = 600;

const clip = (s: string, n = MAX_TEXT) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function readErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Anota un error. `where`: en qué parte («sincronización», «pantalla», «sin capturar»…). */
export function logError(where: string, error: unknown) {
  const e = error instanceof Error ? error : null;
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    where,
    message: clip(e ? `${e.name}: ${e.message}` : String(error)),
    stack: e?.stack ? clip(e.stack, 1500) : undefined,
    path: typeof location !== "undefined" ? location.pathname.replace(/\/(formulario|reserva|cita)\/[^/#?]+/, "/$1/…") : undefined,
  };
  try {
    const list = readErrors();
    // El mismo error repetido seguido (un bucle) cuenta una vez.
    const last = list.at(-1);
    if (last && last.message === entry.message && last.where === entry.where && Date.parse(entry.at) - Date.parse(last.at) < 5000) return;
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* sin almacenamiento: no se puede hacer nada más */
  }
}

/** Errores que nadie captura (excepciones y promesas rechazadas). Una vez, al arrancar. */
export function captureGlobalErrors() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    // Los fallos al cargar un recurso (imagen, script) llegan sin `error`: se anotan con su origen.
    logError("sin capturar", e.error ?? `${e.message || "Error"}${e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => logError("promesa sin capturar", e.reason));
}

/** Lo que se sabe del dispositivo, para el informe (sin nada del paciente). */
function deviceSummary() {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const standalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  return [
    `Versión: ${__APP_VERSION__}`,
    `Navegador: ${nav?.userAgent ?? "?"}`,
    `Pantalla: ${typeof screen !== "undefined" ? `${screen.width}×${screen.height}` : "?"} · ventana ${typeof innerWidth !== "undefined" ? `${innerWidth}×${innerHeight}` : "?"}`,
    `Instalada: ${standalone ? "sí" : "no"} · Conexión: ${nav?.onLine === false ? "sin red" : "con red"}`,
    `Idioma: ${nav?.language ?? "?"} · Zona horaria: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  ];
}

/** El texto del informe: el dispositivo, lo que cuenta quien lo manda y los últimos errores. */
export function errorReport(note: string, extra: string[] = [], errors = readErrors()): string {
  const lines = [
    "Informe de fallo de Cénit",
    "",
    note.trim() ? `Qué pasó: ${note.trim()}` : "Qué pasó: (sin explicar)",
    "",
    ...deviceSummary(),
    ...extra,
    "",
    errors.length ? `Últimos errores (${errors.length}):` : "Sin errores anotados en este dispositivo.",
  ];
  for (const e of [...errors].reverse().slice(0, 15)) {
    lines.push("", `${e.at} · ${e.where}${e.path ? ` · ${e.path}` : ""}`, e.message);
    if (e.stack) lines.push(e.stack.split("\n").slice(0, 6).join("\n"));
  }
  return lines.join("\n");
}
