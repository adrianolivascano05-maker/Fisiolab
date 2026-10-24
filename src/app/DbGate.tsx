import { CopyX } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

/**
 * No deja usar la app si la base está abierta en otra pestaña (los datos no se guardarían). En cuanto la otra la
 * suelta (se cierra, o era la página anterior que tardaba en irse), sigue sola.
 */
export function DbGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "locked">("checking");
  // Si abrir los datos tarda (un móvil lento, el almacenamiento aún ocupado), que se vea que la app está en ello.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const check = () =>
      getDb()
        .info()
        .then(
          (info) => {
            if (!alive) return;
            setState(info.locked ? "locked" : "ok");
            if (info.locked) timer = window.setTimeout(check, 1000);
          },
          () => alive && setState("ok"), // otros fallos los muestra cada pantalla
        );
    void check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  if (state === "checking") {
    if (!slow) return null;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center p-4">
        <p aria-busy="true" className="text-center text-text-muted">
          Abriendo tus datos…
        </p>
      </main>
    );
  }
  if (state === "locked") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center gap-4 p-4">
        <EmptyState
          icon={CopyX}
          title="Cénit ya está abierta en otra pestaña"
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        >
          Usa esa pestaña, o ciérrala: esta seguirá sola. Solo una pestaña puede guardar datos a la vez.
        </EmptyState>
      </main>
    );
  }
  return children;
}
