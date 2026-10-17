import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

type ToastTone = "success" | "danger" | "info";
type ToastItem = { id: number; tone: ToastTone; text: string };

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const toneClass: Record<ToastTone, string> = {
  success: "bg-success text-on-accent",
  danger: "bg-danger text-on-accent",
  info: "bg-text text-bg",
};

/** Mensajes breves ("Test guardado"). Región aria-live: el lector de pantalla los lee sin mover el foco. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const show = useCallback((text: string, tone: ToastTone = "info") => {
    const id = next.current++;
    setItems((list) => [...list, { id, tone, text }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="safe-bottom pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <p key={t.id} className={cx("rounded-md px-4 py-3 text-sm font-semibold shadow-pop", toneClass[t.tone])}>
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
