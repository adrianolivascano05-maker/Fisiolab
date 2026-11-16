// El aviso de «Novedades», una vez tras cada tanda de cambios (src/app/news.ts): solo a quien ya tenía pacientes en este
// dispositivo; a quien estrena la app no se le avisa de nada que haya cambiado.
import { X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { getDb } from "../data/db";
import { markNewsSeen, NEWS_VERSION, newsSeen } from "./news";
import { useAsync } from "./useAsync";

export function NewsNotice() {
  const [closed, setClosed] = useState(false);
  const show = useAsync(async () => {
    const seen = newsSeen();
    if (seen !== null) return seen < NEWS_VERSION;
    const [row] = await getDb().query<{ n: number }>("select count(*) as n from patients");
    if ((row?.n ?? 0) > 0) return true;
    markNewsSeen();
    return false;
  }, []);
  if (closed || !show.data) return null;
  const done = () => {
    markNewsSeen();
    setClosed(true);
  };
  return (
    <div role="note" aria-label="Novedades" className="flex items-center gap-2 rounded-md border border-border bg-info-soft py-1 pr-1 pl-3 text-sm">
      <span className="min-w-0 flex-1">
        Algunas cosas han cambiado de sitio.{" "}
        <Link to="/novedades" onClick={done} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Ver las novedades
        </Link>
      </span>
      <button type="button" aria-label="Cerrar el aviso de novedades" onClick={done} className="tap inline-flex shrink-0 items-center justify-center rounded-md hover:bg-surface">
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
