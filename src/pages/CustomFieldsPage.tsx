// Ajustes → Anamnesis de la clínica (src/data/anamnesisTemplates.ts): un editor que parece la anamnesis. Cada
// pregunta con un interruptor para mostrarla u ocultarla; al tocarla, su hoja (textos, quién la contesta, subir,
// bajar, duplicar, volver al original y cómo se ve). Se guarda solo, con «Deshacer» unos segundos. Solo quien
// administra la clínica la cambia (sin clínica en la nube, quien usa el móvil). Lo ya respondido no se toca nunca.
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, RotateCcw, Sparkles, Trash, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { forPatient, PATIENT_TEXT, whoOf, type Field, type Who } from "../clinical/anamnesis";
import { FieldInput } from "../clinical/FieldInput";
import { TextArea } from "../clinical/parts";
import { patientSections } from "../clinical/patientForms";
import { getToken } from "../cloud/auth";
import { useCloud } from "../cloud/cloudContext";
import {
  addOwn,
  addPack,
  changeCount,
  duplicateField,
  editorView,
  getTemplateDoc,
  hideWarning,
  LIMITS,
  moveField,
  newOwnId,
  patchField,
  resetAll,
  resetField,
  resetSection,
  retireOwn,
  saveTemplateDoc,
  setHidden,
  type EditorItem,
  type OwnField,
  type OwnType,
  type TemplateDoc,
} from "../data/anamnesisTemplates";
import type { AnswerValue } from "../data/clinical";
import { CUSTOM_PACKS } from "../data/customFields";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const WHO: { id: Who; label: string }[] = [
  { id: "clinician", label: "Tú" },
  { id: "patient", label: "Paciente" },
  { id: "both", label: "Los dos" },
];
const whoText: Record<Who, string> = { clinician: "Solo tú", patient: "Paciente", both: "Los dos" };
const TYPE_TEXT: Record<string, string> = {
  text: "Texto",
  textarea: "Texto largo",
  date: "Fecha",
  number: "Número",
  scale: "Escala de 0 a 10",
  choice: "Una opción",
  multi: "Varias opciones",
  yesno_detail: "Sí/No con detalle",
  cif: "Códigos de la CIF",
};
const clean = (t: string) => t.replace(/^\d+\.\s*/, "");
/** Cuánto dura el «Deshacer». */
const UNDO_MS = 6000;

/** Un interruptor de 44 px (role="switch"). */
function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill disabled:opacity-40"
    >
      <span aria-hidden="true" className={cx("relative inline-block h-7 w-11 rounded-pill transition-colors", on ? "bg-accent" : "bg-border-input")}>
        <span className={cx("absolute top-0.5 left-0 size-6 rounded-pill bg-bg shadow-card transition-transform", on ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/** Chips de una sola elección (tipo de pregunta, quién la contesta). */
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

/** Un interruptor con su texto (dentro de las hojas). */
function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-sm text-text-muted">{hint}</span>}
      </span>
      <Switch on={on} label={label} onChange={onChange} />
    </div>
  );
}

/** «Así se ve»: la pregunta con el campo de verdad, para probarlo (no se guarda nada). */
function Preview({ field }: { field: Field }) {
  const [v, setV] = useState<AnswerValue>(null);
  const patient = patientSections([{ id: "x", title: "x", fields: [field] }])[0]?.fields[0];
  return (
    <section aria-label="Así se ve" className="flex flex-col gap-3 rounded-md bg-surface p-3">
      <p className="text-sm font-semibold text-text-muted">Así se ve</p>
      <FieldInput field={field} value={v} onChange={setV} />
      {patient && patient.label !== field.label && (
        <p className="text-sm text-text-muted">
          Al paciente: «{patient.label}»
        </p>
      )}
    </section>
  );
}

// ---------- Opciones (añadir y retirar, nunca renombrar) ----------

const PRESETS: { label: string; options: string[] }[] = [
  { label: "Sí / No", options: ["Sí", "No"] },
  { label: "Derecho / Izquierdo / Los dos", options: ["Derecho", "Izquierdo", "Los dos"] },
  { label: "Nunca · A veces · A menudo · Siempre", options: ["Nunca", "A veces", "A menudo", "Siempre"] },
  { label: "Nada … Mucho (0-4)", options: ["0 Nada", "1 Poco", "2 Algo", "3 Bastante", "4 Mucho"] },
];

/** Las opciones de una pregunta propia: una fila por opción con «×» y «+ Otra opción». `locked`: las que ya existían
 * (se pueden retirar, no reescribir: lo respondido siempre significa lo que decía la opción). */
function Options({ value, locked, onChange }: { value: string[]; locked: Set<string>; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">Opciones</legend>
      {!value.length && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => onChange(p.options)} className="min-h-11 rounded-pill border border-border-input bg-bg px-3 text-sm hover:bg-surface">
              {p.label}
            </button>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {value.map((o, i) => (
          <li key={o} className="flex items-center gap-1">
            {locked.has(o) ? (
              <span className="min-w-0 flex-1 rounded-md border border-border px-3 py-2">{o}</span>
            ) : (
              <input
                aria-label={`Opción ${i + 1}`}
                maxLength={LIMITS.label}
                value={o}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3"
              />
            )}
            <button type="button" aria-label={`Quitar la opción ${o}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface">
              <X aria-hidden="true" className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1">
        <input
          aria-label="Otra opción"
          placeholder="Otra opción"
          maxLength={LIMITS.label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3"
        />
        <Button variant="secondary" size="sm" icon={<Plus aria-hidden="true" className="size-4" />} onClick={add}>
          Añadir
        </Button>
      </div>
      {locked.size > 0 && <p className="text-sm text-text-muted">Las opciones ya guardadas no se reescriben: si no te vale una, quítala y añade otra. Lo ya respondido no cambia.</p>}
    </fieldset>
  );
}

// ---------- La hoja «Pregunta» ----------

type QuestionProps = {
  doc: TemplateDoc;
  sectionId: string;
  item: EditorItem;
  first: boolean;
  last: boolean;
  onChange: (next: TemplateDoc, undo?: string) => void;
  onClose: () => void;
};

function QuestionSheet({ doc, sectionId, item, first, last, onChange, onClose }: QuestionProps) {
  const f = item.field;
  const own = doc.delta.added.find((x) => x.id === f.id);
  const [label, setLabel] = useState(f.label);
  const [patientLabel, setPatientLabel] = useState(own ? (own.patientLabel ?? "") : (doc.delta.fields[f.id]?.patientLabel ?? ""));
  const [hint, setHint] = useState(f.hint ?? "");
  const [error, setError] = useState<string | null>(null);
  const placeholder = PATIENT_TEXT[f.id]?.label ?? label;
  const savedPatient = own ? (own.patientLabel ?? "") : (doc.delta.fields[f.id]?.patientLabel ?? "");
  /** La plantilla con lo escrito en la hoja (si ha cambiado y la pregunta no está vacía). */
  const withTexts = (d: TemplateDoc) =>
    label.trim() && (label !== f.label || hint !== (f.hint ?? "") || patientLabel !== savedPatient)
      ? patchField(d, f.id, { label, hint: hint || undefined, patientLabel: patientLabel || undefined })
      : d;
  /** Lo escrito se guarda al tocar «Listo», al cerrar la hoja o con cualquier otro cambio de la hoja. */
  const saveTexts = () => {
    if (!label.trim()) return setError("Escribe la pregunta.");
    setError(null);
    const next = withTexts(doc);
    if (next !== doc) onChange(next);
  };
  const latest = useRef(saveTexts);
  useEffect(() => {
    latest.current = saveTexts;
  });
  /** Ya guardado (Listo) o descartado (volver al original, quitar): al cerrar no se vuelve a escribir. */
  const settled = useRef(false);
  useEffect(
    () => () => {
      if (!settled.current) latest.current();
    },
    [],
  );
  /** Otro cambio de la hoja, con lo escrito incluido (en una sola escritura). */
  const change = (fn: (d: TemplateDoc) => TemplateDoc, undo?: string) => onChange(fn(withTexts(doc)), undo);
  const options = f.type === "choice" || f.type === "multi" ? f.options : null;
  return (
    <div className="flex flex-col gap-4">
      <TextField label="Pregunta" value={label} maxLength={LIMITS.label} onChange={(e) => setLabel(e.target.value)} error={error ?? undefined} />
      {f.type !== "cif" && (
        <details className="group" open={!!patientLabel || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
            Para el paciente, dilo así <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <TextField label="Texto para el paciente (opcional)" value={patientLabel} placeholder={placeholder} maxLength={LIMITS.label} onChange={(e) => setPatientLabel(e.target.value)} />
        </details>
      )}
      <TextArea label="Ayuda (opcional)" value={hint} rows={2} onChange={(v) => setHint(v.slice(0, LIMITS.hint))} />
      {f.type !== "cif" && (
        <Pick
          label="La contesta"
          options={WHO}
          value={whoOf(f)}
          onChange={(w) => change((d) => patchField(d, f.id, { who: w }))}
        />
      )}
      {own && options && (
        <>
          <Options value={options} locked={new Set(options)} onChange={(o) => change((d) => patchField(d, f.id, { options: o }))} />
          <Toggle label="Permitir «Otro (escribir)»" on={!!own.other} onChange={(v) => change((d) => patchField(d, f.id, { other: v || undefined }))} />
        </>
      )}
      {own?.type === "yesno_detail" && (
        <TextField label="Si contesta Sí, se le pregunta" value={own.detail ?? "¿Cuál?"} maxLength={LIMITS.label} onChange={(e) => change((d) => patchField(d, f.id, { detail: e.target.value || undefined }))} />
      )}
      {own && <Toggle label="Pregunta delicada" hint="Lleva «Prefiero no responder» (salud mental, sexualidad, tóxicos…)." on={!!own.sensitive} onChange={(v) => change((d) => patchField(d, f.id, { sensitive: v || undefined }))} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={first} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => change((d) => moveField(d, sectionId, f.id, -1))}>
          Subir
        </Button>
        <Button variant="secondary" size="sm" disabled={last} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => change((d) => moveField(d, sectionId, f.id, 1))}>
          Bajar
        </Button>
        {f.type !== "cif" && (
          <Button variant="secondary" size="sm" icon={<Copy aria-hidden="true" className="size-4" />} onClick={() => change((d) => duplicateField(d, sectionId, f), "Pregunta duplicada")}>
            Duplicar
          </Button>
        )}
        {item.changed && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw aria-hidden="true" className="size-4" />}
            onClick={() => {
              settled.current = true;
              onChange(resetField(doc, f.id), "Pregunta como la original");
              onClose();
            }}
          >
            Volver al original
          </Button>
        )}
      </div>
      <Preview field={{ ...f, label, hint: hint || undefined, patientLabel: patientLabel || f.patientLabel }} />
      <Button
        block
        onClick={() => {
          if (!label.trim()) return setError("Escribe la pregunta.");
          saveTexts();
          settled.current = true;
          onClose();
        }}
      >
        Listo
      </Button>
      {own && (
        <Button
          variant="ghost"
          className="text-danger"
          block
          icon={<Trash aria-hidden="true" className="size-4" />}
          onClick={() => {
            settled.current = true;
            onChange(retireOwn(doc, f.id), "Pregunta quitada (lo respondido se guarda)");
            onClose();
          }}
        >
          Quitar la pregunta
        </Button>
      )}
    </div>
  );
}

// ---------- Añadir una pregunta ----------

const TYPES: { id: "text" | "choice" | "yesno_detail" | "scale"; label: string }[] = [
  { id: "text", label: "Texto" },
  { id: "choice", label: "Opciones" },
  { id: "yesno_detail", label: "Sí/No con detalle" },
  { id: "scale", label: "Escala" },
];

function AddSheet({ sectionId, onAdd }: { sectionId: string; onAdd: (f: OwnField) => void }) {
  const [kind, setKind] = useState<(typeof TYPES)[number]["id"]>("text");
  const [label, setLabel] = useState("");
  const [long, setLong] = useState(false);
  const [multi, setMulti] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [other, setOther] = useState(false);
  const [detail, setDetail] = useState("¿Cuál?");
  const [who, setWho] = useState<Who>("both");
  const [sensitive, setSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type: OwnType = kind === "text" ? (long ? "textarea" : "text") : kind === "choice" ? (multi ? "multi" : "choice") : kind;
  const field: OwnField = {
    id: newOwnId(),
    section: sectionId,
    type,
    label: label.trim(),
    who,
    ...(kind === "choice" ? { options: options.map((o) => o.trim()).filter(Boolean), ...(other ? { other: true } : {}) } : {}),
    ...(kind === "yesno_detail" ? { detail: detail.trim() || "¿Cuál?" } : {}),
    ...(sensitive ? { sensitive: true } : {}),
  };
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!field.label) return setError("Escribe la pregunta.");
        if (kind === "choice" && (field.options?.length ?? 0) < 2) return setError("Pon al menos dos opciones.");
        setError(null);
        onAdd(field);
      }}
    >
      <Pick label="Tipo" options={TYPES} value={kind} onChange={setKind} />
      <TextField label="Pregunta" value={label} maxLength={LIMITS.label} placeholder="Por ejemplo: Horas sentado al día" onChange={(e) => setLabel(e.target.value)} />
      {kind === "text" && <Toggle label="Respuesta larga" on={long} onChange={setLong} />}
      {kind === "choice" && (
        <>
          <Options value={options} locked={new Set()} onChange={setOptions} />
          <Toggle label="Puede marcar varias" on={multi} onChange={setMulti} />
          <Toggle label="Permitir «Otro (escribir)»" on={other} onChange={setOther} />
        </>
      )}
      {kind === "yesno_detail" && <TextField label="Si contesta Sí, se le pregunta" value={detail} maxLength={LIMITS.label} onChange={(e) => setDetail(e.target.value)} />}
      <Pick label="La contesta" options={WHO} value={who} onChange={setWho} />
      <Toggle label="Pregunta delicada" hint="Lleva «Prefiero no responder» (salud mental, sexualidad, tóxicos…)." on={sensitive} onChange={setSensitive} />
      {field.label && <Preview field={{ ...field, options: field.options ?? [] } as Field} />}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block>
        Añadir
      </Button>
    </form>
  );
}

// ---------- La pantalla ----------

/** Quién administra la clínica (con internet), para decirlo a los demás. */
function useAdmins(enabled: boolean): string[] {
  const cloud = useCloud();
  const clinic = cloud?.clinic;
  const api = cloud?.clinics;
  const list = useAsync(async () => {
    const token = getToken();
    if (!enabled || !clinic || !api || !token || !navigator.onLine) return [];
    const members = (await api.members(token, clinic.id)).filter((m) => m.role === "admin");
    const db = getDb();
    const out: string[] = [];
    for (const m of members) {
      const [row] = await db.query<{ name: string }>("select name from staff where email = ?", [m.email]);
      out.push(row?.name?.trim() || m.email);
    }
    return out;
  }, [enabled, clinic?.id]);
  return list.data ?? [];
}

function Fold({ id, title, count, open, children }: { id: string; title: string; count: string; open: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open || undefined} className="group scroll-mt-20 rounded-lg border border-border bg-bg shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold text-brand-ink">{title}</span>
          <span className="text-sm text-text-muted">{count}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-3 sm:px-4">{children}</div>
    </details>
  );
}

export function CustomFieldsPage() {
  const cloud = useCloud();
  const toast = useToast();
  const [params] = useSearchParams();
  const canEdit = !cloud?.clinic || cloud.clinic.role === "admin";
  const admins = useAdmins(!canEdit);
  const loaded = useAsync(() => getTemplateDoc(getDb()), [], { tables: ["settings"] });
  /** Lo último guardado aquí (antes de que vuelva de la base): la pantalla no espera a la escritura. */
  const [local, setLocal] = useState<TemplateDoc | null>(null);
  const doc = local ?? loaded.data ?? null;
  const [open, setOpen] = useState<{ section: string; id: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; label: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [undo, setUndo] = useState<{ text: string; prev: TemplateDoc } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const view = useMemo(() => (doc ? editorView(doc) : []), [doc]);
  const focus = params.get("apartado");

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Desde «Editar anamnesis»: el apartado abierto y a la vista.
  useEffect(() => {
    if (!focus || !view.length) return;
    document.getElementById(`plantilla-${focus}`)?.scrollIntoView({ block: "start" });
  }, [focus, view.length]);

  /** Las escrituras, una detrás de otra y en el orden en que se hicieron. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef(0);
  /** Guarda la plantilla (se ve al momento) y ofrece deshacerlo unos segundos. */
  function commit(next: TemplateDoc, undoText = "Guardado"): Promise<void> {
    if (!doc || !canEdit) return Promise.resolve();
    const prev = doc;
    const n = ++seq.current;
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    setUndo({ text: undoText, prev });
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
    chain.current = chain.current.then(async () => {
      try {
        const saved = await saveTemplateDoc(getDb(), next, memberEmail());
        // Solo la última: una escritura anterior que termina tarde no tapa lo que se ha hecho después.
        if (n === seq.current) setLocal(saved);
        bumpData("settings");
      } catch (e) {
        if (n === seq.current) {
          setLocal(prev);
          setUndo(null);
        }
        toast(e instanceof Error ? e.message : String(e), "danger");
      }
    });
    return chain.current;
  }
  const toggle = (item: EditorItem, show: boolean) => {
    if (!doc) return;
    const warn = !show && !item.own ? hideWarning(item.field.id) : null;
    if (warn) return setAsking({ id: item.field.id, label: item.field.label });
    void commit(setHidden(doc, item.field.id, !show), show ? "Pregunta visible" : "Pregunta oculta");
  };

  if (!doc) return <Page title="Anamnesis de la clínica" backTo="/ajustes">{loaded.error ? <Alert tone="danger" title={loaded.error.message} /> : <p className="text-sm text-text-muted">Cargando…</p>}</Page>;
  const changes = changeCount(doc.delta);
  const openSection = view.find((s) => s.id === open?.section);
  const openIndex = openSection?.items.findIndex((i) => i.field.id === open?.id) ?? -1;
  const openItem = openIndex >= 0 ? openSection!.items[openIndex]! : null;

  return (
    <Page title="Anamnesis de la clínica" backTo="/ajustes">
      <p className="text-sm text-text-muted">Lo que cambies lo ve todo el equipo. Lo ya respondido no se toca.</p>
      {!canEdit && (
        <Alert tone="info" title={`La cambia quien administra la clínica${admins.length ? `: ${admins.join(", ")}` : "."}`} />
      )}
      {doc.by && doc.at && (
        <p className="text-sm text-text-muted">
          Último cambio: {doc.by}, el {new Date(doc.at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" })}
        </p>
      )}

      {view.map((s) => {
        const visible = s.items.filter((i) => !i.hidden);
        const toPatient = visible.filter((i) => i.field.type !== "cif" && forPatient(i.field)).length;
        return (
          <Fold
            key={s.id}
            id={`plantilla-${s.id}`}
            title={clean(s.title)}
            count={`${visible.length} ${visible.length === 1 ? "pregunta" : "preguntas"} · ${toPatient} al paciente`}
            open={focus === s.id}
          >
            <ul aria-label={`Preguntas: ${clean(s.title)}`} className="flex flex-col divide-y divide-border">
              {s.items.map((item) => (
                <li key={item.field.id} className="flex items-center gap-1">
                  {canEdit ? (
                    <button type="button" onClick={() => setOpen({ section: s.id, id: item.field.id })} className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-md px-2 py-1 text-left hover:bg-surface">
                      <Row item={item} />
                    </button>
                  ) : (
                    <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-2 py-1">
                      <Row item={item} />
                    </div>
                  )}
                  {canEdit && <Switch on={!item.hidden} label={`Mostrar «${item.field.label}»`} onChange={(v) => toggle(item, v)} />}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setAdding(s.id)}>
                  Añadir pregunta
                </Button>
                {s.changed && (
                  <Button variant="ghost" size="sm" icon={<RotateCcw aria-hidden="true" className="size-4" />} onClick={() => void commit(resetSection(doc, s.id), `${clean(s.title)}: como el original`)}>
                    Volver al original este apartado
                  </Button>
                )}
              </div>
            )}
          </Fold>
        );
      })}

      {canEdit && (
        <section aria-labelledby="h-cf-paquetes" className="flex flex-col gap-2">
          <h2 id="h-cf-paquetes" className="text-lg">
            Para empezar, por especialidad
          </h2>
          <p className="text-sm text-text-muted">Unas preguntas habituales de ejemplo; después cámbialas o quita las que no uses.</p>
          <div className="flex flex-wrap gap-2">
            {CUSTOM_PACKS.map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                icon={<Sparkles aria-hidden="true" className="size-5" />}
                onClick={() => {
                  const r = addPack(doc, p.fields);
                  if (!r.added) return toast(`${p.title}: ya estaban`, "info");
                  void commit(r.doc, `${p.title}: ${r.added === 1 ? "1 pregunta añadida" : `${r.added} preguntas añadidas`}`);
                }}
              >
                {p.title}
              </Button>
            ))}
          </div>
        </section>
      )}

      {canEdit && changes > 0 && (
        <button type="button" onClick={() => setResetting(true)} className="inline-flex min-h-11 items-center self-start text-sm text-text-muted underline">
          Volver a la plantilla de OmniClin
        </button>
      )}

      {undo && (
        <div role="status" className="sticky bottom-[calc(var(--layout-tabbar,0px)+0.5rem)] z-20 flex items-center justify-between gap-2 self-center rounded-md bg-text px-4 py-1 text-sm text-bg shadow-pop">
          <span>{undo.text}</span>
          <button
            type="button"
            className="min-h-11 px-2 font-semibold underline"
            onClick={() => {
              const prev = undo.prev;
              void commit(prev);
              if (timer.current) clearTimeout(timer.current);
              setUndo(null);
            }}
          >
            Deshacer
          </button>
        </div>
      )}

      <Sheet open={!!openItem} onClose={() => setOpen(null)} title="Pregunta">
        {openItem && open && (
          <QuestionSheet
            key={openItem.field.id}
            doc={doc}
            sectionId={open.section}
            item={openItem}
            first={openIndex === 0}
            last={openIndex === openSection!.items.length - 1}
            onChange={(next, text) => void commit(next, text)}
            onClose={() => setOpen(null)}
          />
        )}
      </Sheet>
      <Sheet open={!!adding} onClose={() => setAdding(null)} title="Nueva pregunta">
        {adding && (
          <AddSheet
            key={adding}
            sectionId={adding}
            onAdd={(f) => {
              void commit(addOwn(doc, f), "Pregunta añadida");
              setAdding(null);
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!asking} onClose={() => setAsking(null)} title={`¿Ocultar «${asking?.label ?? ""}»?`}>
        {asking && (
          <div className="flex flex-col gap-3">
            <p>Si la ocultas, {hideWarning(asking.id)}.</p>
            <Button
              variant="danger"
              block
              onClick={() => {
                void commit(setHidden(doc, asking.id, true), "Pregunta oculta");
                setAsking(null);
              }}
            >
              Ocultar igualmente
            </Button>
            <Button variant="secondary" block onClick={() => setAsking(null)}>
              Dejar
            </Button>
          </div>
        )}
      </Sheet>
      <Sheet open={resetting} onClose={() => setResetting(false)} title="Volver a la plantilla de OmniClin">
        <div className="flex flex-col gap-3">
          <p>
            Se quitarán tus {changes === 1 ? "cambios (1)" : `${changes} cambios`}. Lo respondido por los pacientes no cambia.
          </p>
          <Button
            block
            onClick={() => {
              void commit(resetAll(doc), "Plantilla de OmniClin");
              setResetting(false);
            }}
          >
            Sí, volver
          </Button>
          <Button variant="secondary" block onClick={() => setResetting(false)}>
            No
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

function Row({ item }: { item: EditorItem }) {
  const f = item.field;
  return (
    <>
      <span className={cx("flex items-center gap-1.5 font-semibold", item.hidden && "text-text-muted line-through decoration-1")}>
        {item.changed && <span aria-label="Cambiada" role="img" className="inline-block size-2 shrink-0 rounded-pill bg-accent" />}
        <span className="min-w-0 break-words">{f.label}</span>
      </span>
      <span className="text-sm text-text-muted">
        {TYPE_TEXT[f.type] ?? "Texto"} · {f.type === "cif" ? "Solo tú" : whoText[whoOf(f)]}
        {item.own ? " · propia" : ""}
        {item.hidden ? " · oculta" : ""}
      </span>
    </>
  );
}
