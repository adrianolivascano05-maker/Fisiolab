// Aspecto de la app: automático (sigue al teléfono u ordenador), claro u oscuro. Se guarda en este dispositivo; los
// colores de cada modo están en src/styles/tokens.css (data-theme en <html>).
import { useState } from "react";

export type Theme = "auto" | "light" | "dark";
const KEY = "fisiolab.theme";
export const THEME_LABELS: Record<Theme, string> = { auto: "Automático", light: "Claro", dark: "Oscuro" };

function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Pone el aspecto en la página. Se llama al arrancar (antes de pintar) y al cambiarlo. */
export function applyTheme(theme: Theme = getTheme()) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = useState(getTheme);
  const set = (t: Theme) => {
    try {
      if (t === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* sin almacenamiento: vale mientras la app esté abierta */
    }
    applyTheme(t);
    setState(t);
  };
  return [theme, set];
}
