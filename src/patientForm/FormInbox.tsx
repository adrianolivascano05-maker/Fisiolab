// Las respuestas de los pacientes llegan solas: con la app abierta en una clínica, la consulta de la sincronización
// (cada minuto, sync.ts) dice si hay alguna; entonces se bajan, se ponen en la ficha (collect.ts) y se avisa. Con un
// servidor de una versión anterior, que no lo dice, se preguntan aparte cada minuto (y al volver a la app o recuperar
// la conexión). Sin servidor, nada.
import { useCallback, useEffect, useRef } from "react";
import { bumpData } from "../app/dataVersion";
import { formTitle, isSignKind, PRIVACY_KIND } from "../clinical/patientForms";
import { useAnamnesisSections } from "../clinical/useAnamnesis";
import { getToken } from "../cloud/auth";
import { useCloud, useSyncState } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { useAppLock } from "../privacy/AppLock";
import { useToast } from "../ui/Toast";
import { collectAnswered } from "./collect";

/** Una búsqueda cada vez (dos pantallas a la vez no recogen lo mismo dos veces). */
let running: Promise<number | null> | null = null;

/** Buscar respuestas ahora: devuelve cuántas se han puesto en la ficha, o null si no se ha podido mirar. */
export function useCollectForms(): () => Promise<number | null> {
  const cloud = useCloud();
  const toast = useToast();
  const template = useAnamnesisSections();
  return useCallback(async () => {
    if (running) return running;
    const clinic = cloud?.clinic;
    const api = cloud?.clinics;
    const token = getToken();
    if (!clinic || !api || !token || !navigator.onLine) return null;
    running = (async () => {
      try {
        const got = await collectAnswered(
          getDb(),
          { answered: () => api.forms.answered(token, clinic.id), remove: (id) => api.forms.remove(token, clinic.id, id), keepDoc: (id) => api.docs.keep(token, clinic.id, id) },
          template,
        );
        for (const g of got) {
          if (g.files !== undefined) {
            toast(`${g.name || "Un paciente"} ha enviado ${g.files === 1 ? "1 archivo" : `${g.files} archivos`}: está${g.files === 1 ? "" : "n"} en sus archivos`, "success");
            continue;
          }
          if (isSignKind(g.kind)) {
            toast(`${g.name || "Un paciente"} ha firmado ${g.kind === PRIVACY_KIND ? "la hoja de protección de datos" : "un consentimiento informado"} en su móvil: está en su ficha`, "success");
            continue;
          }
          const extra = g.incomplete ? " (incompleto: sin nota)" : g.skipped ? ` · ${g.skipped === 1 ? "1 respuesta no se puso" : `${g.skipped} no se pusieron`}: ya había algo escrito` : "";
          toast(`${g.name || "Un paciente"} ha rellenado: ${formTitle(g.kind)}${extra}`, "success");
        }
        if (got.length) bumpData();
        return got.length;
      } catch {
        return null; // sin conexión o el servidor aún no tiene formularios: ya se mirará la próxima vez
      } finally {
        running = null;
      }
    })();
    return running;
  }, [cloud, toast, template]);
}

export function FormInbox() {
  const cloud = useCloud();
  const collect = useCollectForms();
  // La última versión (con la ficha de la clínica al día), sin volver a poner los temporizadores a cada cambio.
  const latest = useRef(collect);
  latest.current = collect;
  // Con la app bloqueada no se recoge (los avisos llevan el nombre del paciente y se verían sobre el PIN).
  const { locked } = useAppLock();
  const active = !!cloud?.clinic && !locked;
  const sync = useSyncState();
  const waiting = sync?.forms;
  // El servidor dice cuántas hay en cada vuelta: se recogen al verlas (y se vuelve a probar en la siguiente vuelta si
  // no se ha podido).
  useEffect(() => {
    if (active && waiting && !cloud?.closing) void latest.current();
  }, [active, waiting, sync?.lastSyncAt, cloud?.closing]);
  // Un servidor que no lo dice: se pregunta aparte, como antes.
  const ask = active && waiting === null;
  useEffect(() => {
    if (!ask) return;
    const run = () => {
      if (document.visibilityState === "visible" && !cloud?.closing) void latest.current();
    };
    const first = setTimeout(run, 3000);
    const every = setInterval(run, 60_000);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("online", run);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("online", run);
    };
  }, [ask]);
  return null;
}
