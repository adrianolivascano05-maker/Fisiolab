import { BookOpen, CalendarDays, ChevronLeft, Settings, Users } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { getDb } from "../data/db";
import { clinicComplete, getClinic } from "../data/privacy";
import { cx } from "./cx";
import { Logo } from "./Logo";

/** Nombre de la pantalla a la que lleva «volver», para escribirlo junto a la flecha (como en el iPhone). */
export function parentLabel(backTo: string | undefined): string {
  if (!backTo) return "";
  const path = backTo.split(/[?#]/)[0]!;
  if (path === "/") return "Pacientes";
  if (path === "/ajustes") return "Ajustes";
  if (path === "/validacion") return "Validación";
  if (path === "/agenda") return "Agenda";
  if (path === "/biblioteca/cuestionarios") return "Cuestionarios";
  if (path.startsWith("/biblioteca") || path.startsWith("/exploracion")) return "Biblioteca";
  const tab = /^\/pacientes\/[^/]+\/(anamnesis|valoracion|exploracion|mediciones|cuestionarios|sesiones|movilidad|test)(\/[^/]+)?$/.exec(path);
  if (tab) {
    const sub: Record<string, string> = { saltos: "Saltos", fuerza: "Fuerza", sprint: "Sprint", carrera: "Carrera", isquios: "Nórdico", movilidad: "Movilidad" };
    if (tab[1] === "test" && tab[2]) return sub[tab[2].slice(1)] ?? "Medición";
    // Exploración, Mediciones y Cuestionarios viven en la pestaña Valoración.
    if (!tab[2]) return { anamnesis: "Anamnesis", valoracion: "Valoración", exploracion: "Valoración", mediciones: "Valoración", cuestionarios: "Valoración", sesiones: "Sesiones", movilidad: "Movilidad", test: "Medición" }[tab[1]!]!;
  }
  if (/^\/pacientes\/[^/]+\/consentimientos$/.test(path)) return "Consentimientos";
  if (/^\/pacientes\/[^/]+\/cobros$/.test(path)) return "Cobros";
  if (/^\/pacientes\/[^/]+$/.test(path)) return "Ficha";
  return "Atrás";
}

/**
 * Barra superior: «‹ pantalla anterior» a la izquierda, el título en el centro y las acciones a la derecha.
 * `titleShown`: en las pantallas con título grande, el pequeño solo aparece al bajar (la página lo decide).
 */
export function TopBar({
  title,
  backTo,
  backLabel,
  action,
  large,
  titleShown = true,
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
  action?: ReactNode;
  /** El título grande está en la página: aquí solo se repite (sin ser encabezado) al bajar. */
  large?: boolean;
  titleShown?: boolean;
}) {
  const label = backLabel ?? parentLabel(backTo);
  return (
    // Barra en verde de la marca, con una línea de oro debajo. Dentro, los colores de texto y de acento pasan a los claros.
    <header
      className="sticky top-0 z-20 border-b-2 border-highlight bg-brand text-on-brand shadow-sm"
      style={{ "--color-text": "var(--color-on-brand)", "--color-accent": "var(--color-on-brand)", "--color-surface": "color-mix(in srgb, var(--color-on-brand) 16%, transparent)" } as CSSProperties}
    >
      <div className="mx-auto grid h-[var(--layout-header)] max-w-[var(--layout-content-max)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2">
        <div className="min-w-0">
          {!backTo && (
            <Link to="/" className="inline-flex min-h-11 items-center rounded-md px-1.5 py-1">
              <Logo onDark />
            </Link>
          )}
          {backTo && (
            <Link
              to={backTo}
              aria-label={label === "Atrás" ? "Volver atrás" : `Volver a ${label}`}
              className="tap inline-flex max-w-full items-center rounded-md pr-2 font-semibold hover:bg-surface"
            >
              <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )}
        </div>
        {large ? (
          // Mientras se ve el título grande, este no ocupa sitio: «volver» se lee entero.
          <span aria-hidden="true" className={cx("truncate font-semibold transition-opacity duration-[var(--motion-base)]", titleShown ? "max-w-[40vw] opacity-100" : "w-0 opacity-0")}>
            {title}
          </span>
        ) : (
          <h1 className="max-w-[40vw] truncate text-base font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
            {title}
          </h1>
        )}
        <div className="flex min-w-0 items-center justify-end gap-1">{action}</div>
      </div>
    </header>
  );
}

// ---------- Barra de abajo ----------

type Tab = { root: string; label: string; icon: typeof Users; match: (path: string) => boolean };

const SETTINGS = /^\/(ajustes|instalar|ayuda|privacidad|validacion|cuenta|design)(\/|$)/;
const LIBRARY = /^\/(biblioteca|exploracion)(\/|$)/;
const tabs: Tab[] = [
  { root: "/", label: "Pacientes", icon: Users, match: (p) => !LIBRARY.test(p) && !p.startsWith("/agenda") && !SETTINGS.test(p) },
  { root: "/agenda", label: "Agenda", icon: CalendarDays, match: (p) => p.startsWith("/agenda") }, // src/schedule
  { root: "/biblioteca", label: "Biblioteca", icon: BookOpen, match: (p) => LIBRARY.test(p) }, // src/gallery
  { root: "/ajustes", label: "Ajustes", icon: Settings, match: (p) => SETTINGS.test(p) },
];

/** Última pantalla abierta en cada pestaña: al volver a una pestaña, se sigue donde se estaba. */
const lastIn = new Map<string, string>();

/** Hay algo por completar en Ajustes (los datos de la clínica): un punto en su pestaña, sin más. */
let pendingSettings: boolean | null = null;
function useSettingsPending() {
  const [pending, setPending] = useState(pendingSettings);
  useEffect(() => {
    let alive = true;
    getClinic(getDb()).then(
      (c) => {
        pendingSettings = !clinicComplete(c);
        if (alive) setPending(pendingSettings);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  return pending;
}

/**
 * Navegación inferior, al alcance del pulgar. Como en el iPhone: cada pestaña recuerda dónde se estaba, y pulsar
 * la pestaña en la que ya se está vuelve a su inicio.
 */
export function TabBar() {
  const { pathname, search } = useLocation();
  const current = tabs.find((t) => t.match(pathname)) ?? tabs[0]!;
  useEffect(() => {
    lastIn.set(current.root, pathname + search);
  }, [current.root, pathname, search]);
  const pending = useSettingsPending();
  return (
    <nav aria-label="Principal" className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur">
      <ul className="mx-auto grid h-[var(--layout-tabbar)] max-w-[var(--layout-content-max)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ root, label, icon: Icon }) => {
          const active = root === current.root;
          return (
            <li key={root}>
              <Link
                to={active ? root : (lastIn.get(root) ?? root)}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex h-full flex-col items-center justify-center gap-1 text-xs", active ? "font-semibold text-accent" : "text-text-muted")}
              >
                {/* Pestaña activa: una línea de oro arriba. */}
                <span aria-hidden="true" className={cx("absolute top-0 h-[3px] w-8 rounded-b-full bg-highlight transition-opacity", active ? "opacity-100" : "opacity-0")} />
                <span className="relative">
                  <Icon aria-hidden="true" className="size-6" />
                  {root === "/ajustes" && pending && <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-danger ring-2 ring-bg" />}
                </span>
                {label}
                {root === "/ajustes" && pending && <span className="sr-only">(hay datos por completar)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
