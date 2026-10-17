import { useCallback, useEffect, useState } from "react";

type State<T> = { data: T | undefined; error: Error | null; loading: boolean };

/** Carga datos de la base y permite recargarlos tras un cambio. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las da quien llama
  const run = useCallback(load, deps);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    run().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error: unknown) => alive && setState({ data: undefined, error: error instanceof Error ? error : new Error(String(error)), loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [run, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
