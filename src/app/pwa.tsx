import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";

// ---------- Actualizaciones ----------

/** Aviso de versión nueva. No recarga sola: podría cortar un marcado a medias. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="safe-bottom fixed inset-x-0 bottom-20 z-40 px-4">
      <div className="mx-auto flex max-w-[var(--layout-content-max)] items-center gap-3 rounded-lg bg-text p-3 text-bg shadow-pop">
        <p className="flex-1 text-sm font-semibold">Hay una versión nueva de la app.</p>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Button>
        <IconButton label="Ahora no" className="text-bg hover:bg-text-muted" onClick={() => setNeedRefresh(false)}>
          <X aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}

// ---------- Instalación ----------

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  listeners.forEach((l) => l());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((l) => l());
});

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone o iPad (los iPad recientes se presentan como Mac con pantalla táctil). */
export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallState = "installed" | "prompt" | "ios" | "manual";

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const state: InstallState = isStandalone() ? "installed" : deferred ? "prompt" : isIos() ? "ios" : "manual";
  return {
    state,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
    },
  };
}

/** Pasos para instalar según el navegador. En iPhone no hay botón: se explica cómo hacerlo. */
export function InstallSteps({ state, install }: ReturnType<typeof useInstall>) {
  if (state === "installed") return <p className="text-sm text-success">La app está instalada en este dispositivo.</p>;
  if (state === "prompt") return <Button onClick={install}>Instalar la app</Button>;
  if (state === "ios") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          Abre esta página en <b>Safari</b>.
        </li>
        <li>
          Pulsa <b>Compartir</b> <Share aria-label="(icono de compartir)" className="inline size-4 align-text-bottom text-accent" />.
        </li>
        <li>
          Elige <b>«Añadir a pantalla de inicio»</b> y después <b>Añadir</b>.
        </li>
      </ol>
    );
  }
  return (
    <p className="text-sm">
      En el menú del navegador, elige <b>«Instalar app»</b> o <b>«Añadir a pantalla de inicio»</b>.
    </p>
  );
}

const DISMISS_KEY = "fisiolab.install-dismissed-at";
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Tarjeta en la lista de pacientes hasta que se instale (o se aparte durante 14 días). */
export function InstallCard() {
  const install = useInstall();
  const [hidden, setHidden] = useState(dismissedRecently);
  if (install.state === "installed" || hidden) return null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Ten Cénit a un toque</h2>
          <p className="text-sm text-text-muted">Instálala: abre sin internet y el navegador cuida tus datos.</p>
        </div>
        <IconButton
          label="Ocultar durante dos semanas"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch {
              /* sin almacenamiento: se oculta solo en esta visita */
            }
            setHidden(true);
          }}
        >
          <X aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
      <InstallSteps {...install} />
    </Card>
  );
}
