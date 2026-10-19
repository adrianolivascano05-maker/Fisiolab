import { BookOpen, ChevronLeft, Settings, Users, ChartColumn } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { cx } from "./cx";
import { Logo } from "./Logo";

/**
 * Barra superior: volver, título y una acción opcional a la derecha. Con `brand`, en lugar del título
 * muestra la marca (la página pone entonces su propio h1).
 */
export function TopBar({ title, backTo, action, brand }: { title: string; backTo?: string; action?: ReactNode; brand?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 text-text backdrop-blur">
      <div className="mx-auto flex h-[var(--layout-header)] max-w-[var(--layout-content-max)] items-center gap-1 px-2">
        {backTo ? (
          <Link to={backTo} aria-label="Volver" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        {brand ? (
          <span className="flex-1 pl-2">
            <Logo />
          </span>
        ) : (
          <h1 className="flex-1 truncate text-lg">{title}</h1>
        )}
        {action}
      </div>
    </header>
  );
}

const tabs = [
  { to: "/", label: "Pacientes", icon: Users },
  { to: "/comparar", label: "Comparar", icon: ChartColumn },
  { to: "/exploracion", label: "Guía de tests", icon: BookOpen }, // src/gallery
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

/** Navegación inferior, al alcance del pulgar. */
export function TabBar() {
  return (
    <nav aria-label="Principal" className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg">
      <ul className="mx-auto grid h-[var(--layout-tabbar)] max-w-[var(--layout-content-max)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cx("relative flex h-full flex-col items-center justify-center gap-1 text-xs", isActive ? "font-semibold text-brand" : "text-text-muted")
              }
            >
              {({ isActive }) => (
                <>
                  {/* Pestaña activa: una línea de oro arriba. */}
                  <span aria-hidden="true" className={cx("absolute top-0 h-[3px] w-8 rounded-b-full bg-highlight transition-opacity", isActive ? "opacity-100" : "opacity-0")} />
                  <Icon aria-hidden="true" className="size-6" />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
