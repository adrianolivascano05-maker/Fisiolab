import { CopyX } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

/** No deja usar la app si la base está abierta en otra pestaña (los datos no se guardarían). */
export function DbGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "locked">("checking");
  useEffect(() => {
    getDb()
      .info()
      .then(
        (info) => setState(info.locked ? "locked" : "ok"),
        () => setState("ok"), // otros fallos los muestra cada pantalla
      );
  }, []);
  if (state === "checking") return null;
  if (state === "locked") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center gap-4 p-4">
        <EmptyState
          icon={CopyX}
          title="La app ya está abierta en otra pestaña"
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        >
          Usa esa pestaña, o ciérrala y pulsa Reintentar. Solo una pestaña puede guardar datos a la vez.
        </EmptyState>
      </main>
    );
  }
  return children;
}
