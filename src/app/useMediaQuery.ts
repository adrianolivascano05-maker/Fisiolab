// Si la pantalla cumple una consulta de medios («(min-width: 1024px)»), y se actualiza al cambiar de tamaño o girar.
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Ordenador o tableta apaisada: desde 1024 px (el mismo corte que `lg:` en las clases). */
const DESKTOP = "(min-width: 1024px)";
export const useDesktop = () => useMediaQuery(DESKTOP);
