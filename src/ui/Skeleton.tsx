// Esqueletos de carga: en vez de una pantalla en blanco o un «Cargando…» suelto, unas barras grises del tamaño de lo que
// va a salir, que laten. Para el lector de pantalla sigue habiendo un «Cargando…» (aria-busy y texto solo para él).
import { cx } from "./cx";

/** Una barra gris que late; `className` da el tamaño (h-4 w-32…). */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse rounded-md bg-surface", className)} />;
}

/** Varias filas como las de una lista (icono, título y detalle), dentro de un recuadro. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cx("flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg", className)}>
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex min-h-14 items-center gap-3 px-3 py-2">
          <Bone className="size-5 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone className={cx("h-4", i % 2 ? "w-2/5" : "w-3/5")} />
            <Bone className="h-3 w-1/3" />
          </span>
        </span>
      ))}
    </div>
  );
}

/** Lo que se ve mientras llega una pantalla entera: un título y dos bloques de filas. */
export function SkeletonPage() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Cargando…</span>
      <Bone className="h-5 w-40" />
      <SkeletonList rows={3} />
      <Bone className="mt-2 h-4 w-24" />
      <SkeletonList rows={2} />
    </div>
  );
}
