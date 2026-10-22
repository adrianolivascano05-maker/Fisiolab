// El perfil CIF de la anamnesis: los códigos elegidos con su calificador y un buscador rápido (por código o por
// palabras, filtrado por componente, con los sugeridos para la zona y los usados hace poco). Con ellos se redacta el
// diagnóstico fisioterapéutico.
import { NotebookPen, Plus, Search, Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, IconButton } from "../../ui/Button";
import { SelectField, TextField } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import {
  COMPONENTS,
  PERCENT,
  QUALIFIERS,
  makeEntry,
  parseCatalog,
  qualifierLabel,
  readEntry,
  recentCodes,
  rememberCode,
  searchCif,
  suggestedCodes,
  type CifEntry,
  type Coded,
  type Component,
} from "./cif";

/** El catálogo, una sola vez y solo cuando hace falta. */
let catalog: Promise<CifEntry[]> | null = null;
const loadCatalog = () => (catalog ??= import("./cifData").then((m) => parseCatalog(m.CIF_TSV)));

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

const qualifierOption = (k: Component, q: number, facilitator = false) => `${q} · ${qualifierLabel(k, q, { facilitator })}${PERCENT[q] ? ` (${PERCENT[q]})` : ""}`;

export function CifPicker({
  label,
  hint,
  value,
  onChange,
  regions = [],
  onDraft,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  /** Zonas de la anamnesis: para sugerir sus códigos. */
  regions?: string[];
  /** Redactar el diagnóstico con los códigos elegidos. */
  onDraft?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const entries = value.map(readEntry).filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e);
  const set = (i: number, c: Coded) => onChange(value.map((v, j) => (j === i ? makeEntry(c, entries[i]!.title) : v)));
  const add = (e: CifEntry) => {
    if (entries.some((x) => x.coded.code === e.code)) return;
    rememberCode(e.code);
    onChange([...value, makeEntry({ code: e.code, q: 8, capacity: null, facilitator: false }, e.title)]);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-text-muted">{hint}</p>}
      {entries.length > 0 && (
        <ul aria-label="Códigos de la CIF elegidos" className="flex flex-col gap-2">
          {entries.map(({ coded: c, title }, i) => {
            const k = c.code[0] as Component;
            return (
              <li key={c.code} className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p>
                    <span className="nums font-semibold">{c.code}</span> {title}
                  </p>
                  <IconButton label={`Quitar ${c.code}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                    <Trash aria-hidden="true" className="size-5" />
                  </IconButton>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {k === "e" && (
                    <SelectField label={`Barrera o facilitador (${c.code})`} value={c.facilitator ? "+" : "."} onChange={(ev) => set(i, { ...c, facilitator: ev.target.value === "+" })}>
                      <option value=".">Barrera</option>
                      <option value="+">Facilitador</option>
                    </SelectField>
                  )}
                  <SelectField
                    label={k === "d" ? `Desempeño/realización (${c.code})` : `Calificador (${c.code})`}
                    value={c.q === null ? "" : String(c.q)}
                    onChange={(ev) => set(i, { ...c, q: ev.target.value === "" ? null : Number(ev.target.value) })}
                  >
                    {QUALIFIERS.map((q) => (
                      <option key={q} value={q}>
                        {qualifierOption(k, q, c.facilitator)}
                      </option>
                    ))}
                  </SelectField>
                  {k === "d" && (
                    <SelectField label={`Capacidad (${c.code})`} value={c.capacity === null ? "" : String(c.capacity)} onChange={(ev) => set(i, { ...c, capacity: ev.target.value === "" ? null : Number(ev.target.value) })}>
                      <option value="">Sin valorar</option>
                      {QUALIFIERS.map((q) => (
                        <option key={q} value={q}>
                          {qualifierOption("d", q)}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setOpen(true)}>
          Añadir códigos de la CIF
        </Button>
        {onDraft && entries.length > 0 && (
          <Button variant="secondary" icon={<NotebookPen aria-hidden="true" className="size-5" />} onClick={onDraft}>
            Redactar el diagnóstico con la CIF
          </Button>
        )}
      </div>
      <CifSearch open={open} onClose={() => setOpen(false)} chosen={new Set(entries.map((e) => e.coded.code))} onAdd={add} regions={regions} />
    </fieldset>
  );
}

function CifSearch({ open, onClose, chosen, onAdd, regions }: { open: boolean; onClose: () => void; chosen: Set<string>; onAdd: (e: CifEntry) => void; regions: string[] }) {
  const list = useCatalog(open);
  const [query, setQuery] = useState("");
  const [component, setComponent] = useState<Component | null>(null);
  const byCode = useMemo(() => new Map((list ?? []).map((e) => [e.code, e])), [list]);
  const results = useMemo(() => (list ? searchCif(list, query, component) : []), [list, query, component]);
  const quick = (codes: string[]) => codes.map((c) => byCode.get(c)).filter((e): e is CifEntry => !!e && (!component || e.component === component));
  const suggested = quick(suggestedCodes(regions));
  const recent = quick(recentCodes());

  const row = (e: CifEntry) => {
    const has = chosen.has(e.code);
    return (
      <li key={e.code}>
        <button
          type="button"
          disabled={has}
          onClick={() => onAdd(e)}
          className="flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface disabled:opacity-60"
          style={{ paddingLeft: `${0.5 + (e.level - 1) * 0.75}rem` }}
        >
          <span className="nums w-16 shrink-0 font-semibold text-accent">{e.code}</span>
          <span className={e.level === 1 ? "font-semibold" : ""}>
            {e.title}
            {has && <span className="text-text-muted"> · ya está</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Buscar en la CIF">
      <TextField
        label="Código o palabras"
        placeholder="Por ejemplo: dolor espalda, d450, marcha"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      <div role="radiogroup" aria-label="Componente" className="flex flex-wrap gap-2">
        {[{ id: null, short: "Todos" } as { id: Component | null; short: string }, ...COMPONENTS].map((c) => (
          <button
            key={c.id ?? "todos"}
            type="button"
            role="radio"
            aria-checked={component === c.id}
            onClick={() => setComponent(c.id)}
            className={`inline-flex min-h-11 items-center rounded-pill border px-3 text-sm font-semibold ${component === c.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg"}`}
          >
            {c.short}
          </button>
        ))}
      </div>
      {!list ? (
        <p className="text-sm text-text-muted">Cargando la CIF…</p>
      ) : query.trim() ? (
        results.length ? (
          <ul aria-label="Resultados" className="flex max-h-[45dvh] flex-col overflow-y-auto">
            {results.map(row)}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">
            <Search aria-hidden="true" className="inline size-4" /> Nada con «{query.trim()}». Prueba con otra palabra o con el principio del código.
          </p>
        )
      ) : (
        <div className="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto">
          {recent.length > 0 && (
            <section aria-labelledby="cif-recientes">
              <h3 id="cif-recientes" className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Usados hace poco
              </h3>
              <ul>{recent.map(row)}</ul>
            </section>
          )}
          <section aria-labelledby="cif-sugeridos">
            <h3 id="cif-sugeridos" className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
              {regions.length ? "Para la zona de esta anamnesis y habituales" : "Habituales en fisioterapia"}
            </h3>
            <ul>{suggested.map(row)}</ul>
          </section>
        </div>
      )}
      <p className="text-xs text-text-muted">CIF, Organización Mundial de la Salud, 2001. Toca un código para añadirlo; luego elige su calificador.</p>
      <Button block onClick={onClose}>
        Listo
      </Button>
    </Sheet>
  );
}
