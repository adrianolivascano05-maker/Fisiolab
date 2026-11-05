// Ajustes › Cuestionarios propios › un cuestionario (docs/cuestionarios-propios.md): el editor. Nombre,
// instrucciones, nota para el profesional, apartados y preguntas (Escala · Opciones con puntos · Sí/No · Número), la
// nota (sin nota, suma, media o % del máximo; nunca umbrales) y «Así lo verá». Se guarda con «Guardar»: cada guardado
// es una versión con su huella. Lo que se está escribiendo se queda como borrador en este móvil y, al salir sin
// guardar, se avisa.
import { ArrowDown, ArrowUp, Eye, Plus, Trash, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { FormFill } from "../clinical/FormFill";
import { buildForm, checkOwnForm, copyrightName, countedItems, ownLabelFor, type OwnFormSpec, type OwnItem, type OwnItemType, type OwnScoring } from "../clinical/forms/own";
import type { Answers } from "../clinical/forms/types";
import { Chips, TextArea } from "../clinical/parts";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { getOwnForm, getOwnNotice, markOwnNotice, newItemId, newOwnFormId, saveOwnForm } from "../data/ownForms";
import { getClinic } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { OWN_FORMS_URL } from "./OwnFormsPage";

type Draft = Omit<OwnFormSpec, "hash">;

const TYPES: { id: OwnItemType; label: string }[] = [
  { id: "scale", label: "Escala" },
  { id: "options", label: "Opciones con puntos" },
  { id: "yesno", label: "Sí/No" },
  { id: "number", label: "Número" },
];
const PRESETS: { label: string; options: { label: string; points: number }[] }[] = [
  { label: "Nunca 0 · A veces 1 · A menudo 2 · Siempre 3", options: [{ label: "Nunca", points: 0 }, { label: "A veces", points: 1 }, { label: "A menudo", points: 2 }, { label: "Siempre", points: 3 }] },
  { label: "Nada 0 … Mucho 4", options: [{ label: "Nada", points: 0 }, { label: "Poco", points: 1 }, { label: "Algo", points: 2 }, { label: "Bastante", points: 3 }, { label: "Mucho", points: 4 }] },
  { label: "Sí 1 / No 0", options: [{ label: "Sí", points: 1 }, { label: "No", points: 0 }] },
];
const METHODS: { id: "none" | OwnScoring["method"]; label: string }[] = [
  { id: "none", label: "Sin nota" },
  { id: "sum", label: "Suma" },
  { id: "mean", label: "Media" },
  { id: "percent", label: "% del máximo" },
];

const blank = (): Draft => ({ v: 1, id: newOwnFormId(), name: "", sections: [{ items: [] }], scoring: { method: "sum", better: "higher", na: "block" } });
const newItem = (type: OwnItemType, text = ""): OwnItem => {
  const base = { id: newItemId(), text };
  switch (type) {
    case "scale":
      return { ...base, type, from: 0, to: 10, ends: ["", ""] };
    case "options":
      return { ...base, type, options: [] };
    case "yesno":
      return { ...base, type, yes: 1, no: 0 };
    case "number":
      return { ...base, type, unit: "", min: 0, max: 100 };
  }
};
/** Cambia el tipo de una pregunta conservando su id y su texto (en el editor, antes de guardar). */
const retype = (it: OwnItem, type: OwnItemType): OwnItem => (it.type === type ? it : { ...newItem(type, it.text), id: it.id, ...(it.na ? { na: true } : {}) });
const draftKey = (id: string) => `omniclin.cuestionario.${id}`;
const readDraft = (id: string): Draft | null => {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};
const writeDraft = (id: string, d: Draft | null) => {
  try {
    if (d) localStorage.setItem(draftKey(id), JSON.stringify(d));
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Un número que se escribe (con coma o punto); se guarda al ser válido. */
function NumInput({ label, value, onChange, className }: { label: string; value: number; onChange: (n: number) => void; className?: string }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => {
    if (Number(text.replace(",", ".")) !== value) setText(String(value).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el valor de fuera
  }, [value]);
  return (
    <TextField
      label={label}
      inputMode="decimal"
      className={className}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (e.target.value.trim() && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Pick<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", value === o.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-surface")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Una pregunta: su texto, su tipo y lo de su tipo. */
function ItemEditor({ item, n, first, last, onChange, onMove, onRemove }: { item: OwnItem; n: number; first: boolean; last: boolean; onChange: (it: OwnItem) => void; onMove: (by: -1 | 1) => void; onRemove: () => void }) {
  const set = (patch: Partial<OwnItem>) => onChange({ ...item, ...patch } as OwnItem);
  let body: ReactNode = null;
  if (item.type === "scale") {
    body = (
      <>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="De" value={item.from} onChange={(from) => set({ from })} />
          <NumInput label="A" value={item.to} onChange={(to) => set({ to })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={`Texto del ${item.from}`} placeholder="Por ejemplo: Nada" maxLength={60} value={item.ends?.[0] ?? ""} onChange={(e) => set({ ends: [e.target.value, item.ends?.[1] ?? ""] })} />
          <TextField label={`Texto del ${item.to}`} placeholder="Por ejemplo: Muchísimo" maxLength={60} value={item.ends?.[1] ?? ""} onChange={(e) => set({ ends: [item.ends?.[0] ?? "", e.target.value] })} />
        </div>
      </>
    );
  } else if (item.type === "options") {
    body = (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Opciones y sus puntos</legend>
        {!item.options.length && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => set({ options: p.options })} className="min-h-11 rounded-pill border border-border-input bg-bg px-3 text-sm hover:bg-surface">
                {p.label}
              </button>
            ))}
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {item.options.map((o, i) => (
            <li key={i} className="flex items-end gap-2">
              <TextField label={`Opción ${i + 1}`} className="min-w-0 flex-1" maxLength={120} value={o.label} onChange={(e) => set({ options: item.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <NumInput label="Puntos" className="w-24" value={o.points} onChange={(points) => set({ options: item.options.map((x, j) => (j === i ? { ...x, points } : x)) })} />
              <button type="button" aria-label={`Quitar la opción ${i + 1}`} onClick={() => set({ options: item.options.filter((_, j) => j !== i) })} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface">
                <X aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => set({ options: [...item.options, { label: "", points: item.options.length }] })}>
          Otra opción
        </Button>
        <p className="text-sm text-text-muted">Los puntos van en cada opción: para una pregunta al revés, pon «4 … 0».</p>
      </fieldset>
    );
  } else if (item.type === "yesno") {
    body = (
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Puntos de «Sí»" value={item.yes} onChange={(yes) => set({ yes })} />
        <NumInput label="Puntos de «No»" value={item.no} onChange={(no) => set({ no })} />
      </div>
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Unidad" placeholder="min" maxLength={20} value={item.unit} onChange={(e) => set({ unit: e.target.value })} />
          <NumInput label="Mínimo" value={item.min} onChange={(min) => set({ min })} />
          <NumInput label="Máximo" value={item.max} onChange={(max) => set({ max })} />
        </div>
        <Toggle label="Cuenta en la nota" on={!!item.counts} onChange={(counts) => set({ counts: counts || undefined })} />
      </>
    );
  }
  return (
    <Card role="group" aria-label={`Editar la pregunta ${n}`} className="flex flex-col gap-3">
      <TextArea label={`Pregunta ${n}`} value={item.text} rows={2} maxLength={300} onChange={(text) => set({ text })} />
      <Pick label="Tipo" options={TYPES} value={item.type} onChange={(t) => onChange(retype(item, t))} />
      {body}
      <Toggle label="Se puede marcar «No aplica»" hint="Cuenta como sin responder." on={!!item.na} onChange={(na) => set({ na: na || undefined })} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={first} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => onMove(-1)}>
          Subir
        </Button>
        <Button variant="secondary" size="sm" disabled={last} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => onMove(1)}>
          Bajar
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={onRemove}>
          Quitar la pregunta {n}
        </Button>
      </div>
    </Card>
  );
}

export function OwnFormEditorPage() {
  const { id: rawId = "nuevo" } = useParams();
  const isNew = rawId === "nuevo";
  const cloud = useCloud();
  const canEdit = !cloud?.clinic || cloud.clinic.role === "admin";
  const loaded = useAsync(async () => {
    const db = getDb();
    const [doc, notice, clinic] = await Promise.all([isNew ? null : getOwnForm(db, rawId), getOwnNotice(db), getClinic(db)]);
    return { doc, notice, clinicName: clinic.name || cloud?.clinic?.name || "" };
  }, [rawId]);
  if (!canEdit) {
    return (
      <Page title="Cuestionario propio" backTo={OWN_FORMS_URL}>
        <Alert tone="info" title="Los crea y los cambia quien administra la clínica." />
      </Page>
    );
  }
  if (!loaded.data) return <Page title="Cuestionario propio" backTo={OWN_FORMS_URL}>{loaded.error ? <Alert tone="danger" title={loaded.error.message} /> : <p className="text-text-muted">Cargando…</p>}</Page>;
  if (!isNew && !loaded.data.doc) return <Page title="Cuestionario propio" backTo={OWN_FORMS_URL}><Alert tone="danger" title="Este cuestionario no existe." /></Page>;
  // Lo guardado, o el borrador que se quedó en este móvil.
  const saved: Draft | null = loaded.data.doc ? (({ hash: _h, ...rest }) => (void _h, rest))(loaded.data.doc.spec) : null;
  const local = readDraft(isNew ? "nuevo" : saved!.id);
  const useLocal = !!local && !same(local, saved) && (isNew || local.id === saved!.id);
  return (
    <Editor
      key={rawId}
      isNew={isNew}
      saved={saved}
      initial={useLocal ? local! : (saved ?? blank())}
      fromDraft={useLocal}
      notice={!!loaded.data.notice}
      clinicName={loaded.data.clinicName}
    />
  );
}

function Editor({ isNew, saved, initial, fromDraft: startedFromDraft, notice, clinicName }: { isNew: boolean; saved: Draft | null; initial: Draft; fromDraft: boolean; notice: boolean; clinicName: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(initial);
  const [fromDraft, setFromDraft] = useState(startedFromDraft);
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false);

  const dirty = isNew ? !!(draft.name.trim() || draft.sections.some((s) => s.items.length)) : !same(draft, saved);
  // El borrador, en este móvil, mientras haya cambios.
  useEffect(() => {
    writeDraft(isNew ? "nuevo" : draft.id, dirty ? draft : null);
  }, [draft, dirty, isNew]);

  const blocker = useBlocker(() => dirty && !leaving.current);
  const counted = useMemo(() => countedItems(draft), [draft]);
  const form = useMemo(() => (preview ? buildForm(draft as OwnFormSpec) : null), [draft, preview]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setSection = (si: number, patch: Partial<Draft["sections"][number]>) => set({ sections: draft.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, it: OwnItem) => setSection(si, { items: draft.sections[si]!.items.map((x, j) => (j === ii ? it : x)) });
  const moveItem = (si: number, ii: number, by: -1 | 1) => {
    const items = [...draft.sections[si]!.items];
    const j = ii + by;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j]!, items[ii]!];
    setSection(si, { items });
  };
  const removeItem = (si: number, ii: number) => {
    const gone = draft.sections[si]!.items[ii]!.id;
    const sections = draft.sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s));
    // Fuera también de las subescalas.
    const scoring = draft.scoring ? { ...draft.scoring, subscales: draft.scoring.subscales?.map((sub) => ({ ...sub, items: sub.items.filter((x) => x !== gone) })) } : null;
    set({ sections, scoring });
  };
  const method = draft.scoring?.method ?? "none";
  const setScoring = (patch: Partial<OwnScoring>) => set({ scoring: { ...(draft.scoring ?? { method: "sum", better: "higher", na: "block" }), ...patch } });
  const copyright = copyrightName(draft.name);
  // La numeración de las preguntas sigue de un apartado al siguiente.
  const starts = draft.sections.map((_, i) => draft.sections.slice(0, i).reduce((acc, x) => acc + x.items.length, 0));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      checkOwnForm(draft as OwnFormSpec);
      const db = getDb();
      await saveOwnForm(db, draft as OwnFormSpec, memberEmail(), { clinic: clinicName });
      await markOwnNotice(db, memberEmail());
      writeDraft(isNew ? "nuevo" : draft.id, null);
      bumpData("settings");
      toast("Cuestionario guardado", "success");
      leaving.current = true;
      navigate(OWN_FORMS_URL, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <Page title={isNew ? "Nuevo cuestionario" : "Cuestionario propio"} backTo={OWN_FORMS_URL} tabs={false}>
      {/* La primera vez: de quién es el contenido. */}
      {!notice && <p className="rounded-md bg-surface p-3 text-sm">No copies cuestionarios con derechos de autor (KOOS, Oswestry, QuickDASH, NDI…). El contenido es responsabilidad de tu clínica.</p>}
      {fromDraft && (
        <Alert tone="info" title="Tienes cambios sin guardar de la última vez">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              writeDraft(isNew ? "nuevo" : draft.id, null);
              setDraft(saved ?? blank());
              setFromDraft(false);
            }}
          >
            Descartarlos
          </Button>
        </Alert>
      )}
      <Card className="flex flex-col gap-3">
        <TextField label="Nombre" value={draft.name} maxLength={120} placeholder="Por ejemplo: Satisfacción con el tratamiento" onChange={(e) => set({ name: e.target.value })} />
        {copyright && <Alert tone="warning" title={`Ese nombre es de un cuestionario con derechos de autor (${copyright}). Si no tienes licencia, no lo copies.`} />}
        <TextArea label="Instrucciones para el paciente (opcional)" value={draft.instructions ?? ""} rows={2} maxLength={1000} onChange={(v) => set({ instructions: v || undefined })} />
        <TextArea label="Nota para el profesional (opcional)" hint="Un texto fijo de tu clínica: sale siempre junto al cuestionario, con el nombre de la clínica y la fecha. La app no lo enseña según el resultado." value={draft.note ?? ""} rows={2} maxLength={1000} onChange={(v) => set({ note: v || undefined })} />
      </Card>

      {draft.sections.map((s, si) => (
        <section key={si} aria-label={s.title || `Apartado ${si + 1}`} className="flex flex-col gap-3">
          {(draft.sections.length > 1 || s.title) && (
            <Card className="flex flex-col gap-3">
              <TextField label={`Título del apartado ${si + 1}`} maxLength={120} value={s.title ?? ""} onChange={(e) => setSection(si, { title: e.target.value || undefined })} />
              <TextArea label="Texto del apartado (opcional)" value={s.intro ?? ""} rows={2} maxLength={1000} onChange={(v) => setSection(si, { intro: v || undefined })} />
              {draft.sections.length > 1 && (
                <Button variant="ghost" size="sm" className="self-start text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => set({ sections: draft.sections.filter((_, i) => i !== si) })}>
                  Quitar el apartado {si + 1}
                </Button>
              )}
            </Card>
          )}
          {s.items.map((it, ii) => {
            return (
              <ItemEditor
                key={it.id}
                item={it}
                n={starts[si]! + ii + 1}
                first={ii === 0}
                last={ii === s.items.length - 1}
                onChange={(x) => setItem(si, ii, x)}
                onMove={(by) => moveItem(si, ii, by)}
                onRemove={() => removeItem(si, ii)}
              />
            );
          })}
          <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setSection(si, { items: [...s.items, newItem("scale")] })}>
            Añadir pregunta{draft.sections.length > 1 ? ` al apartado ${si + 1}` : ""}
          </Button>
        </section>
      ))}
      {draft.sections.length < 10 && (
        <Button variant="ghost" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => set({ sections: [...draft.sections, { title: `Apartado ${draft.sections.length + 1}`, items: [] }] })}>
          Añadir apartado
        </Button>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">Nota</h2>
        <Pick label="Cómo se calcula" options={METHODS} value={method} onChange={(m) => (m === "none" ? set({ scoring: null }) : setScoring({ method: m }))} />
        {draft.scoring && (
          <>
            <Pick
              label="Qué es mejor (solo orienta la flecha de la gráfica)"
              options={[
                { id: "higher", label: "Más es mejor" },
                { id: "lower", label: "Menos es mejor" },
              ]}
              value={draft.scoring.better}
              onChange={(better) => setScoring({ better })}
            />
            <NumInput
              label="Mínimo de preguntas contestadas para calcularla"
              value={draft.scoring.minAnswered ?? counted.length}
              onChange={(v) => {
                const all = v >= counted.length;
                setScoring({ minAnswered: all ? undefined : Math.max(1, Math.round(v)), na: all ? "block" : "skip" });
              }}
            />
            <p className="-mt-2 text-sm text-text-muted">
              {counted.length === 1 ? "Cuenta 1 pregunta" : `Cuentan ${counted.length} preguntas`}. Con menos de todas, la media y el porcentaje se calculan sobre las contestadas.
            </p>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold">Subescalas (opcional)</legend>
              {(draft.scoring.subscales ?? []).map((sub, i) => (
                <Card key={i} className="flex flex-col gap-2">
                  <TextField label={`Subescala ${i + 1}`} maxLength={120} value={sub.name} onChange={(e) => setScoring({ subscales: draft.scoring!.subscales!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Chips
                    label="Preguntas que entran"
                    multiple
                    options={counted.map((it) => it.id)}
                    render={(qid) => counted.find((it) => it.id === qid)?.text || "(sin texto)"}
                    value={sub.items}
                    onChange={(items) => setScoring({ subscales: draft.scoring!.subscales!.map((x, j) => (j === i ? { ...x, items } : x)) })}
                  />
                  <Button variant="ghost" size="sm" className="self-start text-danger" onClick={() => setScoring({ subscales: draft.scoring!.subscales!.filter((_, j) => j !== i) })}>
                    Quitar la subescala {i + 1}
                  </Button>
                </Card>
              ))}
              {(draft.scoring.subscales?.length ?? 0) < 10 && (
                <Button variant="ghost" size="sm" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setScoring({ subscales: [...(draft.scoring!.subscales ?? []), { name: "", items: [] }] })}>
                  Añadir subescala
                </Button>
              )}
            </fieldset>
            <p className="text-sm text-text-muted">La app solo calcula la nota: no pone rangos, colores, categorías ni avisos.</p>
          </>
        )}
      </Card>

      {error && <Alert tone="danger" title="No se ha guardado">{error}</Alert>}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Button
          variant="secondary"
          size="lg"
          icon={<Eye aria-hidden="true" className="size-5" />}
          onClick={() => {
            setPreviewAnswers({});
            setPreview(true);
          }}
        >
          Así lo verá
        </Button>
        <Button size="lg" block loading={saving} onClick={() => void save()}>
          Guardar
        </Button>
      </div>

      <Sheet open={preview} onClose={() => setPreview(false)} title="Así lo verá el paciente">
        {form && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-semibold">{draft.name || "(sin nombre)"}</p>
            <p className="-mt-2 text-sm font-semibold text-text-muted">{ownLabelFor(clinicName)}</p>
            <FormFill form={form} answers={previewAnswers} onChange={setPreviewAnswers} />
            <p className="text-sm text-text-muted">El paciente no ve la nota: la ves tú en su ficha.</p>
          </div>
        )}
      </Sheet>

      <Sheet open={blocker.state === "blocked"} onClose={() => blocker.reset?.()} title="Tienes cambios sin guardar">
        <div className="flex flex-col gap-3">
          <p>Si descartas, el cuestionario se queda como estaba y estos cambios se pierden.</p>
          <Button
            block
            onClick={async () => {
              blocker.reset?.();
              await save();
            }}
          >
            Guardar
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              writeDraft(isNew ? "nuevo" : draft.id, null);
              leaving.current = true;
              blocker.proceed?.();
            }}
          >
            Descartar
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
