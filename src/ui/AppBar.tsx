import { ChevronLeft, Settings, Users, ChartColumn } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { cx } from "./cx";

/** Barra superior: volver, título y una acción opcional a la derecha. */
export function TopBar({ title, backTo, action }: { title: string; backTo?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[var(--layout-header)] max-w-[var(--layout-content-max)] items-center gap-1 px-2">
        {backTo ? (
          <Link to={backTo} aria-label="Volver" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="flex-1 truncate text-lg">{title}</h1>
        {action}
      </div>
    </header>
  );
}

const tabs = [
  { to: "/", label: "Pacientes", icon: Users },
  { to: "/comparar", label: "Comparar", icon: ChartColumn },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

/** Navegación inferior, al alcance del pulgar. */
export function TabBar() {
  return (
    <nav aria-label="Principal" className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg">
      <ul className="mx-auto grid h-[var(--layout-tabbar)] max-w-[var(--layout-content-max)] grid-cols-3">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                cx("flex h-full flex-col items-center justify-center gap-1 text-xs", isActive ? "text-accent" : "text-text-muted")
              }
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
