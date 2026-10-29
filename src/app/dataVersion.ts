// Un contador que sube cuando cambia algo que afecta a lo que enseñan muchas pantallas a la vez (el motivo de
// consulta que se está viendo, una cita, un cobro): useAsync lo escucha y las pantallas recargan sus datos.
//
// Desde el 28-10-2026 el cambio puede decir qué tablas toca (`bumpData("appointments")`) y una pantalla puede
// decir qué tablas le importan (`useAsync(load, deps, { tables: ["members"] })`): así un toque en «Recordada» no
// relanza el equipo, los turnos o los precios. Sin tablas en uno u otro lado, todo sigue como antes: un cambio sin
// tablas recarga todas las pantallas, y una pantalla sin tablas recarga con cualquier cambio.
import { useSyncExternalStore } from "react";

/** Las tablas que se pueden nombrar (las que cambian desde la app; el resto va «sin tablas»). */
export type DataTable = "patients" | "appointments" | "sessions" | "payments" | "packs" | "consents" | "waitlist" | "members" | "schedule" | "settings" | "forms" | "documents";

let version = 0;
/** Cambios sin tablas: los que recargan todo. */
let untagged = 0;
const byTable = new Map<DataTable, number>();
const listeners = new Set<() => void>();

export function bumpData(...tables: DataTable[]) {
  version += 1;
  if (tables.length === 0) untagged += 1;
  for (const t of tables) byTable.set(t, (byTable.get(t) ?? 0) + 1);
  for (const l of listeners) l();
}

/** La versión que ve una pantalla: con tablas, solo cuentan los cambios de esas tablas y los que no dicen tabla. */
export function dataVersion(tables?: readonly DataTable[]): number {
  if (!tables || tables.length === 0) return version;
  let v = untagged;
  for (const t of tables) v += byTable.get(t) ?? 0;
  return v;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDataVersion(tables?: readonly DataTable[]) {
  // La lista llega nueva en cada render; lo que importa es su contenido.
  const key = tables?.join(",") ?? "";
  return useSyncExternalStore(subscribe, () => dataVersion(key ? (key.split(",") as DataTable[]) : undefined));
}
