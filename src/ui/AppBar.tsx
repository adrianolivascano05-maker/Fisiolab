import { BookOpen, CalendarDays, ChevronLeft, Settings, Users } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { getDb } from "../data/db";
import { clinicComplete, getClinic } from "../data/privacy";
import { cx } from "./cx";
import { ownIdentity, useBrand } from "../brand/brand";
import { Logo, LogoMark } from "./Logo";

/** Nombre de la pantalla a la que lleva «volver», para escribirlo junto a la flecha (como en el iPhone). */
function parentLabel(backTo: string | undefined): string {
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
      {/* Las acciones a su medida; el título, entero (como mínimo su palabra más larga; lo que no cabe en una línea pasa
          a dos, nunca «…»); lo de la izquierda (el logo con el nombre de la clínica, o «volver») cede sitio y se corta
          con «…» antes que el título. */}
      <div className="mx-auto grid h-[var(--layout-header)] max-w-[var(--layout-content-max)] grid-cols-[minmax(0,auto)_minmax(min-content,1fr)_auto] items-center gap-2 px-2">
        <div className="min-w-0">
          {!backTo && (
            <Link to="/" className="inline-flex min-h-11 max-w-full min-w-0 items-center rounded-md px-1.5 py-1 lg:hidden">
              <Logo onDark />
            </Link>
          )}
          {backTo && (
            <Link
              to={backTo}
              aria-label={label === "Atrás" ? "Volver atrás" : `Volver a ${label}`}
              className="tap inline-flex max-w-[44vw] items-center rounded-md pr-2 font-semibold hover:bg-surface"
            >
              <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
              <span className={cx("line-clamp-2", label.length > 12 && "text-sm leading-tight")}>{label}</span>
            </Link>
          )}
        </div>
        {large ? (
          // Mientras se ve el título grande, este no ocupa sitio: «volver» se lee entero.
          <span
            aria-hidden="true"
            className={cx(
              "line-clamp-2 text-center font-semibold transition-opacity duration-[var(--motion-base)]",
              title.length > 22 && "text-sm leading-tight",
              titleShown ? "opacity-100" : "invisible opacity-0",
            )}
          >
            {title}
          </span>
        ) : title ? (
          <h1 className={cx("line-clamp-2 text-center font-semibold", title.length > 22 ? "text-sm leading-tight" : "text-base")} style={{ fontFamily: "var(--font-sans)" }}>
            {title}
          </h1>
        ) : (
          // Mientras llega la pantalla (RouteFallback): el hueco del título, latiendo.
          <span aria-hidden="true" className="mx-auto block h-4 w-28 animate-pulse rounded-md bg-on-brand/20" />
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
    <nav aria-label="Principal" className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur lg:hidden">
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

// ---------- Menú lateral (ordenador) ----------

/** El buscador de pacientes (el de la lista fija del ordenador y el de la pantalla Pacientes del móvil). */
const SEARCH_ID = "patient-search";

/** Con el teclado: «/» lleva el cursor al buscador de pacientes (si no está a la vista, abre Pacientes). */
function useSearchShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      const el = document.getElementById(SEARCH_ID);
      if (el) return el.focus();
      navigate("/");
      // La lista se pinta en cuanto carga la pantalla: se le da hasta un segundo.
      const until = Date.now() + 1000;
      const tryFocus = () => {
        const found = document.getElementById(SEARCH_ID);
        if (found) found.focus();
        else if (Date.now() < until) requestAnimationFrame(tryFocus);
      };
      requestAnimationFrame(tryFocus);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

/**
 * En el ordenador (desde 1024 px) el menú principal va a la izquierda, siempre a la vista: solo iconos en pantallas
 * medianas y con su nombre desde 1280 px. Las mismas cuatro secciones y la misma memoria que la barra de abajo.
 */
export function SideNav() {
  const { pathname, search } = useLocation();
  const current = tabs.find((t) => t.match(pathname)) ?? tabs[0]!;
  useEffect(() => {
    lastIn.set(current.root, pathname + search);
  }, [current.root, pathname, search]);
  const pending = useSettingsPending();
  const brand = useBrand();
  useSearchShortcut();
  return (
    <nav aria-label="Principal" className="fixed inset-y-0 left-0 z-20 hidden w-[var(--layout-side)] flex-col border-r border-border bg-bg lg:flex">
      {/* El logo lleva al inicio. Su nombre accesible es el texto visible («OmniClin»); en la franja de iconos, el símbolo con su nombre. */}
      <Link to="/" title="Inicio" className="flex h-[var(--layout-header)] shrink-0 items-center justify-center border-b-2 border-highlight bg-brand xl:justify-start xl:px-4">
        <span className="xl:hidden">
          <LogoMark size={34} bordered title={ownIdentity(brand)?.name ?? "OmniClin"} />
        </span>
        <span className="hidden xl:block">
          <Logo onDark />
        </span>
      </Link>
      <ul className="flex flex-col gap-1 p-2 xl:p-3">
        {tabs.map(({ root, label, icon: Icon }) => {
          const active = root === current.root;
          return (
            <li key={root}>
              <Link
                to={active ? root : (lastIn.get(root) ?? root)}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cx(
                  "relative flex min-h-11 items-center justify-center gap-3 rounded-md px-2 text-sm xl:justify-start xl:px-3",
                  active ? "bg-accent-soft font-semibold text-accent" : "text-text-muted hover:bg-surface hover:text-text",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden="true" className="size-6" />
                  {root === "/ajustes" && pending && <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-danger ring-2 ring-bg" />}
                </span>
                <span className="sr-only xl:not-sr-only">{label}</span>
                {root === "/ajustes" && pending && <span className="sr-only">(hay datos por completar)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
