// La sección Pacientes en el ordenador (desde 1024 px): el menú lateral, la lista de pacientes fija a la izquierda y
// a la derecha lo que se esté viendo (el inicio con lo de hoy, o la ficha). En el móvil, cada pantalla va sola.
import { Outlet, useLocation } from "react-router";
import { PatientsPane } from "../pages/PatientsPage";
import { SideNav } from "../ui/AppBar";
import { PaneContext } from "./pane";
import { useDesktop } from "./useMediaQuery";

/** Pantallas de vídeo a pantalla completa: sin paneles. */
const MEDIA = /\/(marcar|medicion-libre)$/;

export function PatientsLayout() {
  const desktop = useDesktop();
  const { pathname } = useLocation();
  if (!desktop || MEDIA.test(pathname)) return <Outlet />;
  const id = /^\/pacientes\/([^/]+)/.exec(pathname)?.[1] ?? null;
  return (
    <PaneContext value={true}>
      <SideNav />
      <div className="grid grid-cols-[20rem_minmax(0,1fr)] pl-[var(--layout-side)]">
        <aside aria-label="Lista de pacientes" className="sticky top-0 h-dvh overflow-y-auto border-r border-border bg-bg">
          <PatientsPane currentId={id === "nuevo" ? null : id} />
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PaneContext>
  );
}
