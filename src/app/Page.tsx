import { useEffect, useRef, useState, type ReactNode } from "react";
import { SyncNotice } from "../cloud/CloudGate";
import { SyncFloat } from "../cloud/SyncFloat";
import { Alert } from "../ui/Alert";
import { SideNav, TabBar, TopBar } from "../ui/AppBar";
import { useInPane } from "./pane";
import { cx } from "../ui/cx";

type PageProps = {
  title: string;
  backTo?: string;
  /** Texto de «volver» si no basta con el que sale de `backTo` (p. ej. el nombre del paciente). */
  backLabel?: string;
  action?: ReactNode;
  /** La barra de abajo: en todas las pantallas salvo en formularios y en las de vídeo. */
  tabs?: boolean;
  tone?: "default" | "media";
  /**
   * Título grande al principio de la página (las pantallas principales y la ficha), como en el iPhone: al bajar,
   * pasa a la barra de arriba. Por defecto, en las pantallas sin «volver».
   */
  large?: boolean;
  /** En lugar del título grande, una cabecera propia (debe llevar el h1). */
  header?: ReactNode;
  /** Más ancha en pantallas grandes (la agenda, con una columna por día). */
  wide?: boolean;
  /**
   * Ancho del contenido en pantallas grandes: `content` (lectura, 52 rem), `record` (la ficha y sus formularios,
   * que en ancho se ponen en dos columnas: 64 rem) o `wide` (la agenda, 90 rem; también con `wide`).
   */
  width?: "content" | "record" | "wide";
  children: ReactNode;
};

const WIDTHS = { content: "max-w-[var(--layout-content-max)]", record: "max-w-[64rem]", wide: "max-w-[90rem]" };

/** El título grande ha salido por arriba (para enseñarlo pequeño en la barra). */
function useScrolledPast() {
  const ref = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPast(!e!.isIntersecting && e!.boundingClientRect.top < 0), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, past };
}

export function Page({ title, backTo, backLabel, action, tabs = true, tone = "default", large = !backTo, header, wide = false, width = wide ? "wide" : "content", children }: PageProps) {
  const big = large || !!header;
  const { ref, past } = useScrolledPast();
  const showTabs = tabs && tone !== "media";
  // En el ordenador, el menú lateral en todas las pantallas (también en los formularios) salvo en las de vídeo; si la
  // pantalla va dentro de un panel (Pacientes), el panel ya lo pone.
  const inPane = useInPane();
  const showSide = tone !== "media" && !inPane;
  return (
    <div className={cx("min-h-dvh", tone === "media" && "bg-media-bg text-media-text", showSide && "lg:pl-[var(--layout-side)]")}>
      <TopBar title={title} backTo={backTo} backLabel={backLabel} action={action} large={big} titleShown={!big || past} />
      {/* La ficha (`record`) es un `@container`: sus pantallas se ponen en columnas según el ancho que les queda (con
          la lista de pacientes al lado, menos), no según el de la ventana; por debajo de 42 rem (el móvil siempre)
          nada cambia. Solo ahí: un contenedor también encierra lo `fixed` de dentro (la capa de arrastre de la agenda). */}
      <main className={cx("mx-auto flex flex-col gap-4 px-4 pt-2 lg:px-6", width === "record" && "@container", WIDTHS[width], showTabs ? "pb-28 lg:pb-12" : "pb-12")}>
        {header ?? (big && <h1 className="text-[2rem] leading-tight font-bold">{title}</h1>)}
        {big && <div ref={ref} aria-hidden="true" className="-mt-4 h-0" />}
        <SyncNotice />
        {children}
        {tone !== "media" && <SyncFloat tabs={showTabs} />}
      </main>
      {showTabs && <TabBar />}
      {showSide && <SideNav />}
    </div>
  );
}

export function Loading() {
  return (
    <p aria-busy="true" className="py-8 text-center text-text-muted">
      Cargando…
    </p>
  );
}

export function LoadError({ error }: { error: Error }) {
  return (
    <Alert tone="danger" title="No se pudieron cargar los datos">
      {error.message}
    </Alert>
  );
}
