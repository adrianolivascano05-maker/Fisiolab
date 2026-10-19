import { useEffect, useRef, useState, type ReactNode } from "react";
import { SyncNotice } from "../cloud/CloudGate";
import { Alert } from "../ui/Alert";
import { TabBar, TopBar } from "../ui/AppBar";
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
  children: ReactNode;
};

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

export function Page({ title, backTo, backLabel, action, tabs = true, tone = "default", large = !backTo, header, children }: PageProps) {
  const big = large || !!header;
  const { ref, past } = useScrolledPast();
  const showTabs = tabs && tone !== "media";
  return (
    <div className={cx("min-h-dvh", tone === "media" && "bg-media-bg text-media-text")}>
      <TopBar title={title} backTo={backTo} backLabel={backLabel} action={action} large={big} titleShown={!big || past} />
      <main className={cx("mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-4 px-4 pt-2", showTabs ? "pb-28" : "pb-12")}>
        {header ?? (big && <h1 className="text-[2rem] leading-tight font-bold">{title}</h1>)}
        {big && <div ref={ref} aria-hidden="true" className="-mt-4 h-0" />}
        <SyncNotice />
        {children}
      </main>
      {showTabs && <TabBar />}
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
