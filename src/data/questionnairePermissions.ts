// Los cuestionarios pendientes del permiso de su titular (license «comprobar» en src/clinical/questionnaires.ts) se
// rellenan en la app solo cuando la clínica marca que ya lo tiene (Biblioteca › Cuestionarios: en su ficha o en «Permisos y licencias»). Se guarda en los
// ajustes de la clínica, así que vale para todo el equipo.
import { useAsync } from "../app/useAsync";
import { useDataVersion } from "../app/dataVersion";
import type { Db } from "./db";
import { getDb } from "./db";
import { getSetting, setSetting } from "./repo";

export const PERMISSIONS_KEY = "questionnaire_permissions";

export async function getGranted(db: Db): Promise<string[]> {
  const v = await getSetting<unknown>(db, PERMISSIONS_KEY);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function setGranted(db: Db, ids: string[]): Promise<void> {
  await setSetting(db, PERMISSIONS_KEY, [...new Set(ids)].sort());
}

/** Los que la clínica ha marcado que tiene permiso para usar. */
export function useGranted(): string[] {
  const version = useDataVersion();
  return useAsync(() => getGranted(getDb()), [version]).data ?? [];
}
