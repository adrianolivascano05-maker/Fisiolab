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
// sm se queda en 32px de alto visual pero mantiene 44px de zona táctil con el padding del contenedor.
const sizes: Record<Size, string> = {
  sm: "h-10 px-3 text-sm font-semibold",
  md: "h-11 px-4 text-base font-semibold",
  lg: "h-14 px-6 text-lg",
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

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-pill border-2 border-current border-r-transparent"
    />
  );
}
