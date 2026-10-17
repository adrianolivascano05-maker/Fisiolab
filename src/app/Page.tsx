import type { ReactNode } from "react";
import { Alert } from "../ui/Alert";
import { TabBar, TopBar } from "../ui/AppBar";
import { cx } from "../ui/cx";

type PageProps = {
  title: string;
  backTo?: string;
  action?: ReactNode;
  /** Las tres pantallas principales llevan la barra inferior. */
  tabs?: boolean;
  tone?: "default" | "media";
  children: ReactNode;
};

export function Page({ title, backTo, action, tabs, tone = "default", children }: PageProps) {
  return (
    <div className={cx("min-h-dvh", tone === "media" && "bg-media-bg text-media-text")}>
      <TopBar title={title} backTo={backTo} action={action} />
      <main className={cx("mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-4 px-4 pt-4", tabs ? "pb-28" : "pb-12")}>
        {children}
      </main>
      {tabs && <TabBar />}
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
