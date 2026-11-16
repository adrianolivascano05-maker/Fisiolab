import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

type ToastTone = "success" | "danger" | "info";
/** Un botón en el aviso («Deshacer»): lo que hace al pulsarlo. Con él, el aviso dura el doble. */
export type ToastAction = { label: string; run: () => void | Promise<void> };
type ToastItem = { id: number; tone: ToastTone; text: string; action?: ToastAction };

const ToastContext = createContext<(text: string, tone?: ToastTone, action?: ToastAction) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const toneClass: Record<ToastTone, string> = {
  success: "bg-success text-on-accent",
  danger: "bg-danger text-on-accent",
  info: "bg-text text-bg",
};

/**
 * Mensajes breves ("Test guardado"), arriba, bajo la barra de título: abajo tapaban los botones de
 * marcar y de calcular. Región aria-live: el lector de pantalla los lee sin mover el foco.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const show = useCallback((text: string, tone: ToastTone = "info", action?: ToastAction) => {
    const id = next.current++;
    setItems((list) => [...list, { id, tone, text, action }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), action ? 7000 : 4000);
  }, []);
  const close = (id: number) => setItems((list) => list.filter((t) => t.id !== id));
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--layout-header)+0.5rem)] z-50 flex flex-col items-center gap-2 px-4 lg:left-[var(--layout-side)]"
      >
        {items.map((t) =>
          t.action ? (
            <div key={t.id} className={cx("flex items-center gap-1 rounded-md py-1 pr-1 pl-4 text-sm font-semibold shadow-pop", toneClass[t.tone])}>
              <span>{t.text}</span>
              <button
                type="button"
                className="pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 underline underline-offset-2 hover:bg-black/10"
                onClick={() => {
                  close(t.id);
                  void t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            </div>
          ) : (
            <p key={t.id} className={cx("rounded-md px-4 py-3 text-sm font-semibold shadow-pop", toneClass[t.tone])}>
              {t.text}
            </p>
          ),
        )}
      </div>
    </ToastContext.Provider>
  );
}
