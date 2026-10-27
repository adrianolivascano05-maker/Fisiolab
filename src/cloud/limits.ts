// Los avisos del panel del proveedor (ProviderPage): al llegar al 70 % de un límite del servidor (cloudflare/README.md,
// «Límites»), qué pasa al llegar al tope y qué hacer antes. Las peticiones al día no las sabe el servidor: se miran en
// el panel de Cloudflare (README, «Cuántas clínicas caben»).
import { sizeText } from "../data/documents";
import type { OperatorClinic } from "./clinic";

export type StorageUsage = { enabled: boolean; total: number; copies?: number; cap: number; warnAt: number };
export type DatabaseUsage = { bytes: number | null; cap: number; warnAt: number };
export type LimitWarning = { title: string; detail: string };

/** Sin almacén R2, cada copia va en la base D1 y no puede pasar de 50 MB (cloudflare/worker.js, MAX_CHARS). */
export const D1_COPY_CAP = 50 * 1024 * 1024;
const SHARE = 0.7;

const percent = (used: number, cap: number) => `${Math.floor((used / cap) * 100)} %`;

export function limitWarnings(o: { clinics: Pick<OperatorClinic, "name" | "size" | "deletedAt">[]; documents?: StorageUsage; database?: DatabaseUsage }): LimitWarning[] {
  const out: LimitWarning[] = [];
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
