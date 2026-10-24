import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-bg text-text border border-border-input hover:bg-surface",
  ghost: "bg-transparent text-accent hover:bg-accent-soft",
  danger: "bg-danger text-on-accent hover:opacity-90",
};
// sm es más estrecho y de letra más pequeña, pero mide al menos 44px de alto como md: la zona táctil mínima en el
// móvil. Alto mínimo, no fijo: si el texto no cabe en una línea, el botón crece en vez de apretarlo.
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 py-1 text-sm font-semibold",
  md: "min-h-11 px-4 py-1.5 text-base font-semibold",
  lg: "min-h-14 px-6 py-2 text-lg",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-[var(--motion-fast)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "default" | "media";
  size?: "md" | "video";
};

/** Botón solo con icono. `label` es obligatorio: es lo que oye el lector de pantalla. */
export function IconButton({ label, tone = "default", size = "md", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center justify-center rounded-md transition-colors duration-[var(--motion-fast)] disabled:opacity-40",
        size === "video" ? "tap-video" : "tap",
        tone === "media" ? "text-media-text hover:bg-media-surface" : "text-text hover:bg-surface",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-pill border-2 border-current border-r-transparent"
    />
  );
}
