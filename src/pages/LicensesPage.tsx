// Ayuda › Licencias de terceros: lo que lleva dentro la app (librerías, letras, el modelo de pose), cada uno con su
// licencia y su texto completo. La lista sale del propio build (tools/licenses.ts → licencias.json), así que siempre
// es la de la versión que está abierta.
import { useEffect, useState } from "react";
import { Page } from "../app/Page";
import { Card } from "../ui/Card";

type ThirdParty = { name: string; version: string; license: string; author?: string; homepage?: string; text: string; note?: string };
type State = { list: ThirdParty[] } | { error: string } | null;

/** Cuántos hay de cada licencia, de más a menos: «30 MIT, 11 ISC…». */
export function licenseCounts(list: { license: string }[]): string {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(p.license, (counts.get(p.license) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([l, n]) => `${n} ${l}`)
    .join(", ");
}

export function LicensesPage() {
  const [state, setState] = useState<State>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}licencias.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ThirdParty[]>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (list) => alive && setState({ list }),
        () =>
          alive &&
          setState({
            error: import.meta.env.DEV
              ? "La lista se crea al construir la app (npm run build): en el modo de desarrollo no está."
              : "No se ha podido cargar la lista. Comprueba la conexión y vuelve a abrir esta página.",
          }),
      );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page title="Licencias de terceros" backTo="/ayuda">
      <p className="text-sm">
        OmniClin usa programas, letras y un modelo de detección de la postura hechos por otros y publicados con licencias libres. Aquí está cada
        uno con su licencia y el texto completo, tal como lo dan sus autores.
      </p>
      <p className="text-sm text-text-muted">Versión de la app: {__APP_VERSION__}</p>
      {state === null && <p className="text-sm text-text-muted">Cargando…</p>}
      {state && "error" in state && (
        <Card>
          <p className="text-sm">{state.error}</p>
        </Card>
      )}
      {state && "list" in state && (
        <>
          <p className="text-sm font-semibold">
            {state.list.length} componentes: {licenseCounts(state.list)}.
          </p>
          <ul className="flex flex-col gap-2">
            {state.list.map((p) => (
              <li key={`${p.name}@${p.version}`}>
                <details className="group rounded-lg border border-border bg-bg">
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-3 py-2">
                    <span className="font-semibold break-all">{p.name}</span>
                    <span className="text-sm text-text-muted">
                      {p.version} · {p.license}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                    {p.author && <p className="text-sm">Autor: {p.author}</p>}
                    {p.homepage && (
                      <p className="text-sm break-all">
                        Web:{" "}
                        <a href={p.homepage} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
                          {p.homepage}
                        </a>
                      </p>
                    )}
                    {p.note && <p className="text-sm text-text-muted">{p.note}</p>}
                    <pre className="rounded-md bg-surface p-3 font-mono text-xs whitespace-pre-wrap break-words">{p.text.trim()}</pre>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
