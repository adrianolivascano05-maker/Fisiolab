// Lo que tiene pendiente en Cloudflare quien gestiona el servidor, a la vista en Ajustes → Proveedor y en su panel
// (ProviderPage): pegar el worker.js nuevo, si el que hay es anterior al que necesita esta versión de la app, y
// activar el almacén R2. Así no se queda nada en el tintero tras cada actualización. Al cambiar cloudflare/worker.js en
// algo que la app necesite, sube a la vez su SERVER_VERSION y EXPECTED_SERVER_VERSION (lo comprueba worker.test.ts).

/** La versión de cloudflare/worker.js que necesita esta versión de la app: el día de su último cambio («.2» si es el segundo de ese día). */
export const EXPECTED_SERVER_VERSION = "2026-10-27.2";

/** Lo que el servidor dice de sí mismo al proveedor (/v1/yo): su versión y si tiene el almacén R2. Si no dice nada, es anterior. */
export type ServerInfo = { version: string; docs: boolean };
/** `short`: lo mismo en pocas palabras, para la fila de Ajustes. */
export type PendingStep = { title: string; short: string; detail: string };

export function cloudflarePending(server: ServerInfo | undefined): PendingStep[] {
  const out: PendingStep[] = [];
  if (!server?.version || server.version < EXPECTED_SERVER_VERSION)
    out.push({
      title: "Falta actualizar el servidor en Cloudflare",
      short: "actualizar el servidor",
      detail:
        "El servidor tiene pegado un worker.js anterior a esta versión de la app: lo nuevo (archivos de los pacientes, copias por trozos, avisos) no funciona hasta que pegues el de ahora. Cloudflare → Workers & Pages → el servidor → Edit code: borra todo, pega cloudflare/worker.js y Deploy. Antes, ejecuta cloudflare/schema.sql en la Console de la base: no borra nada (cloudflare/README.md, «Al actualizar el servidor»).",
    });
  if (server && !server.docs)
    out.push({
      title: "Falta activar el almacén R2",
      short: "activar R2",
      detail:
        "Sin él no se pueden guardar archivos de los pacientes (PDF y fotos) ni recibir los que envían, y la copia de cada clínica no puede pasar de 50 MB. Cloudflare pide una tarjeta; con el tope del servidor (10 GB) no se pasa de lo gratis. Pasos en cloudflare/README.md, «Documentos».",
    });
  return out;
}
