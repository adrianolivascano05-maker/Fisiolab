// Ajustes de la app guardados en la base (clave → JSON).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import type { Db } from "./db";

export async function getSetting<T>(db: Db, key: string): Promise<T | null> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [key]);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.transaction([
    {
      sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
      bind: [key, JSON.stringify(value)],
    },
  ]);
}
