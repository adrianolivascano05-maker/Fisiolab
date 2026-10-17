import { useCallback, useState } from "react";

const KEY = "impulso.exploracion.favoritos";

function read(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Tests favoritos, guardados en este navegador. */
export function useFavorites() {
  const [favorites, setFavorites] = useState(read);
  const toggle = useCallback((id: string) => {
    setFavorites((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento: los favoritos duran lo que la pestaña.
      }
      return next;
    });
  }, []);
  return { favorites, toggle };
}
