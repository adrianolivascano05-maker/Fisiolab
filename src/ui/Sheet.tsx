import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";

type SheetProps = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/**
 * Hoja inferior (ayuda de cada test, confirmaciones). Usa <dialog> nativo:
 * atrapa el foco, cierra con Escape y devuelve el foco al botón que la abrió.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Con dos hojas en la misma pantalla, cada una con su título.
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className="safe-bottom m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-lg bg-bg p-0 text-text shadow-pop backdrop:bg-text/40"
    >
      <div className="mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
