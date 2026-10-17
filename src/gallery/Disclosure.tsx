// Desplegable sencillo (details/summary nativo) que recuerda si se dejó abierto.
import { ChevronDown } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { cx } from "../ui/cx";

function readMap(key: string): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Estado abierto/cerrado de varios desplegables, guardado en este navegador con la clave `key`. */
export function useOpenState(key: string, defaults: Record<string, boolean>) {
  const [map, setMap] = useState<Record<string, boolean>>(() => ({ ...defaults, ...readMap(key) }));
  const set = useCallback(
    (id: string, open: boolean) =>
      setMap((m) => {
        if (m[id] === open) return m;
        const next = { ...m, [id]: open };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Sin almacenamiento: se recuerda solo mientras dure la pantalla.
        }
        return next;
      }),
    [key],
  );
  const setAll = useCallback(
    (ids: string[], open: boolean) =>
      setMap((m) => {
        const next = { ...m, ...Object.fromEntries(ids.map((i) => [i, open])) };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Igual que arriba.
        }
        return next;
      }),
    [key],
  );
  return { isOpen: (id: string) => !!map[id], set, setAll };
}

export function Disclosure({
  title,
  meta,
  icon,
  open,
  onToggle,
  children,
  tone = "default",
}: {
  title: string;
  meta?: ReactNode;
  icon?: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <details open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)} className="group">
      <summary
        className={cx(
          "flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-surface [&::-webkit-details-marker]:hidden",
          tone === "warning" && "text-warning",
        )}
      >
        {icon}
        <span className="flex-1 font-semibold">{title}</span>
        {meta && <span className="text-sm text-text-muted">{meta}</span>}
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}
