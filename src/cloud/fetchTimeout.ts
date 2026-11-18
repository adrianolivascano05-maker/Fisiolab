// Peticiones a los servidores (el de la clínica y las APIs de Google) con un tiempo máximo hasta que empiezan a
// responder: si la conexión se queda parada (el móvil cambia de red, un proxy no contesta), la promesa no se queda
// pendiente para siempre (la sincronización se quedaba «sincronizando» hasta recargar). Al pasar el tiempo, el mismo
// error que un corte de red (TypeError «Failed to fetch…»): quien llama ya sabe reintentar o probar en la vuelta
// siguiente. Una vez que llegan las cabeceras no hay tope: una copia grande se baja aunque tarde.

/** Lo que se espera a que el servidor empiece a contestar. */
export const RESPONSE_TIMEOUT_MS = 60_000;
/** Con un cuerpo grande (un trozo de la copia), además, un segundo por cada 20 KB: una red lenta tarda en subirlo. */
const BYTES_PER_EXTRA_SECOND = 20_000;

const bodyBytes = (body: RequestInit["body"]): number =>
  body instanceof Uint8Array || body instanceof ArrayBuffer ? body.byteLength : body instanceof Blob ? body.size : typeof body === "string" ? body.length : 0;

/** El tiempo máximo hasta la respuesta para una petición con este cuerpo. */
export const timeoutFor = (body: RequestInit["body"]) => RESPONSE_TIMEOUT_MS + Math.ceil(bodyBytes(body) / BYTES_PER_EXTRA_SECOND) * 1000;

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = timeoutFor(init.body)): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // Si quien llama ya trae su propia señal para cancelar, cuentan las dos.
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !outer?.aborted) throw new TypeError("Failed to fetch: el servidor no responde (tiempo agotado).");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
