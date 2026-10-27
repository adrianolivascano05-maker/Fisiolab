// Los avisos del panel del proveedor (ProviderPage): al llegar al 70 % de un límite del servidor (cloudflare/README.md,
// «Límites»), qué pasa al llegar al tope y qué hacer antes. Las peticiones al día las da Cloudflare con un token de
// solo lectura (README, «Peticiones al día»): solo las ve quien gestiona el servidor.
import { sizeText } from "../data/documents";
import type { OperatorClinic } from "./clinic";

export type StorageUsage = { enabled: boolean; total: number; copies?: number; cap: number; warnAt: number };
export type DatabaseUsage = { bytes: number | null; cap: number; warnAt: number };
export type LimitWarning = { title: string; detail: string };
/**
 * Las peticiones de hoy de toda la cuenta de Cloudflare (cloudflare/worker.js, /v1/proveedor/peticiones). Sin token,
 * `configured: false`; si Cloudflare falla, `today: null` y `error`. `limit: 0`: plan de pago, sin límite al día.
 */
export type RequestUsage = { configured: boolean; today?: number | null; errors?: number | null; since?: string; limit: number; warnAt: number; error?: string };

/** Sin almacén R2, cada copia va en la base D1 y no puede pasar de 50 MB (cloudflare/worker.js, MAX_CHARS). */
export const D1_COPY_CAP = 50 * 1024 * 1024;
const SHARE = 0.7;

const percent = (used: number, cap: number) => `${Math.floor((used / cap) * 100)} %`;

/** Las peticiones de hoy en una línea, para el panel. */
export function requestsText(u: RequestUsage | null): string {
  if (!u) return "No se han podido leer. Si el servidor es anterior al 27-10-2026, pega el worker.js nuevo.";
  if (!u.configured) return "Sin configurar: añade CF_ACCOUNT_ID y el secreto CF_API_TOKEN al Worker (cloudflare/README.md, «Peticiones al día»).";
  if (typeof u.today !== "number") return u.error ?? "Cloudflare no ha dado el número. Inténtalo más tarde.";
  const n = u.today.toLocaleString("es-ES");
  if (u.limit <= 0) return `${n} hoy · plan de pago, sin límite al día`;
  return `${n} de ${u.limit.toLocaleString("es-ES")} (${percent(u.today, u.limit)}) · se ponen a cero a las 00:00 UTC (la 1 o las 2 en España)`;
}

/** La parte del límite de hoy que llevan las peticiones (0,7 = 70 %); null si no se sabe o no hay límite al día. */
export function requestShare(u: RequestUsage): number | null {
  return u.configured && typeof u.today === "number" && u.limit > 0 ? u.today / u.limit : null;
}

export function limitWarnings(o: {
  clinics: Pick<OperatorClinic, "name" | "size" | "deletedAt">[];
  documents?: StorageUsage;
  database?: DatabaseUsage;
  requests?: RequestUsage | null;
}): LimitWarning[] {
  const out: LimitWarning[] = [];
  const req = o.requests && requestShare(o.requests);
  if (req !== null && req !== undefined && req >= 0.7)
    out.push({
      title: `Las peticiones de hoy van por el ${Math.floor(req * 100)} % (${o.requests!.today!.toLocaleString("es-ES")} de ${o.requests!.limit.toLocaleString("es-ES")})`,
      detail:
        "Son las de toda la cuenta de Cloudflare y se ponen a cero a las 00:00 UTC (la 1 o las 2 en España). Al llegar al límite, el servidor da error hasta entonces: las clínicas siguen trabajando en sus dispositivos y sincronizan después. Para que no pase, pasa al plan de pago de Workers (unos 5 $ al mes, sin límite al día) y pon DAILY_REQUESTS = 0 en el Worker.",
    });
  const docs = o.documents;
  if (docs?.enabled && docs.total >= docs.warnAt)
    out.push({
      title: `El almacén de archivos va por el ${percent(docs.total, docs.cap)} (${sizeText(docs.total)} de ${sizeText(docs.cap)})`,
      detail:
        "Al llegar al tope ya no se guardan archivos de pacientes; las copias de las clínicas, sí. Para que no pase, sube el tope con la variable DOCS_CAP_GB del Worker (por encima de 10 GB, R2 cobra unos 0,015 $ por GB al mes) o pide a las clínicas que borren los archivos que ya no hagan falta.",
    });
  const db = o.database;
  if (db && db.bytes !== null && db.bytes >= db.warnAt)
    out.push({
      title: `La base de datos va por el ${percent(db.bytes, db.cap)} (${sizeText(db.bytes)} de ${sizeText(db.cap)})`,
      detail: docs?.enabled
        ? "Al llegar al límite de Cloudflare, el servidor deja de guardar cambios hasta que haya sitio (no se pierde nada: se quedan en los dispositivos). Con el plan de pago de Workers cada base puede llegar a 10 GB: pon entonces D1_CAP_MB = 10000 en el Worker."
        : "Al llegar al límite de Cloudflare, el servidor deja de guardar cambios hasta que haya sitio (no se pierde nada: se quedan en los dispositivos). Activa el almacén R2: las copias de las clínicas pasan allí y la base ocupa mucho menos (cloudflare/README.md, «Documentos»).",
    });
  if (!docs?.enabled)
    for (const c of o.clinics)
      if (!c.deletedAt && c.size >= D1_COPY_CAP * SHARE)
        out.push({
          title: `La copia de «${c.name}» ocupa ${sizeText(c.size)}`,
          detail: "Sin el almacén R2, cada copia puede ocupar 50 MB como mucho: al pasarse, esa clínica sigue sincronizando los cambios, pero no puede subir la copia entera. Activa R2 (cloudflare/README.md, «Documentos») y el límite desaparece.",
        });
  return out;
}
