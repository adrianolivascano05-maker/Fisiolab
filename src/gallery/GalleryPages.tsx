// Biblioteca: la portada (un buscador para tests, cuestionarios y mediciones, y sus estantes) y los tests de
// exploración: por articulación, patologías desplegables y ficha de cada test. Cuestionarios y mediciones, en
// LibraryPages.tsx.
import { Activity, AlertTriangle, BookOpen, ChevronRight, ListChecks, ChevronsDownUp, ChevronsUpDown, Search, Star, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { useQuickMeasure } from "../app/quickMeasure";
import { Button } from "../ui/Button";
import { Group, RowButton, RowLink } from "../ui/Grouped";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { AnimatedFigure } from "./AnimatedFigure";
import { tests } from "./data";
import { Disclosure, useOpenState } from "./Disclosure";
import { likelihoodRatios, lrMeaning, postTest } from "./evidence";
import { regionBySlug, regionOf, regions } from "./regions";
import type { SpecialTest } from "./types";
import { useFavorites } from "./useFavorites";
import { RegisterInPatient } from "../clinical/RegisterInPatient"; // enlace con la ficha clínica
import { QUESTIONNAIRES } from "../clinical/questionnaires";
import { useGranted } from "../data/questionnairePermissions";
import { MEASURES, MEASURES_URL, measureMatches, questionnaireHow, questionnaireMatches, questionnaireUrl, QUESTIONNAIRES_URL } from "./LibraryPages";

export const GALLERY = "/biblioteca";
const testUrl = (t: SpecialTest) => `${GALLERY}/${regionOf(t.region).slug}/${t.id}`;

const utilityLabels: Record<SpecialTest["utility"], string> = {
  alta: "Utilidad alta",
  moderada: "Utilidad moderada",
  baja: "Utilidad baja",
  desconocida: "Sin contrastar",
};

/** Contrastado: con al menos un dato de precisión (sensibilidad, especificidad o LR) publicado y comprobado. */
export const verified = (t: SpecialTest) =>
  t.accuracy.some(
    (a) =>
      a.sens !== undefined ||
      a.spec !== undefined ||
      a.lrPos !== undefined ||
      a.lrNeg !== undefined ||
      // Rangos o valores predictivos publicados, escritos en el contexto (no solo fiabilidad).
      (!a.reliability && /\d+\s*%/.test(a.context ?? "")),
  );
const rank: Record<SpecialTest["utility"], number> = { alta: 0, moderada: 1, baja: 2, desconocida: 3 };
/** Primero los contrastados (de más a menos útiles) y al final los que están sin contrastar. */
export const byEvidence = (a: SpecialTest, b: SpecialTest) => Number(verified(b)) - Number(verified(a)) || rank[a.utility] - rank[b.utility];

const utilityOf = (t: SpecialTest): SpecialTest["utility"] => (verified(t) ? t.utility : "desconocida");

/** La fila de evidencia más completa (sensibilidad, especificidad y razones de verosimilitud). */
function bestRow(t: SpecialTest) {
  const rows = t.accuracy.map((a) => ({ a, lr: likelihoodRatios(a) }));
  const score = (r: (typeof rows)[number]) => [r.a.sens, r.a.spec, r.lr.pos ?? undefined, r.lr.neg ?? undefined].filter((v) => v !== undefined).length;
  return rows.filter((r) => score(r) > 0).sort((x, y) => score(y) - score(x))[0];
}

/** Punto de color + texto: la utilidad sin ocupar media fila. */
function Utility({ t }: { t: SpecialTest }) {
  const u = utilityOf(t);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span
        aria-hidden="true"
        className={cx(
          "size-2 rounded-full",
          u === "alta" && "bg-success",
          u === "moderada" && "bg-highlight",
          u === "baja" && "bg-warning",
          u === "desconocida" && "border border-text-muted",
        )}
      />
      {utilityLabels[u]}
    </span>
  );
}

const kindLabels = { test: "", cluster: "Agrupación", rule: "Regla de decisión" } as const;

function TestRow({ t, showRegion }: { t: SpecialTest; showRegion?: boolean }) {
  return (
    <li>
      <Link to={testUrl(t)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{t.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Utility t={t} />
            {t.kind !== "test" && <span className="text-xs text-text-muted">· {kindLabels[t.kind]}</span>}
            {showRegion && <span className="text-xs text-text-muted">· {regionOf(t.region).label}</span>}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const listBox = "divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg";
/** Al buscar, los primeros tests; el resto con «Ver los N tests», para que se vean también cuestionarios y mediciones. */
const FIRST_TESTS = 10;
/** Título de estante, como el de los grupos (pequeño, en mayúsculas). */
const shelfTitle = "px-1 font-sans text-xs font-semibold tracking-wide text-text-muted uppercase";

/** Inicio: buscador, favoritos y articulaciones. */
export function GalleryHome() {
  const [q, setQ] = useState("");
  const [allTests, setAllTests] = useState(false);
  const { favorites } = useFavorites();
  const granted = useGranted();
  const words = norm(q).split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const found = searching
    ? tests
        .filter((t) => {
          const text = norm([t.name, ...(t.aka ?? []), t.group, t.purpose, regionOf(t.region).label].join(" "));
          return words.every((w) => text.includes(w));
        })
        .sort(byEvidence)
    : [];
  const foundQuestionnaires = searching ? QUESTIONNAIRES.filter((k) => questionnaireMatches(k, q)) : [];
  const foundMeasures = searching ? MEASURES.filter((m) => measureMatches(m, q)) : [];
  const favs = tests.filter((t) => favorites.includes(t.id));
  const quick = useQuickMeasure();

  return (
    <Page title="Biblioteca" tabs>
      <div className="relative">
        <label htmlFor="galeria-buscar" className="sr-only">
          Buscar en la Biblioteca
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted" />
        <input
          id="galeria-buscar"
          type="search"
          placeholder="Buscar tests, cuestionarios o mediciones"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAllTests(false);
          }}
          className="h-12 w-full rounded-xl border border-border-input bg-surface pl-11 pr-3 text-base placeholder:text-text-muted"
        />
      </div>

      {searching ? (
        found.length || foundQuestionnaires.length || foundMeasures.length ? (
          <>
            {found.length > 0 && (
              <section aria-labelledby="h-res-tests" className="flex flex-col gap-2">
                <h2 id="h-res-tests" className={shelfTitle}>
                  Tests de exploración ({found.length})
                </h2>
                <ul aria-label="Resultados" className={listBox}>
                  {(allTests ? found : found.slice(0, FIRST_TESTS)).map((t) => (
                    <TestRow key={t.id} t={t} showRegion />
                  ))}
                </ul>
                {!allTests && found.length > FIRST_TESTS && (
                  <Button variant="secondary" onClick={() => setAllTests(true)}>
                    Ver los {found.length} tests
                  </Button>
                )}
              </section>
            )}
            {foundQuestionnaires.length > 0 && (
              <Group title={`Cuestionarios (${foundQuestionnaires.length})`}>
                {foundQuestionnaires.map((k) => (
                  <RowLink key={k.id} to={questionnaireUrl(k.id)} title={k.name} subtitle={questionnaireHow(k, granted)} />
                ))}
              </Group>
            )}
            {foundMeasures.length > 0 && (
              <Group title={`Mediciones (${foundMeasures.length})`}>
                {foundMeasures.map((m) => (
                  <RowLink key={m.slug} to={MEASURES_URL} icon={m.icon} title={m.title} subtitle={m.what} />
                ))}
              </Group>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-text-muted">Nada coincide con «{q}».</p>
        )
      ) : (
        <>
          {favs.length > 0 && (
            <section aria-labelledby="h-favs" className="flex flex-col gap-2">
              <h2 id="h-favs" className={shelfTitle}>
                Favoritos
              </h2>
              <ul className={listBox}>
                {favs.map((t) => (
                  <TestRow key={t.id} t={t} showRegion />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="h-regiones" className="flex flex-col gap-2">
            <h2 id="h-regiones" className={shelfTitle}>
              Tests de exploración · {tests.length}
            </h2>
            {/* En el ordenador, tres o cuatro por fila. */}
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
              {regions.map((r) => {
                const list = tests.filter((t) => t.region === r.id);
                if (!list.length) return null;
                const groups = new Set(list.map((t) => t.group)).size;
                return (
                  <li key={r.id}>
                    <Link to={`${GALLERY}/${r.slug}`} className="flex h-full min-h-20 flex-col justify-between rounded-xl border border-border bg-bg p-3 hover:border-accent hover:bg-surface">
                      <span className="font-semibold leading-tight">{r.label}</span>
                      <span className="text-xs text-text-muted">
                        {list.length} tests · {groups} {groups === 1 ? "patología" : "patologías"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <Group title="Cuestionarios">
            <RowLink
              to={QUESTIONNAIRES_URL}
              icon={ListChecks}
              title={`Los ${QUESTIONNAIRES.length} cuestionarios`}
              subtitle="Qué mide cada uno, sus preguntas, la puntuación y sus permisos"
            />
          </Group>
          <Group title="Mediciones">
            <RowLink to={MEASURES_URL} icon={Activity} title="Las 6 mediciones" subtitle="Saltos, fuerza, sprint, carrera, movilidad y nórdico: qué es cada una" />
            <RowButton icon={Zap} title="Medir ahora, sin ficha" subtitle="En la ficha «Medición rápida»" busy={quick.busy} onClick={() => void quick.start()} />
          </Group>
          <p className="text-xs text-text-muted">
            Ilustraciones propias. Cifras de revisiones publicadas con su fuente; consúltala antes de citarlas. Ningún test por sí solo hace un
            diagnóstico.
          </p>
        </>
      )}
    </Page>
  );
}

/** Una articulación: sus patologías desplegables. */
export function GalleryRegion() {
  const { region = "" } = useParams();
  const r = regionBySlug(region);
  const [onlyUseful, setOnlyUseful] = useState(false);
  const groups = r ? [...new Set(tests.filter((t) => t.region === r.id).map((t) => t.group))] : [];
  const open = useOpenState(`impulso.exploracion.grupos.${region}`, Object.fromEntries(groups.map((g, i) => [g, i === 0])));
  if (!r) {
    return (
      <Page title="Biblioteca" backTo={GALLERY}>
        <EmptyState icon={BookOpen} title="Esta articulación no existe" />
      </Page>
    );
  }
  const list = tests.filter((t) => t.region === r.id && (!onlyUseful || (t.utility === "alta" && verified(t)))).sort(byEvidence);
  const allOpen = groups.every((g) => open.isOpen(g));
  return (
    <Page title={r.label} backTo={GALLERY}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUseful} onChange={(e) => setOnlyUseful(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
          Solo utilidad alta
        </label>
        <button type="button" onClick={() => open.setAll(groups, !allOpen)} className="tap inline-flex items-center gap-1 rounded-md px-2 text-sm text-accent hover:bg-surface">
          {allOpen ? <ChevronsDownUp aria-hidden="true" className="size-4" /> : <ChevronsUpDown aria-hidden="true" className="size-4" />}
          {allOpen ? "Cerrar todo" : "Abrir todo"}
        </button>
      </div>
      <div className={listBox}>
        {groups.map((g) => {
          const items = list.filter((t) => t.group === g);
          if (!items.length) return null;
          const solid = items.filter(verified);
          const loose = items.filter((t) => !verified(t));
          return (
            <Disclosure key={g} title={g} meta={items.length} open={open.isOpen(g)} onToggle={(o) => open.set(g, o)}>
              <div className="-mx-4 -mb-4 border-t border-border">
                {solid.length > 0 && (
                  <ul aria-label={g} className="divide-y divide-border">
                    {solid.map((t) => (
                      <TestRow key={t.id} t={t} />
                    ))}
                  </ul>
                )}
                {loose.length > 0 && (
                  <>
                    <p className="border-t border-border bg-surface px-4 py-1.5 text-xs font-semibold text-text-muted">Sin contrastar</p>
                    <ul aria-label={`${g}: sin contrastar`} className="divide-y divide-border">
                      {loose.map((t) => (
                        <TestRow key={t.id} t={t} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Disclosure>
          );
        })}
      </div>
      {!list.length && <p className="py-6 text-center text-text-muted">Ningún test de esta articulación tiene utilidad alta comprobada.</p>}
    </Page>
  );
}

const SECTIONS = ["posicion", "como", "positivo", "interpretar", "precauciones", "evidencia", "relacionados"] as const;

/** Ficha de un test: animación, lo esencial a la vista y el resto en desplegables. */
export function GalleryTest() {
  const { region = "", test = "" } = useParams();
  const t = tests.find((x) => x.id === test);
  const { favorites, toggle } = useFavorites();
  const open = useOpenState("impulso.exploracion.secciones", { como: true, positivo: true });
  const back = `${GALLERY}/${region}`;
  if (!t) {
    return (
      <Page title="Biblioteca" backTo={back}>
        <EmptyState icon={BookOpen} title="Este test no existe" />
      </Page>
    );
  }
  const fav = favorites.includes(t.id);
  const related = (t.related ?? []).map((id) => tests.find((x) => x.id === id)).filter((x): x is SpecialTest => !!x);
  const present = SECTIONS.filter((s) => (s === "precauciones" ? !!t.cautions : s === "relacionados" ? related.length > 0 : true));
  const allOpen = present.every((s) => open.isOpen(s));
  const best = bestRow(t);
  const sec = (id: (typeof SECTIONS)[number]) => ({ open: open.isOpen(id), onToggle: (o: boolean) => open.set(id, o) });

  return (
    <Page
      title={t.name}
      backTo={back}
      backLabel={regionBySlug(region)?.label}
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
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {regionOf(t.region).label} · {t.group}
        </p>
        <p className="text-base">{t.purpose}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Utility t={t} />
          {t.kind !== "test" && <span className="text-xs text-text-muted">{kindLabels[t.kind]}</span>}
          {t.aka?.length ? <span className="text-xs text-text-muted">También: {t.aka.join(", ")}</span> : null}
        </div>
      </div>

      {/* En el ordenador, la figura (con sus datos y «Registrar») a la izquierda y el texto a la derecha. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
      {t.figures.map((f, i) => (
        <AnimatedFigure
          key={i}
          spec={f}
          title={`${t.name}${t.figures.length > 1 ? `, imagen ${i + 1}` : ""}`}
          uid={`${t.id}-${i}`}
          texts={{
            setup: f.text?.setup ?? (f.caption ? `${t.position} ${f.caption}` : t.position),
            move: t.steps.slice(t.steps.length > 2 ? 1 : 0).join(" "),
            look: f.text?.look ?? `Positivo si: ${t.positive}`,
            back: f.text?.setup ?? t.position,
          }}
        />
      ))}

      {best && (
        <dl className="nums grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-border bg-border text-center" aria-label={`Datos de ${best.a.source}`}>
          {[
            ["Sens.", best.a.sens === undefined ? "—" : `${fmt(best.a.sens, 0)}%`],
            ["Espec.", best.a.spec === undefined ? "—" : `${fmt(best.a.spec, 0)}%`],
            ["LR+", fmt(best.lr.pos, 1)],
            ["LR−", fmt(best.lr.neg, 2)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col bg-bg px-1 py-2">
              <dt className="text-xs text-text-muted">{k}</dt>
              <dd className="text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <RegisterInPatient testId={t.id} />
      </div>

      <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => open.setAll([...present], !allOpen)} className="tap inline-flex items-center gap-1 rounded-md px-2 text-sm text-accent hover:bg-surface">
          {allOpen ? <ChevronsDownUp aria-hidden="true" className="size-4" /> : <ChevronsUpDown aria-hidden="true" className="size-4" />}
          {allOpen ? "Cerrar todo" : "Abrir todo"}
        </button>
      </div>
      <div className={listBox}>
        <Disclosure title="Posición" {...sec("posicion")}>
          <p>{t.position}</p>
        </Disclosure>
        <Disclosure title={t.kind === "test" ? "Cómo se hace" : "Cómo se aplica"} meta={`${t.steps.length} pasos`} {...sec("como")}>
          <ol className="flex flex-col gap-2">
            {t.steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Disclosure>
        <Disclosure title="Positivo si" {...sec("positivo")}>
          <p>{t.positive}</p>
        </Disclosure>
        <Disclosure title="Cómo interpretarlo" {...sec("interpretar")}>
          <p>{t.interpretation}</p>
        </Disclosure>
        {t.cautions && (
          <Disclosure title="Precauciones" tone="warning" icon={<AlertTriangle aria-hidden="true" className="size-5" />} {...sec("precauciones")}>
            <p className="text-text">{t.cautions}</p>
          </Disclosure>
        )}
        <Disclosure title="Evidencia y fuentes" meta={verified(t) ? `${t.accuracy.length} ${t.accuracy.length === 1 ? "fuente" : "fuentes"}` : "sin contrastar"} {...sec("evidencia")}>
          <Evidence t={t} />
        </Disclosure>
        {related.length > 0 && (
          <Disclosure title="Relacionados" meta={related.length} {...sec("relacionados")}>
            <ul className="-mx-4 -mb-4 divide-y divide-border border-t border-border">
              {related.map((r) => (
                <TestRow key={r.id} t={r} />
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
      </div>
      </div>
    </Page>
  );
}

function Evidence({ t }: { t: SpecialTest }) {
  const [pre, setPre] = useState(30);
  const rows = t.accuracy.map((a) => ({ a, lr: likelihoodRatios(a) }));
  const best = bestRow(t);
  if (!verified(t)) {
    return (
      <p className="text-sm text-text-muted">
        No se han podido comprobar datos publicados de sensibilidad y especificidad. Úsalo como parte de la exploración, no para confirmar ni
        descartar por sí solo.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">Precisión diagnóstica publicada</caption>
          <thead className="text-xs text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-1 font-normal">Fuente</th>
              <th scope="col" className="px-1 py-1 text-right font-normal">Sens.</th>
              <th scope="col" className="px-1 py-1 text-right font-normal">Espec.</th>
              <th scope="col" className="px-1 py-1 text-right font-normal">LR+</th>
              <th scope="col" className="py-1 pl-1 pr-4 text-right font-normal">LR−</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, lr }, i) => (
              <tr key={i} className="border-t border-border align-top">
                <th scope="row" className="px-4 py-2 font-medium">
                  {a.source}
                  {a.context && <span className="block text-xs font-normal text-text-muted">{a.context}</span>}
                  {a.reliability && <span className="block text-xs font-normal text-text-muted">Fiabilidad: {a.reliability}</span>}
                </th>
                <td className="px-1 py-2 text-right">{a.sens === undefined ? "—" : `${fmt(a.sens, 0)}%`}</td>
                <td className="px-1 py-2 text-right">{a.spec === undefined ? "—" : `${fmt(a.spec, 0)}%`}</td>
                <td className="px-1 py-2 text-right">{fmt(lr.pos, 1)}</td>
                <td className="py-2 pl-1 pr-4 text-right">{fmt(lr.neg, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {best && (best.lr.pos !== null || best.lr.neg !== null) && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
          <p className="text-sm font-semibold">Qué cambia el resultado</p>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Tu sospecha antes del test: <span className="nums font-semibold">{pre} %</span>
            </span>
            <input type="range" min={5} max={95} step={5} value={pre} onChange={(e) => setPre(Number(e.target.value))} aria-label="Probabilidad antes del test" className="h-11 accent-[var(--color-accent)]" />
          </label>
          <dl className="nums grid grid-cols-2 gap-2 text-sm">
            {best.lr.pos !== null && (
              <div className="rounded-lg bg-bg p-2">
                <dt className="text-xs text-text-muted">Si es positivo</dt>
                <dd className="text-xl font-semibold">{fmt(postTest(pre, best.lr.pos), 0)} %</dd>
                <dd className="text-xs text-text-muted">{lrMeaning(best.lr.pos, true)}</dd>
              </div>
            )}
            {best.lr.neg !== null && (
              <div className="rounded-lg bg-bg p-2">
                <dt className="text-xs text-text-muted">Si es negativo</dt>
                <dd className="text-xl font-semibold">{fmt(postTest(pre, best.lr.neg), 0)} %</dd>
                <dd className="text-xs text-text-muted">{lrMeaning(best.lr.neg, false)}</dd>
              </div>
            )}
          </dl>
          <p className="text-xs text-text-muted">Con los datos de {best.a.source}.</p>
        </div>
      )}
      <ul className="flex flex-col gap-1 text-xs text-text-muted">
        {[...new Set(t.accuracy.map((a) => `${a.citation}${a.doi ? ` doi:${a.doi}` : ""}`))].map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
