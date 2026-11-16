// «Novedades»: lo que ha cambiado de sitio o es nuevo (src/app/news.ts). Abrirla da el aviso por visto.
import { useEffect } from "react";
import { Link } from "react-router";
import { markNewsSeen, NEWS } from "../app/news";
import { Page } from "../app/Page";
import { Card } from "../ui/Card";

export function NewsPage() {
  useEffect(markNewsSeen, []);
  return (
    <Page title="Novedades" backTo="/ajustes">
      <p className="text-sm text-text-muted">Lo que ha cambiado de sitio o es nuevo. Nada se ha quitado: lo que se ha movido sigue estando, y aquí dice dónde.</p>
      <ul aria-label="Novedades" className="flex flex-col gap-3">
        {NEWS.map((n) => (
          <li key={n.title}>
            <Card className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">{n.title}</h2>
              <p className="text-sm">{n.text}</p>
              {n.to && (
                <Link to={n.to} className="inline-flex min-h-11 min-w-11 items-center self-start font-semibold text-accent underline underline-offset-2">
                  Ir allí
                </Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Link to="/ayuda" className="inline-flex min-h-11 items-center self-start font-semibold text-accent underline underline-offset-2">
        Cómo se usa la app
      </Link>
    </Page>
  );
}
