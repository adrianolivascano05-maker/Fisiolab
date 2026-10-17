// Galería de tests diferenciales: inicio por articulación, lista por patología y ficha de cada test.
import { BookOpen, ChevronRight, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { tests } from "./data";
import { likelihoodRatios, lrMeaning, postTest } from "./evidence";
import { renderFigure, type FigureSpec } from "./figure";
import { regionBySlug, regionOf, regions } from "./regions";
import type { SpecialTest } from "./types";
import { useFavorites } from "./useFavorites";

export const GALLERY = "/exploracion";
const testUrl = (t: SpecialTest) => `${GALLERY}/${regionOf(t.region).slug}/${t.id}`;

const utilityLabels: Record<SpecialTest["utility"], string> = {
  alta: "Utilidad alta",
  moderada: "Utilidad moderada",
  baja: "Utilidad baja",
  desconocida: "Sin contrastar",
};

/** Contrastado: con al menos un dato de precisión (sensibilidad, especificidad o LR) publicado y comprobado. */
export const verified = (t: SpecialTest) =>
  t.accuracy.some((a) => a.sens !== undefined || a.spec !== undefined || a.lrPos !== undefined || a.lrNeg !== undefined);
const rank: Record<SpecialTest["utility"], number> = { alta: 0, moderada: 1, baja: 2, desconocida: 3 };
/** Primero los contrastados (de más a menos útiles) y al final los que están sin contrastar. */
export const byEvidence = (a: SpecialTest, b: SpecialTest) => Number(verified(b)) - Number(verified(a)) || rank[a.utility] - rank[b.utility];

function UtilityBadge({ u, t }: { u: SpecialTest["utility"]; t?: SpecialTest }) {
  if (t && !verified(t)) u = "desconocida";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 text-xs font-semibold",
        u === "alta" && "bg-success-soft text-success",
        u === "moderada" && "bg-accent-soft text-accent",
        u === "baja" && "bg-warning-soft text-warning",
        u === "desconocida" && "border border-border text-text-muted",
      )}
    >
      {utilityLabels[u]}
    </span>
  );
}

const kindLabels = { test: "", cluster: "Agrupación de tests", rule: "Regla de decisión" } as const;

function TestRow({ t, showRegion }: { t: SpecialTest; showRegion?: boolean }) {
  return (
    <li>
      <Link to={testUrl(t)} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{t.name}</span>
          <span className="text-sm text-text-muted">
            {showRegion ? `${regionOf(t.region).label} · ${t.group}` : t.purpose}
          </span>
          <span className="flex flex-wrap gap-1">
            <UtilityBadge u={t.utility} t={t} />
            {t.kind !== "test" && <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold">{kindLabels[t.kind]}</span>}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Inicio: buscador, favoritos y articulaciones. */
export function GalleryHome() {
  const [q, setQ] = useState("");
  const { favorites } = useFavorites();
  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return tests.filter((t) => {
      const text = norm([t.name, ...(t.aka ?? []), t.group, t.purpose, regionOf(t.region).label].join(" "));
      return words.every((w) => text.includes(w));
    }).sort(byEvidence);
  }, [q]);
  const favs = tests.filter((t) => favorites.includes(t.id));

  return (
    <Page title="Exploración" tabs>
      <p className="text-text-muted">
        {tests.length} tests de exploración, agrupados por articulación y por patología, con cómo hacerlos, qué significa un positivo y cuánto aportan.
      </p>
      <div className="relative">
        <label htmlFor="galeria-buscar" className="sr-only">
          Buscar un test
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" />
        <input
          id="galeria-buscar"
          type="search"
          placeholder="Test, patología o articulación"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 w-full rounded-md border border-border-input bg-bg pl-10 pr-3 text-base placeholder:text-text-muted"
        />
      </div>

      {found ? (
        found.length ? (
          <ul aria-label="Resultados" className="divide-y divide-border rounded-lg border border-border bg-bg">
            {found.map((t) => (
              <TestRow key={t.id} t={t} showRegion />
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-text-muted">Ningún test coincide con «{q}».</p>
        )
      ) : (
        <>
          {favs.length > 0 && (
            <section aria-labelledby="h-favs" className="flex flex-col gap-2">
              <h2 id="h-favs" className="text-lg">
                Favoritos
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
                {favs.map((t) => (
                  <TestRow key={t.id} t={t} showRegion />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="h-regiones" className="flex flex-col gap-2">
            <h2 id="h-regiones" className="text-lg">
              Por articulación
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
              {regions.map((r) => {
                const list = tests.filter((t) => t.region === r.id);
                if (!list.length) return null;
                const groups = new Set(list.map((t) => t.group)).size;
                return (
                  <li key={r.id}>
                    <Link to={`${GALLERY}/${r.slug}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface">
                      <span className="flex flex-1 flex-col">
                        <span className="font-semibold">{r.label}</span>
                        <span className="text-sm text-text-muted">
                          {list.length} tests · {groups} {groups === 1 ? "patología" : "patologías"}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-5 text-text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className="text-xs text-text-muted">
            Las ilustraciones son esquemas propios. Los datos de sensibilidad y especificidad se tomaron de revisiones publicadas y
            se indica la fuente de cada uno; consúltala antes de citarlos. Ningún test por sí solo hace un diagnóstico.
          </p>
        </>
      )}
    </Page>
  );
}

/** Una articulación: sus patologías y los tests de cada una. */
export function GalleryRegion() {
  const { region = "" } = useParams();
  const r = regionBySlug(region);
  const [onlyUseful, setOnlyUseful] = useState(false);
  if (!r) {
    return (
      <Page title="Exploración" backTo={GALLERY}>
        <EmptyState icon={BookOpen} title="Esta articulación no existe" />
      </Page>
    );
  }
  const list = tests.filter((t) => t.region === r.id && (!onlyUseful || (t.utility === "alta" && verified(t)))).sort(byEvidence);
  const groups = [...new Set(tests.filter((t) => t.region === r.id).map((t) => t.group))];
  return (
    <Page title={r.label} backTo={GALLERY}>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyUseful} onChange={(e) => setOnlyUseful(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
        Solo los de utilidad alta
      </label>
      {groups.length > 1 && (
        <nav aria-label="Patologías" className="flex flex-wrap gap-2">
          {groups.map((g, i) => (
            <a key={g} href={`#g-${i}`} className="rounded-pill border border-border px-3 py-1 text-sm hover:bg-surface">
              {g}
            </a>
          ))}
        </nav>
      )}
      {groups.map((g, i) => {
        const items = list.filter((t) => t.group === g);
        if (!items.length) return null;
        const solid = items.filter(verified);
        const loose = items.filter((t) => !verified(t));
        return (
          <section key={g} aria-labelledby={`g-${i}`} className="flex scroll-mt-20 flex-col gap-2">
            <h2 id={`g-${i}`} className="scroll-mt-20 text-lg">
              {g}
            </h2>
            {solid.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
                {solid.map((t) => (
                  <TestRow key={t.id} t={t} />
                ))}
              </ul>
            )}
            {loose.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-text-muted">Sin contrastar: sin datos de precisión comprobados</h3>
                <ul aria-label={`${g}: sin contrastar`} className="divide-y divide-border rounded-lg border border-dashed border-border-input bg-bg">
                  {loose.map((t) => (
                    <TestRow key={t.id} t={t} />
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
      {!list.length && <p className="py-6 text-center text-text-muted">Ningún test de esta articulación tiene utilidad alta comprobada.</p>}
    </Page>
  );
}

export function Figure({ spec, title, uid }: { spec: FigureSpec; title: string; uid: string }) {
  const svg = useMemo(() => renderFigure(spec, title, uid), [spec, title, uid]);
  return (
    <figure className="flex flex-col gap-1">
      <div
        className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-bg [&>svg]:h-full [&>svg]:w-full"
        style={
          {
            "--fig-force": "var(--color-accent)",
            "--fig-pain": "var(--color-danger)",
            "--fig-text": "var(--color-text)",
            "--fig-bg": "var(--color-bg)",
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {spec.caption && <figcaption className="text-sm text-text-muted">{spec.caption}</figcaption>}
    </figure>
  );
}

/** Ficha de un test. */
export function GalleryTest() {
  const { region = "", test = "" } = useParams();
  const t = tests.find((x) => x.id === test);
  const { favorites, toggle } = useFavorites();
  const back = `${GALLERY}/${region}`;
  if (!t) {
    return (
      <Page title="Exploración" backTo={back}>
        <EmptyState icon={BookOpen} title="Este test no existe" />
      </Page>
    );
  }
  const fav = favorites.includes(t.id);
  const related = (t.related ?? []).map((id) => tests.find((x) => x.id === id)).filter((x): x is SpecialTest => !!x);
  return (
    <Page
      title={t.name}
      backTo={back}
      action={
        <button
          type="button"
          onClick={() => toggle(t.id)}
          aria-pressed={fav}
          aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className="tap inline-flex items-center justify-center rounded-md hover:bg-surface"
        >
          <Star aria-hidden="true" className={cx("size-6", fav && "fill-current text-accent")} />
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-text-muted">
          {regionOf(t.region).label} · {t.group}
        </p>
        {t.aka?.length ? <p className="text-sm text-text-muted">También: {t.aka.join(", ")}</p> : null}
        <div className="flex flex-wrap gap-1">
          <UtilityBadge u={t.utility} t={t} />
          {t.kind !== "test" && <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold">{kindLabels[t.kind]}</span>}
        </div>
      </div>
      <p>{t.purpose}</p>
      {t.figures.map((f, i) => (
        <Figure key={i} spec={f} title={`${t.name}${t.figures.length > 1 ? `, imagen ${i + 1}` : ""}`} uid={`${t.id}-${i}`} />
      ))}
      <p className="text-xs text-text-muted">Manos del examinador en naranja; flechas: fuerza (continua) o movimiento (discontinua); círculo rojo: dónde aparece el síntoma.</p>

      <Section title="Posición">
        <p>{t.position}</p>
      </Section>
      <Section title={t.kind === "test" ? "Cómo se hace" : "Cómo se aplica"}>
        <ol className="list-decimal space-y-1 pl-5">
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>
      <Section title="Positivo si">
        <p>{t.positive}</p>
      </Section>
      <Section title="Cómo interpretarlo">
        <p>{t.interpretation}</p>
      </Section>
      {t.cautions && (
        <Alert tone="warning" title="Precauciones">
          {t.cautions}
        </Alert>
      )}
      <Evidence t={t} />
      {related.length > 0 && (
        <Section title="Relacionados">
          <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
            {related.map((r) => (
              <TestRow key={r.id} t={r} />
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Evidence({ t }: { t: SpecialTest }) {
  const [pre, setPre] = useState(30);
  const rows = t.accuracy.map((a) => ({ a, lr: likelihoodRatios(a) }));
  const best = rows.find((r) => r.lr.pos !== null || r.lr.neg !== null);
  if (!rows.length) {
    return (
      <Section title="Evidencia">
        <Alert tone="info" title="Sin contrastar">
          No se han podido comprobar datos publicados de sensibilidad y especificidad de este test. Úsalo como parte de la exploración, no
          para confirmar ni descartar por sí solo.
        </Alert>
      </Section>
    );
  }
  return (
    <Section title="Evidencia">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">Precisión diagnóstica publicada</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-2 py-2">Fuente</th>
              <th scope="col" className="px-2 py-2 text-right">Sens.</th>
              <th scope="col" className="px-2 py-2 text-right">Espec.</th>
              <th scope="col" className="px-2 py-2 text-right">LR+</th>
              <th scope="col" className="px-2 py-2 text-right">LR−</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, lr }, i) => (
              <tr key={i} className="border-t border-border align-top">
                <th scope="row" className="px-2 py-2 font-normal">
                  {a.source}
                  {a.context && <span className="block text-xs text-text-muted">{a.context}</span>}
                  {a.reliability && <span className="block text-xs text-text-muted">Fiabilidad: {a.reliability}</span>}
                </th>
                <td className="px-2 py-2 text-right">{a.sens === undefined ? "—" : `${fmt(a.sens, 0)} %`}</td>
                <td className="px-2 py-2 text-right">{a.spec === undefined ? "—" : `${fmt(a.spec, 0)} %`}</td>
                <td className="px-2 py-2 text-right">{fmt(lr.pos, 2)}</td>
                <td className="px-2 py-2 text-right">{fmt(lr.neg, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Referencias</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-text-muted">
          {[...new Set(t.accuracy.map((a) => `${a.citation}${a.doi ? ` doi:${a.doi}` : ""}`))].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>
      {best && (
        <Card className="flex flex-col gap-2">
          <h3 className="font-semibold">Qué cambia el resultado</h3>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Probabilidad antes del test (tu sospecha): <span className="nums font-semibold">{pre} %</span>
            </span>
            <input type="range" min={5} max={95} step={5} value={pre} onChange={(e) => setPre(Number(e.target.value))} className="accent-[var(--color-accent)]" />
          </label>
          <dl className="nums grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {best.lr.pos !== null && (
              <>
                <dt className="font-semibold">Si es positivo</dt>
                <dd>
                  {fmt(postTest(pre, best.lr.pos), 0)} % · {lrMeaning(best.lr.pos, true)}
                </dd>
              </>
            )}
            {best.lr.neg !== null && (
              <>
                <dt className="font-semibold">Si es negativo</dt>
                <dd>
                  {fmt(postTest(pre, best.lr.neg), 0)} % · {lrMeaning(best.lr.neg, false)}
                </dd>
              </>
            )}
          </dl>
          <p className="text-xs text-text-muted">Con los datos de {best.a.source}. La sospecha previa la pones tú según la historia y el resto de la exploración.</p>
        </Card>
      )}
    </Section>
  );
}
