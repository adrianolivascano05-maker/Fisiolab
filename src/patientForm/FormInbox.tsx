// Las respuestas de los pacientes llegan solas: con la app abierta en una clínica, cada minuto (y al volver a ella o
// recuperar la conexión) se buscan en el servidor, se ponen en la ficha (collect.ts) y se avisa. Sin servidor, nada.
import { useCallback, useEffect, useRef } from "react";
import { bumpData } from "../app/dataVersion";
import { formTitle } from "../clinical/patientForms";
import { useAnamnesisSections } from "../clinical/useAnamnesis";
import { getToken } from "../cloud/auth";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
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
          { answered: () => api.forms.answered(token, clinic.id), remove: (id) => api.forms.remove(token, clinic.id, id) },
          template,
        );
        for (const g of got) {
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
  const active = !!cloud?.clinic;
  useEffect(() => {
    if (!active) return;
    const run = () => {
      if (document.visibilityState === "visible") void latest.current();
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
  }, [active]);
  return null;
}
