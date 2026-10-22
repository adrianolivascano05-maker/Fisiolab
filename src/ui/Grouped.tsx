// Listas agrupadas, como las del iPhone (Ajustes, Contactos): un título pequeño encima, filas con icono, nombre,
// un dato a la derecha o debajo, y la flecha cuando la fila lleva a otra pantalla.
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "./cx";

export function Group({ title, footer, children, className, id }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={cx("flex flex-col gap-1.5", className)}>
      {title && <h2 className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase" style={{ fontFamily: "var(--font-sans)" }}>{title}</h2>}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">{children}</ul>
      {footer && <p className="px-1 text-xs text-text-muted">{footer}</p>}
    </section>
  );
}

type RowProps = {
  icon?: LucideIcon;
  /** Color del icono: el de la marca, aviso (algo pendiente) o peligro. */
  tone?: "accent" | "warning" | "danger";
  title: ReactNode;
  /** Debajo del nombre, en gris. */
  subtitle?: ReactNode;
  /** A la derecha, antes de la flecha. */
  value?: ReactNode;
  /** El subtítulo en color de aviso. */
  warn?: boolean;
};

function Body({ icon: Icon, tone = "accent", title, subtitle, value, warn, chevron }: RowProps & { chevron: boolean }) {
  return (
    <>
      {Icon && (
        <span
          aria-hidden="true"
          className={cx(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            tone === "warning" ? "bg-warning-soft text-warning" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{title}</span>
        {subtitle && <span className={cx("text-sm", warn ? "text-warning" : "text-text-muted")}>{subtitle}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-text-muted">{value}</span>}
      {chevron && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />}
    </>
  );
}

const rowClass = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface";

/** Fila que lleva a otra pantalla. */
export function RowLink({ to, ...props }: RowProps & { to: string }) {
  return (
    <li>
      <Link to={to} className={rowClass}>
        <Body {...props} chevron />
      </Link>
    </li>
  );
}

/** Fila que hace algo aquí mismo (abrir una hoja, empezar una medición…). */
export function RowButton({ onClick, busy, ...props }: RowProps & { onClick: () => void; busy?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={busy} aria-busy={busy || undefined} className={cx(rowClass, "disabled:opacity-60")}>
        <Body {...props} chevron />
      </button>
    </li>
  );
}

/** Fila que solo informa. */
export function Row(props: RowProps) {
  return (
    <li className={rowClass.replace(" hover:bg-surface", "")}>
      <Body {...props} chevron={false} />
    </li>
  );
}
