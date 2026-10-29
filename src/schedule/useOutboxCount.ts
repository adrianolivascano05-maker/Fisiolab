// Cuántos envíos hay en la bandeja (outbox.ts), para la fila «Envíos» de Agenda › Hoy.
import { useDataVersion } from "../app/dataVersion";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { loadOutbox } from "./loadOutbox";

export function useOutboxCount(): number | null {
  const version = useDataVersion();
  const r = useAsync(async () => (await loadOutbox(getDb())).items.length, [version]);
  return r.data ?? null;
}
