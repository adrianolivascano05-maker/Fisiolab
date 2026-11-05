// Mantiene al día el registro en memoria de los cuestionarios propios (src/clinical/ownCatalog.ts): al abrir la base
// y cada vez que cambian los ajustes (los guarda el editor o llegan de otro dispositivo). Si algo ha cambiado, avisa a
// las pantallas para que lo vuelvan a pintar.
import { useEffect } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { logError } from "../app/errorLog";
import { getDb } from "../data/db";
import { loadOwnCatalog } from "./ownCatalog";

export function OwnFormsLoader() {
  const version = useDataVersion(["settings"]);
  useEffect(() => {
    let alive = true;
    loadOwnCatalog(getDb()).then(
      (changed) => {
        if (alive && changed) bumpData();
      },
      (e: unknown) => logError("cuestionarios propios", e),
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return null;
}
