// Lo que se ve mientras llega el código de una pantalla (las rutas van con lazy()): la barra de arriba, la de abajo y
// un esqueleto gris, en vez de una pantalla en blanco. El título de la barra llega con la pantalla.
import { SkeletonPage } from "../ui/Skeleton";
import { Page } from "./Page";

export function RouteFallback() {
  return (
    <Page title="" large={false}>
      <SkeletonPage />
    </Page>
  );
}

/**
 * Lo que se ve mientras arranca la app (abrir la base, comprobar la cuenta): la barra de arriba vacía y un esqueleto,
 * sin las pestañas ni nada que necesite la base abierta. Antes era una pantalla en blanco hasta un segundo entero.
 */
export function BootFallback() {
  return (
    <div className="min-h-dvh">
      <div aria-hidden="true" className="h-[var(--layout-header)] border-b-2 border-highlight bg-brand" />
      <main className="mx-auto max-w-[var(--layout-content-max)] px-4 pt-6">
        <SkeletonPage />
      </main>
    </div>
  );
}
