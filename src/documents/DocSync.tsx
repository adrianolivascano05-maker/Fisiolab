// Con la app abierta en una clínica, los archivos del paciente se ponen al día solos: cada minuto (y al volver a la
// app o recuperar la conexión) se sube lo pendiente y se borra del servidor lo borrado aquí (docSync.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bumpData } from "../app/dataVersion";
import { getToken } from "../cloud/auth";
import { clinicScope, type DocsUsage } from "../cloud/clinic";
import { useCloud } from "../cloud/CloudGate";
import { ServerError } from "../cloud/remote";
import { getDb } from "../data/db";
import { useAppLock } from "../privacy/AppLock";
import { useToast } from "../ui/Toast";
import { fetchUsage, lastUsage, syncDocuments, type DocsServer } from "./docSync";

/** El servidor de la clínica para los archivos y dónde se guardan en este dispositivo; null sin clínica. */
export function useDocsServer(): { server: DocsServer | null; space: string | null } {
  const cloud = useCloud();
  return useMemo(() => {
    if (!cloud?.clinic || !cloud.clinics) return { server: null, space: null };
    return { server: { api: cloud.clinics.docs, clinicId: cloud.clinic.id, token: getToken }, space: clinicScope(cloud.account, cloud.clinic) };
  }, [cloud]);
}

/**
 * Si el servidor guarda archivos y cuánto ocupan: lo último que se supo (también sin conexión) y, al abrir, lo que
 * diga ahora. Un servidor de antes de los documentos no conoce la ruta: como si no los tuviera.
 */
export function useDocsUsage(): { usage: DocsUsage | null; refresh: () => Promise<void> } {
  const { server } = useDocsServer();
  const [usage, setUsage] = useState<DocsUsage | null>(() => (server ? lastUsage(server.clinicId) : null));
  const refresh = useCallback(async () => {
    if (!server) return setUsage(null);
    try {
      setUsage(await fetchUsage(server));
    } catch (e) {
      if (e instanceof ServerError && e.status === 404) setUsage({ enabled: false });
      // Sin conexión: se queda lo último que se supo.
    }
  }, [server]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { usage, refresh };
}

/** Una vuelta cada vez. */
let running: Promise<void> | null = null;

export function DocSync() {
  const cloud = useCloud();
  const toast = useToast();
  const { server, space } = useDocsServer();
  const { locked } = useAppLock();
  const warned = useRef(false);
  const run = useCallback(() => {
    if (running || !server || !space || cloud?.closing || !navigator.onLine || document.visibilityState !== "visible") return;
    running = (async () => {
      try {
        const r = await syncDocuments(getDb(), space, server);
        if (r.uploaded || r.deleted) bumpData();
        if (r.full && !warned.current) {
          warned.current = true;
          toast("El almacén de archivos está lleno (10 GB): los nuevos se quedan en este dispositivo hasta que haya sitio", "danger");
        }
      } catch {
        // Sin conexión, sesión caducada o servidor sin documentos: ya se intentará en la próxima vuelta.
      } finally {
        running = null;
      }
    })();
  }, [server, space, cloud?.closing, toast]);
  const latest = useRef(run);
  latest.current = run;
  const active = !!server && !locked;
  useEffect(() => {
    if (!active) return;
    const go = () => latest.current();
    const first = setTimeout(go, 5000);
    const every = setInterval(go, 60_000);
    document.addEventListener("visibilitychange", go);
    window.addEventListener("online", go);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", go);
      window.removeEventListener("online", go);
    };
  }, [active]);
  return null;
}
