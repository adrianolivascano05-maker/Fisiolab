// El perfil CIF de la anamnesis, pensado para redactarlo rápido como lo piensa un fisio: por componente (funciones,
// estructuras, actividades y participación, factores ambientales), acotando poco a poco desde atajos de fisioterapia
// («Dolor», «Movilidad y estabilidad», «Posturas y transferencias»…) o desde los capítulos de la propia CIF hasta la
// categoría concreta, y calificando cada código en la misma hoja con un toque. Arriba de cada componente salen los
// códigos que proponen los datos de la ficha (zona, dolor, cuestionarios y mediciones) con su calificador y el dato
// que lo respalda. Con todo ello se redacta el diagnóstico fisioterapéutico (src/clinical/cif/prose.ts).
import { Check, ChevronLeft, ChevronRight, NotebookPen, Plus, Search, Sparkles, Trash } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Button, IconButton } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { SelectField, TextField } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { COMPONENTS, LOCATION, NATURE, PERCENT, QUALIFIERS, loadCatalog, makeEntry, qualifierLabel, readEntry, recentCodes, rememberCode, searchCif, type CifEntry, type Coded, type Component } from "./cif";
import { GROUPS, ancestorsOf } from "./groups";
import { draftDiagnosis } from "./prose";
import { autoProfile, proposedCodes, proposedCoded, suggestQualifier, type Evidence } from "./suggest";

function useCatalog(on: boolean) {
  const [list, setList] = useState<CifEntry[] | null>(null);
  useEffect(() => {
    if (!on || list) return;
    let live = true;
    void loadCatalog().then((c) => live && setList(c));
    return () => {
      live = false;
    };
  }, [on, list]);
  return list;
}

type Chosen = { coded: Coded; title: string };

// ---------- Calificar con un toque ----------

const WORD: Record<number, [string, string]> = {
  0: ["No hay", "No hay"],
  1: ["Ligera", "Ligero"],
  2: ["Moderada", "Moderado"],
  3: ["Grave", "Grave"],
  4: ["Completa", "Completo"],
  8: ["Sin especificar", "Sin especificar"],
  9: ["No aplicable", "No aplicable"],
};
const chip = (q: number, masculine = false) => `${q} ${WORD[q]![masculine ? 1 : 0]}`;

type Option = { value: string; text: string; word?: string };
const optionClass = cx(
  "flex h-full items-center justify-center rounded-md border px-1 text-center leading-tight",
  "border-border-input bg-bg text-text peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
);

/**
 * Un calificador en un toque: la escala de 0 a 4 en una fila (el número y su palabra) y debajo los que se usan menos
 * («sin especificar», «no aplicable»…). Cabe a lo ancho de un móvil.
 */
function ChipRadio({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  const name = useId();
  const scale = options.filter((o) => o.word);
  const rest = options.filter((o) => !o.word);
  const item = (o: Option, body: ReactNode) => (
    <label key={o.value} className="relative min-h-11">
      <input type="radio" name={name} value={o.value} aria-label={o.text} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
      {body}
    </label>
  );
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold text-text-muted">{label}</legend>
      {scale.length > 0 && (
        <div className="grid grid-cols-5 gap-1">
          {scale.map((o) =>
            item(
              o,
              <span className={cx(optionClass, "flex-col py-1")}>
                <span className="nums text-base font-semibold">{o.value}</span>
                <span className="text-[0.625rem] tracking-tight">{o.word}</span>
              </span>,
            ),
          )}
        </div>
      )}
      {rest.length > 0 && (
        <div className={cx("grid gap-1", rest.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {rest.map((o) => item(o, <span className={cx(optionClass, "py-1 text-xs")}>{o.text}</span>))}
        </div>
      )}
    </fieldset>
  );
}

/** Los calificadores de un código: el primero con un toque; en d, también la capacidad; en s, la naturaleza y el lado. */
function QualifierEditor({ c, onChange: change }: { c: Coded; onChange: (c: Coded) => void }) {
  const k = c.code[0] as Component;
  // Sin el primer calificador no se escriben los demás: pasa a «sin especificar» (8).
  const onChange = (n: Coded) => change(n.q === null && (n.capacity !== null || n.nature != null || n.location != null) ? { ...n, q: 8 } : n);
  const [withCapacity, setWithCapacity] = useState(c.capacity !== null);
  const masculine = k === "e" && c.facilitator;
  const scaleOptions = (male: boolean): Option[] => QUALIFIERS.map((q) => ({ value: String(q), text: chip(q, male), word: q <= 4 ? WORD[q]![male ? 1 : 0] : undefined }));
  const options = scaleOptions(masculine);
  const optional = (n: number | null | undefined) => (n == null || n === 8 ? "" : String(n));
  return (
    <div className="flex flex-col gap-2">
      {k === "e" && (
        <ChipRadio
          label={`Barrera o facilitador (${c.code})`}
          options={[
            { value: ".", text: "Barrera" },
            { value: "+", text: "Facilitador" },
          ]}
          value={c.facilitator ? "+" : "."}
          onChange={(v) => onChange({ ...c, facilitator: v === "+" })}
        />
      )}
      <ChipRadio
        label={k === "d" ? `Desempeño/realización (${c.code})` : `Calificador (${c.code})`}
        options={options}
        value={c.q === null ? "" : String(c.q)}
        onChange={(v) => onChange({ ...c, q: Number(v) })}
      />
      {c.q !== null && c.q <= 4 && (
        <p className="-mt-1 text-xs text-text-muted">
          {qualifierLabel(k, c.q, { facilitator: c.facilitator })} · {PERCENT[c.q]}
          {k === "d" ? " en su entorno habitual" : ""}
        </p>
      )}
      {k === "d" &&
        (withCapacity ? (
          <ChipRadio
            label={`Capacidad (${c.code})`}
            options={[...scaleOptions(false), { value: "", text: "Sin valorar" }]}
            value={c.capacity === null ? "" : String(c.capacity)}
            onChange={(v) => {
              onChange({ ...c, capacity: v === "" ? null : Number(v) });
              if (v === "") setWithCapacity(false);
            }}
          />
        ) : (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => setWithCapacity(true)}>
            Valorar también la capacidad<span className="sr-only"> de {c.code}</span>
          </Button>
        ))}
      {k === "s" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField label={`Naturaleza del cambio (${c.code})`} value={optional(c.nature)} onChange={(e) => onChange({ ...c, nature: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Sin especificar</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 9].map((n) => (
              <option key={n} value={n}>
                {n} · {NATURE[n]}
              </option>
            ))}
          </SelectField>
          <SelectField label={`Localización (${c.code})`} value={optional(c.location)} onChange={(e) => onChange({ ...c, location: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Sin especificar</option>
            {[1, 2, 3, 0, 4, 5, 6, 7, 9].map((n) => (
              <option key={n} value={n}>
                {n} · {LOCATION[n]}
              </option>
            ))}
          </SelectField>
        </div>
      )}
    </div>
  );
}

/** Lo que proponen los datos de la ficha para este código, para volver a ello en un toque. */
function Proposed({ c, evidence, onChange }: { c: Coded; evidence?: Evidence; onChange: (c: Coded) => void }) {
  const sug = evidence ? suggestQualifier(c.code, evidence) : null;
  if (!sug) return null;
  const k = c.code[0] as Component;
  const same = c.q === sug.q;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span className={same ? "text-text-muted" : ""}>
        {same ? "Coincide con lo propuesto" : "Propuesto"}: {qualifierLabel(k, sug.q, { facilitator: c.facilitator })} · {sug.why}
      </span>
      {!same && (
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...c, q: sug.q })}>
          Usar<span className="sr-only"> el propuesto para {c.code}</span>
        </Button>
      )}
    </p>
  );
}

// ---------- El perfil en la anamnesis ----------

export function CifPicker({
  label,
  hint,
  value,
  onChange,
  regions = [],
  onDraft,
  evidence,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  /** Zonas de la anamnesis: para proponer sus códigos. */
  regions?: string[];
  /** Redactar el diagnóstico con los códigos elegidos. */
  onDraft?: () => void;
  /** Lo que hay en la ficha (dolor, cuestionarios, simetría, lado): para proponer códigos y calificadores. */
  evidence?: Evidence;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries: Chosen[] = value.map(readEntry).filter((e): e is Chosen => !!e);
  const ev = evidence ?? (regions.length ? { pain: null, questionnaires: [], symmetry: [], regions } : undefined);
  const set = (c: Coded) =>
    onChange(
      value.map((v) => {
        const e = readEntry(v);
        return e?.coded.code === c.code ? makeEntry(c, e.title) : v;
      }),
    );
  const remove = (code: string) => onChange(value.filter((v) => readEntry(v)?.coded.code !== code));
  const add = (e: CifEntry) => {
    if (entries.some((x) => x.coded.code === e.code)) return;
    rememberCode(e.code);
    onChange([...value, makeEntry(proposedCoded(e.code, ev), e.title)]);
  };
  /** El borrador rápido: los códigos de su zona y de sus datos, con el calificador que proponen. */
  const auto = async () => {
    if (!ev) return;
    setBusy(true);
    try {
      const list = await loadCatalog();
      const titles = new Map(list.map((e) => [e.code, e.title]));
      onChange([...value, ...autoProfile(ev, (c) => titles.get(c), new Set(entries.map((e) => e.coded.code)))]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-text-muted">{hint}</p>}
      {entries.length > 0 && (
        <section aria-label="Códigos de la CIF elegidos" className="flex flex-col gap-3">
          {COMPONENTS.map((comp) => {
            const mine = entries.filter((e) => e.coded.code[0] === comp.id);
            if (!mine.length) return null;
            return (
              <div key={comp.id} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{comp.label}</h3>
                <ul aria-label={comp.label} className="flex flex-col gap-2">
                  {mine.map(({ coded: c, title }) => (
                    <li key={c.code} className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p>
                          <span className="nums font-semibold">{c.code}</span> {title}
                        </p>
                        <IconButton label={`Quitar ${c.code}`} onClick={() => remove(c.code)}>
                          <Trash aria-hidden="true" className="size-5" />
                        </IconButton>
                      </div>
                      <Proposed c={c} evidence={ev} onChange={set} />
                      <QualifierEditor c={c} onChange={set} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {ev && (
          <Button variant="secondary" loading={busy} icon={<Sparkles aria-hidden="true" className="size-5" />} onClick={() => void auto()}>
            Borrador rápido con los datos de la ficha
          </Button>
        )}
        <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setOpen(true)}>
          Añadir códigos de la CIF
        </Button>
        {onDraft && entries.length > 0 && (
          <Button variant="secondary" icon={<NotebookPen aria-hidden="true" className="size-5" />} onClick={onDraft}>
            Redactar el diagnóstico con la CIF
          </Button>
        )}
      </div>
      <CifSheet open={open} onClose={() => setOpen(false)} entries={entries} value={value} onAdd={add} onRemove={remove} onSet={set} evidence={ev} />
    </fieldset>
  );
}

// ---------- La hoja: acotar por componente ----------

/** Dónde se está: un grupo de atajos («g:dolor»), los capítulos («capitulos») o una categoría («b710»). */
type Step = string;

function CifSheet({
  open,
  onClose,
  entries,
  value,
  onAdd,
  onRemove,
  onSet,
  evidence,
}: {
  open: boolean;
  onClose: () => void;
  entries: Chosen[];
  value: string[];
  onAdd: (e: CifEntry) => void;
  onRemove: (code: string) => void;
  onSet: (c: Coded) => void;
  evidence?: Evidence;
}) {
  const list = useCatalog(open);
  const [tab, setTab] = useState<Component>("b");
  const [path, setPath] = useState<Step[]>([]);
  const [query, setQuery] = useState("");
  const byCode = useMemo(() => new Map((list ?? []).map((e) => [e.code, e])), [list]);
  /** Las subcategorías de cada categoría (y las categorías de cada capítulo), una sola vez. */
  const kids = useMemo(() => {
    const m = new Map<string, CifEntry[]>();
    for (const e of list ?? []) {
      if (e.level === 1) continue;
      const parent = e.level === 2 ? e.code.slice(0, 2) : e.code.slice(0, -1);
      m.set(parent, [...(m.get(parent) ?? []), e]);
    }
    return m;
  }, [list]);
  const chosen = new Map(entries.map((e) => [e.coded.code, e]));
  const comp = COMPONENTS.find((c) => c.id === tab)!;
  const pick = (codes: string[]) => codes.map((c) => byCode.get(c)).filter((e): e is CifEntry => !!e && e.component === tab);
  const goTab = (c: Component) => {
    setTab(c);
    setPath([]);
  };
  /** Bajar a una categoría desde la búsqueda: con su camino desde el capítulo, para saber dónde se está. */
  const reveal = (code: string) => {
    setQuery("");
    setPath(["capitulos", ...ancestorsOf(code), code]);
  };
  const stepLabel = (s: Step) => (s === "capitulos" ? "Capítulos" : s.startsWith("g:") ? (GROUPS[tab].find((g) => `g:${g.id}` === s)?.label ?? s) : s);

  const row = (e: CifEntry, sub?: string, drill: (code: string) => void = (code) => setPath([...path, code])) => {
    const has = chosen.get(e.code);
    const n = kids.get(e.code)?.length ?? 0;
    const chapter = e.level === 1;
    return (
      <li key={e.code} className="flex flex-col">
        <div className="flex items-stretch gap-1">
          {chapter ? (
            <button type="button" onClick={() => drill(e.code)} className="flex min-h-11 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left font-semibold hover:bg-surface">
              <span className="nums w-16 shrink-0 text-accent">{e.code}</span>
              <span className="flex-1">{e.title}</span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
            </button>
          ) : (
            <button
              type="button"
              aria-pressed={!!has}
              onClick={() => (has ? onRemove(e.code) : onAdd(e))}
              className="flex min-h-11 flex-1 items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface"
            >
              <span aria-hidden="true" className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border", has ? "border-accent bg-accent text-on-accent" : "border-border-input")}>
                {has && <Check className="size-4" />}
              </span>
              <span className="flex flex-col">
                <span>
                  <span className="nums font-semibold text-accent">{e.code}</span> {e.title}
                </span>
                {sub && <span className="text-sm text-text-muted">{sub}</span>}
              </span>
            </button>
          )}
          {!chapter && n > 0 && (
            <IconButton label={`Acotar ${e.code}: ${n === 1 ? "1 más concreta" : `${n} más concretas`}`} onClick={() => drill(e.code)}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </IconButton>
          )}
        </div>
        {has && (
          <div className="mb-2 ml-9 flex flex-col gap-2 rounded-md bg-surface p-2">
            <QualifierEditor c={has.coded} onChange={onSet} />
          </div>
        )}
      </li>
    );
  };

  const section = (title: string, rows: ReactNode[], id: string) =>
    rows.length > 0 && (
      <section aria-labelledby={id}>
        <h3 id={id} className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
          {title}
        </h3>
        <ul>{rows}</ul>
      </section>
    );

  const body = () => {
    if (!list) return <p className="text-sm text-text-muted">Cargando la CIF…</p>;
    if (query.trim()) {
      const results = searchCif(list, query, tab);
      const elsewhere = COMPONENTS.filter((c) => c.id !== tab)
        .map((c) => ({ c, n: searchCif(list, query, c.id, 999).length }))
        .filter((x) => x.n > 0);
      return (
        <>
          {results.length ? (
            <ul aria-label="Resultados">{results.map((e) => row(e, undefined, reveal))}</ul>
          ) : (
            <p className="px-2 text-sm text-text-muted">
              <Search aria-hidden="true" className="inline size-4" /> Nada en {comp.label.toLowerCase()} con «{query.trim()}».
            </p>
          )}
          {elsewhere.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 px-2 text-sm">
              <span className="text-text-muted">También en:</span>
              {elsewhere.map(({ c, n }) => (
                <Button key={c.id} size="sm" variant="ghost" onClick={() => goTab(c.id)}>
                  {c.label} ({n})
                </Button>
              ))}
            </p>
          )}
        </>
      );
    }
    const at = path.at(-1);
    if (!at) {
      const proposals = evidence ? pick(proposedCodes(evidence)) : [];
      const recent = pick(recentCodes()).slice(0, 8);
      return (
        <>
          {section(
            "Con los datos de la ficha",
            proposals.map((e) => {
              const s = suggestQualifier(e.code, evidence!);
              return row(e, s ? `Propuesto: ${qualifierLabel(tab, s.q).toLowerCase()} · ${s.why}` : "De la zona de la anamnesis");
            }),
            "cif-propuestos",
          )}
          {section("Usados hace poco", recent.map((e) => row(e)), "cif-recientes")}
          <section aria-labelledby="cif-atajos">
            <h3 id="cif-atajos" className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
              Atajos de fisioterapia
            </h3>
            <ul>
              {GROUPS[tab].map((g) => {
                const n = g.codes.filter((c) => chosen.has(c)).length;
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => setPath([`g:${g.id}`])} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface">
                      <span className="flex-1 font-semibold">{g.label}</span>
                      {n > 0 && <span className="text-sm text-text-muted">{n} elegido{n === 1 ? "" : "s"}</span>}
                      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => setPath(["capitulos"])} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface">
                  <span className="flex-1">Todos los capítulos de la CIF</span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
                </button>
              </li>
            </ul>
          </section>
        </>
      );
    }
    if (at === "capitulos") return <ul aria-label="Capítulos">{list.filter((e) => e.component === tab && e.level === 1).map((e) => row(e))}</ul>;
    if (at.startsWith("g:")) {
      const g = GROUPS[tab].find((x) => `g:${x.id}` === at);
      return <ul aria-label={g?.label ?? ""}>{pick(g?.codes ?? []).map((e) => row(e))}</ul>;
    }
    const self = byCode.get(at);
    const children = kids.get(at) ?? [];
    return (
      <>
        {self && self.level > 1 && <ul aria-label="Esta categoría">{row(self)}</ul>}
        {section(self && self.level > 1 ? "Más concreto" : (self?.title ?? ""), children.map((e) => row(e)), "cif-hijos")}
      </>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Añadir códigos de la CIF">
      <div role="radiogroup" aria-label="Componente" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COMPONENTS.map((c) => {
          const n = entries.filter((e) => e.coded.code[0] === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={tab === c.id}
              onClick={() => goTab(c.id)}
              className={cx(
                "inline-flex min-h-11 items-center justify-center rounded-md border px-2 text-center text-sm leading-tight font-semibold",
                tab === c.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
              )}
            >
              {c.label}
              {n > 0 ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>
      <TextField
        label={`Buscar en ${comp.label.toLowerCase()}`}
        placeholder="Ej.: dolor espalda, d450"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {!query.trim() && path.length > 0 && (
        <nav aria-label="Dónde estás" className="flex items-center gap-1 text-sm">
          <Button size="sm" variant="ghost" icon={<ChevronLeft aria-hidden="true" className="size-4" />} onClick={() => setPath(path.slice(0, -1))}>
            Atrás
          </Button>
          <span className="min-w-0 flex-1 truncate font-semibold" title={path.map(stepLabel).join(" › ")}>
            {path.map(stepLabel).join(" › ")}
          </span>
        </nav>
      )}
      <div className="flex max-h-[50dvh] flex-col gap-3 overflow-y-auto">{body()}</div>
      {value.length > 0 && (
        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Cómo queda redactado</summary>
          <p className="mt-2 whitespace-pre-line">{draftDiagnosis(value, { evidence })}</p>
        </details>
      )}
      <p className="text-xs text-text-muted">CIF, Organización Mundial de la Salud, 2001. Toca un código para elegirlo y ponle aquí mismo su calificador; la flecha baja a lo más concreto.</p>
      <Button block onClick={onClose}>
        Listo
      </Button>
    </Sheet>
  );
}
