// Un contador que sube cuando cambia algo que afecta a lo que enseñan muchas pantallas a la vez (el motivo de
// consulta que se está viendo): useAsync lo escucha y todas recargan sus datos.
import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

export function bumpData() {
  version += 1;
  for (const l of listeners) l();
}

export function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
