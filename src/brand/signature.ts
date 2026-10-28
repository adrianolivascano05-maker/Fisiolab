// La firma dibujada de cada fisioterapeuta: se dibuja una vez en Ajustes › Clínica (con el mismo recuadro que los
// consentimientos) y sale en sus informes, altas, derivaciones, justificantes y recibos, en pantalla y en el PDF. Es un
// ajuste de cada persona (memberKey): en una clínica con equipo, cada fisio la suya. Va cifrada y sincronizada como
// los demás ajustes. Sin firma dibujada, la línea de firma se queda vacía, como hasta ahora.
import type { Db } from "../data/db";
import { memberKey } from "../data/member";
import { getSetting, setSetting } from "../data/repo";

const SIGNATURE_KEY = "physio_signature";
/** Un PNG de 600 × 200 del recuadro de firma pesa unos 10 KB; esto deja margen de sobra. */
export const MAX_SIGNATURE_CHARS = 120_000;

const valid = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_SIGNATURE_CHARS && v.startsWith("data:image/png;base64,");

/** La firma dibujada de quien usa la app (PNG como data: URL), o null si no la ha dibujado. */
export async function getSignature(db: Db): Promise<string | null> {
  const v = await getSetting<unknown>(db, memberKey(SIGNATURE_KEY));
  return valid(v) ? v : null;
}

/** Guarda la firma dibujada (o la quita con null). */
export async function saveSignature(db: Db, png: string | null): Promise<void> {
  if (png !== null && !valid(png)) throw new RangeError("La firma tiene que ser un PNG pequeño.");
  await setSetting(db, memberKey(SIGNATURE_KEY), png);
}
