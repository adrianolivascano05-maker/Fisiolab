// Si una pantalla falla al pintarse, en vez de quedarse en blanco: qué ha pasado, volver y mandar el informe.
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { logError } from "./errorLog";

export function RouteError() {
  const error = useRouteError();
  useEffect(() => logError("pantalla", error), [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center gap-4 p-4">
      <TriangleAlert aria-hidden="true" className="size-10 text-warning" />
      <h1 className="text-2xl font-bold">Algo ha fallado en esta pantalla</h1>
      <p>Lo que hayas guardado antes sigue guardado. Prueba a recargar; si vuelve a pasar, manda el informe para que se pueda arreglar.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => location.reload()} className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
          Recargar
        </button>
        <Link to="/ayuda/fallos" className="inline-flex min-h-11 items-center rounded-md border border-border-input bg-bg px-4 font-semibold hover:bg-surface">
          Enviar el informe
        </Link>
        <Link to="/" className="inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-accent hover:bg-accent-soft">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
