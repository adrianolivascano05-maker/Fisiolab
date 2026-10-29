// La ventana flotante de la sincronización: si algo impide sincronizar (un error, la sesión de Google caducada, cambios
// sin subir que no salen), se queda fija abajo hasta que se arregla, con lo que hay que pulsar. Mientras todo va bien,
// no sale. Lo que se arregla en el momento (la contraseña de cifrado) sigue en el aviso de arriba (SyncNotice).
import { CloudOff, LogIn, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { useCloud, useSyncState } from "./cloudContext";
import type { SyncState } from "./sync";

/** Cambios sin subir durante tanto tiempo, sin error a la vista: algo no va bien. */
const STUCK_MS = 2 * 60_000;

type Problem = { text: string; detail?: string; kind: "sync" | "login" };

const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** Lo que impide sincronizar, si hay algo. Mientras se vuelve a intentar, lo de la vuelta anterior (sin parpadear). */
export function syncProblem(s: SyncState, now = Date.now()): Problem | null {
  const status = s.status === "syncing" ? s.failing : s.status;
  switch (status) {
    case "error":
      return { kind: "sync", text: s.pending ? "No se ha podido sincronizar: hay cambios sin subir." : "No se ha podido sincronizar.", detail: s.error ?? undefined };
    case "needs-auth":
      return { kind: "login", text: s.pending ? "Hay cambios sin subir: tu sesión de Google ha caducado." : "Sin sincronizar: tu sesión de Google ha caducado." };
    case "offline":
      return s.pending ? { kind: "sync", text: "Sin conexión: hay cambios esperando.", detail: "Se subirán solos al volver la conexión." } : null;
    case "idle":
      return s.pending && s.pendingSince && now - Date.parse(s.pendingSince) > STUCK_MS ? { kind: "sync", text: `Hay cambios sin subir desde las ${hour(s.pendingSince)}.` } : null;
    default:
      return null;
  }
}

/** `tabs`: hay barra de pestañas abajo (en el móvil), y la ventana va encima. */
export function SyncFloat({ tabs }: { tabs: boolean }) {
  const cloud = useCloud();
  const s = useSyncState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const problem = cloud && s ? syncProblem(s, now) : null;
  if (!cloud || !s || !problem) return null;
  return (
    <>
      {/* Lo que tapa la ventana, al final de la página: así se puede llegar a todo. */}
      <div aria-hidden="true" className="h-24 shrink-0" />
      <div
        role="status"
        aria-label="Sincronización"
        className={cx(
          "fixed inset-x-3 z-30 mx-auto flex max-w-[var(--layout-content-max)] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warning bg-warning-soft px-3 py-2 shadow-lg",
          "lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-sm",
          tabs ? "bottom-[calc(var(--layout-tabbar)+env(safe-area-inset-bottom)+0.5rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        )}
      >
        <CloudOff aria-hidden="true" className="size-5 shrink-0 text-warning" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{problem.text}</span>
          {problem.detail && <span className="block break-words text-text-muted">{problem.detail}</span>}
        </span>
        {problem.kind === "login" ? (
          <Button size="sm" icon={<LogIn aria-hidden="true" className="size-4" />} onClick={cloud.reconnect}>
            Pulsa para entrar
          </Button>
        ) : (
          <Button size="sm" icon={<RefreshCw aria-hidden="true" className="size-4" />} loading={s.status === "syncing"} onClick={() => void cloud.sync.sync()}>
            Pulsa para sincronizar
          </Button>
        )}
      </div>
    </>
  );
}
