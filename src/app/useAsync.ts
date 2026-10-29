import { useCallback, useEffect, useState } from "react";
import { useDataVersion, type DataTable } from "./dataVersion";
import { logError } from "./errorLog";

type State<T> = { data: T | undefined; error: Error | null; loading: boolean };

/**
 * Carga datos de la base y los recarga tras un cambio (bumpData). `tables`: las tablas que le importan a esta carga;
 * con ellas, los cambios que nombran otras tablas no la relanzan (src/app/dataVersion.ts). Sin ellas, cualquier cambio.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], opts: { tables?: readonly DataTable[] } = {}) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const version = useDataVersion(opts.tables);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las da quien llama
  const run = useCallback(load, deps);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    run().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error: unknown) => {
        logError("pantalla", error); // queda en Ajustes › Informar de un problema, aunque la pantalla solo diga «no se pudo cargar»
        if (alive) setState({ data: undefined, error: error instanceof Error ? error : new Error(String(error)), loading: false });
      },
    );
    return () => {
      alive = false;
    };
  }, [run, tick, version]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
