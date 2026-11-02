// Dónde abre la app al tocar su icono: en la Agenda (lo primero del día de un fisio) o en Pacientes. Se guarda en este
// dispositivo, como el aspecto. Solo cuenta al abrirla desde el icono instalado: el manifiesto la abre con
// «?inicio» (vite.config.ts, start_url) y HomeRoute lleva a la Agenda; un enlace a la dirección normal abre Pacientes.
import { useState } from "react";

export type StartPage = "agenda" | "pacientes";
const KEY = "omniclin.inicio";
export const START_LABELS: Record<StartPage, string> = { agenda: "Agenda (lo de hoy)", pacientes: "Pacientes" };

export function getStartPage(): StartPage {
  try {
    return localStorage.getItem(KEY) === "pacientes" ? "pacientes" : "agenda";
  } catch {
    return "agenda";
  }
}

export function useStartPage(): [StartPage, (p: StartPage) => void] {
  const [page, setState] = useState(getStartPage);
  const set = (p: StartPage) => {
    try {
      if (p === "agenda") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* sin almacenamiento: vale mientras la app esté abierta */
    }
    setState(p);
  };
  return [page, set];
}

/** La marca que pone el manifiesto en la dirección de inicio. */
export const START_PARAM = "inicio";
