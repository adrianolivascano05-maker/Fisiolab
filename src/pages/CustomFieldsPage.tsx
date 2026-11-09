// Ajustes → Anamnesis de la clínica (src/data/anamnesisTemplates.ts, docs/anamnesis-adaptable.md): un editor que
// parece la anamnesis. Arriba, las plantillas de la clínica (chips, «+ Nueva» y «⋯»); cada pregunta con un interruptor
// para mostrarla u ocultarla en esta plantilla; al tocarla, su hoja (textos, quién la contesta, obligatoria, «Mostrar
// solo si…», destacar, apartado, subir, bajar, duplicar, volver al original y cómo se ve). Al final, los módulos de
// especialidad (de OmniClin y de la clínica). Se guarda solo, con «Deshacer» unos segundos. Solo quien administra la
// clínica la cambia (sin clínica en la nube, quien usa el móvil). Lo ya respondido no se toca nunca.
import { ArrowDown, ArrowUp, ChevronDown, Copy, MoreHorizontal, Plus, RotateCcw, Trash } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import {
  BASE_VERSION,
  conditionTarget,
  conditionValues,
  forPatient,
  highlightValues,
  MAX_REQUIRED,
  NUMBER_UNITS,
  PATIENT_TEXT,
  whoOf,
  type Field,
  type ShowIf,
  type Who,
} from "../clinical/anamnesis";
import { TextArea } from "../clinical/parts";
import { getToken } from "../cloud/auth";
import { useCloud } from "../cloud/cloudContext";
import {
  ackModule,
  addModuleField,
  blankModule,
  copyModule,
  listModuleDocs,
  newModuleId,
  patchModuleField,
  resetModule,
  resetModuleField,
  resolveModule,
  retireModuleField,
  saveModuleDoc,
  type ModuleDoc,
} from "../data/anamnesisModules";
import {
  addModule,
  addOwn,
  addSection,
  archiveTemplate,
  changeCount,
  createTemplate,
  duplicateField,
  duplicateTemplate,
  editorView,
  GENERAL,
  getDefaultTemplateId,
  hideWarning,
  LIMITS,
  listTemplates,
  moveField,
  moveSection,
  newOwnId,
  patchField,
  removeModule,
  removeSection,
  renameSection,
  renameTemplate,
  resetAll,
  resetField,
  resetSection,
  resolveTemplate,
  retireOwn,
  saveTemplateDoc,
  setDefaultTemplate,
  setHidden,
  setProposals,
  trunkNews,
  type Proposals,
  type EditorItem,
  type EditorSection,
  type OwnField,
  type OwnType,
  type TemplateDoc,
} from "../data/anamnesisTemplates";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { MODULE_SELF, MODULES_LIBRARY } from "../data/modulesLibrary";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { ACTIVE } from "../clinical/questionnaires";
import { ownKinds } from "../clinical/ownCatalog";
import { MEASURES, proposedQuestionnaires } from "../clinical/proposals";
import { clean, Fold, Options, Pick, PickMany, Preview, Row, Switch, Toggle, WHO } from "./AnamnesisEditorParts";

/** Cuánto dura el «Deshacer». */
const UNDO_MS = 6000;

/** Un cambio del editor: la plantilla, los módulos de la clínica que toca, o los dos (se guardan juntos). */
type Change = { doc?: TemplateDoc; mods?: ModuleDoc[] };

const isTrunkSection = (s: EditorSection) => !s.module && !s.added;

// ---------- La hoja «Pregunta» ----------

type QuestionProps = {
  doc: TemplateDoc;
  mods: ModuleDoc[];
  view: EditorSection[];
  sectionId: string;
  item: EditorItem;
  first: boolean;
  last: boolean;
  /** Obligatorias que ya tiene la plantilla (como mucho 5). */
  required: number;
  onChange: (c: Change, undo?: string) => void;
  onClose: () => void;
};

function QuestionSheet({ doc, mods, view, sectionId, item, first, last, required, onChange, onClose }: QuestionProps) {
  const f = item.field;
  const modId = item.module;
  const mod = modId ? (mods.find((m) => m.id === modId) ?? blankModule(modId)) : null;
  const modName = modId ? (resolveModule(modId, mod)?.name ?? modId) : "";
  const own: OwnField | undefined = mod ? mod.added.find((x) => x.id === f.id) : doc.delta.added.find((x) => x.id === f.id);
  const libField = mod && !own ? MODULES_LIBRARY.find((m) => m.id === modId)?.fields.find((x) => x.id === f.id) : undefined;
  const savedPatient = own ? (own.patientLabel ?? "") : mod ? (mod.fields[f.id]?.patientLabel ?? libField?.patientLabel ?? "") : (doc.delta.fields[f.id]?.patientLabel ?? "");
  const [label, setLabel] = useState(f.label);
  const [patientLabel, setPatientLabel] = useState(savedPatient);
  const [hint, setHint] = useState(f.hint ?? "");
  const [error, setError] = useState<string | null>(null);
  const placeholder = PATIENT_TEXT[f.id]?.label ?? label;
  const textsChanged = label !== f.label || hint !== (f.hint ?? "") || patientLabel !== savedPatient;
  const texts = { label, hint: hint || undefined, patientLabel: patientLabel || undefined };
  /** El cambio con lo escrito en la hoja incluido (en una sola escritura). En una de módulo, va al módulo. */
  const apply = (change: Omit<Partial<OwnField>, "showIf"> & { who?: Who; section?: string; showIf?: ShowIf | null; required?: boolean }, undo?: string) => {
    if (mod) {
      const m = label.trim() && textsChanged ? patchModuleField(mod, f.id, texts) : mod;
      onChange({ mods: [patchModuleField(m, f.id, change)] }, undo);
    } else {
      const d = label.trim() && textsChanged ? patchField(doc, f.id, texts) : doc;
      const { showIf, ...rest } = change;
      onChange({ doc: patchField(d, f.id, { ...rest, ...(showIf !== undefined ? { showIf: showIf ?? undefined } : {}) }) }, undo);
    }
  };
  /** Lo escrito se guarda al tocar «Listo», al cerrar la hoja o con cualquier otro cambio de la hoja. */
  const saveTexts = () => {
    if (!label.trim()) return setError("Escribe la pregunta.");
    setError(null);
    if (textsChanged) apply({});
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
  const options = f.type === "choice" || f.type === "multi" ? f.options : null;
  const editableOptions = !!options && (!!own || !!libField);
  const section = view.find((s) => s.id === sectionId);
  const index = section?.items.findIndex((i) => i.field.id === f.id) ?? -1;
  // «Mostrar solo si…»: sobre una pregunta anterior de este apartado, de Sí/No o de una opción (no en las del tronco).
  const canCondition = (!!own || !!mod) && f.type !== "cif";
  const targets = (section?.items.slice(0, Math.max(0, index)) ?? []).filter((i) => !i.hidden && conditionTarget(i.field)).map((i) => i.field);
  const target = f.showIf ? targets.find((t) => t.id === f.showIf!.field) : undefined;
  const dependents = view.flatMap((s) => s.items).filter((i) => i.field.showIf?.field === f.id);
  const highlightable = own || mod ? highlightValues(f) : [];
  const canRequire = f.type !== "cif" && forPatient(f) && !f.sensitive;
  // A dónde se puede mover: una del tronco o propia, a los apartados del tronco y nuevos; una de módulo, a los del
  // tronco o al apartado propio de su módulo.
  const places = view.filter((s) => (mod ? isTrunkSection(s) || s.id === modId : !s.module)).map((s) => ({ id: s.id === modId ? MODULE_SELF : s.id, label: clean(s.title) }));
  const here = mod ? (sectionId === modId ? MODULE_SELF : sectionId) : sectionId;
  const locked = !!f.showIf || dependents.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {mod && (
        <p className="rounded-md bg-surface p-3 text-sm">
          Del módulo «{modName}»: lo que cambies aquí se ve en todas las plantillas que lo llevan. Para quitarla solo de esta plantilla, usa su interruptor.
        </p>
      )}
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
      {f.type !== "cif" && <Pick label="La contesta" options={WHO} value={whoOf(f)} onChange={(w) => apply({ who: w })} />}
      {editableOptions && (
        <>
          <Options value={options!} locked={new Set(options!)} onChange={(o) => apply({ options: o })} />
          {own && <Toggle label="Permitir «Otro (escribir)»" on={!!own.other} onChange={(v) => apply({ other: v || undefined })} />}
        </>
      )}
      {f.type === "yesno_detail" && (own || libField) && (
        <TextField label="Si contesta Sí, se le pregunta" value={f.detail ?? "¿Cuál?"} maxLength={LIMITS.label} onChange={(e) => apply({ detail: e.target.value || undefined })} />
      )}
      {own?.type === "number" && (
        <Pick label="Unidad" options={[{ id: "", label: "Sin unidad" }, ...NUMBER_UNITS.map((u) => ({ id: u, label: u }))]} value={own.unit ?? ""} onChange={(u) => apply({ unit: u || undefined })} />
      )}
      {own && (
        <Toggle
          label="Pregunta delicada"
          hint="Lleva «Prefiero no responder» y no puede ser obligatoria (salud mental, sexualidad, tóxicos…)."
          on={!!own.sensitive}
          onChange={(v) => apply({ sensitive: v || undefined, ...(v ? { required: undefined } : {}) })}
        />
      )}
      {canRequire && (
        <Toggle
          label="Obligatoria para el paciente"
          hint={`Sale con «(necesaria)» y su formulario no deja seguir sin contestarla. Como mucho ${MAX_REQUIRED} por plantilla.`}
          on={!!f.required}
          disabled={!f.required && required >= MAX_REQUIRED}
          onChange={(v) => apply({ required: v || undefined })}
        />
      )}
      {canCondition && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Mostrar solo si…</legend>
          {!targets.length && !f.showIf ? (
            <p className="text-sm text-text-muted">Para ponerle una condición, antes tiene que haber en este apartado una pregunta de Sí/No o de una opción.</p>
          ) : (
            <>
              <Pick
                label="Depende de"
                options={[{ id: "", label: "Siempre se ve" }, ...targets.map((t) => ({ id: t.id, label: t.label }))]}
                value={f.showIf?.field ?? ""}
                onChange={(id) => {
                  const t = targets.find((x) => x.id === id);
                  apply({ showIf: t ? { field: t.id, op: "eq", value: conditionValues(t)[0]! } : null }, t ? "Condición puesta" : "Sin condición");
                }}
              />
              {target && (
                <PickMany
                  label="Se ve si contesta"
                  options={conditionValues(target)}
                  value={Array.isArray(f.showIf!.value) ? f.showIf!.value : [f.showIf!.value]}
                  onChange={(v) => v.length && apply({ showIf: v.length === 1 ? { field: target.id, op: "eq", value: v[0]! } : { field: target.id, op: "in", value: v } })}
                />
              )}
            </>
          )}
        </fieldset>
      )}
      {highlightable.length > 0 && (
        <PickMany
          label="Destacar en la ficha estas respuestas"
          hint="Salen en la ficha con el texto de la opción, sin recuentos y aparte de las banderas rojas."
          options={highlightable}
          value={f.highlight ?? []}
          onChange={(v) => apply({ highlight: v.length ? v : undefined })}
        />
      )}
      {places.length > 1 && f.type !== "cif" && (
        <Pick
          label="Apartado"
          hint={locked ? "Tiene una condición (o depende de ella otra pregunta): quítala antes de moverla." : undefined}
          options={places}
          value={here}
          onChange={(to) => {
            if (locked || to === here) return;
            settled.current = true;
            apply({ section: to }, "Pregunta movida");
            onClose();
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={first} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => onChange({ doc: moveField(doc, sectionId, f.id, -1, mods) })}>
          Subir
        </Button>
        <Button variant="secondary" size="sm" disabled={last} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => onChange({ doc: moveField(doc, sectionId, f.id, 1, mods) })}>
          Bajar
        </Button>
        {f.type !== "cif" && !mod && (
          <Button variant="secondary" size="sm" icon={<Copy aria-hidden="true" className="size-4" />} onClick={() => onChange({ doc: duplicateField(doc, sectionId, f, mods) }, "Pregunta duplicada")}>
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
              onChange(mod ? { mods: [resetModuleField(mod, f.id)] } : { doc: resetField(doc, f.id) }, "Pregunta como la original");
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
      {(own || mod) && (
        <Button
          variant="ghost"
          className="text-danger"
          block
          icon={<Trash aria-hidden="true" className="size-4" />}
          onClick={() => {
            settled.current = true;
            onChange(mod ? { mods: [retireModuleField(mod, f.id)] } : { doc: retireOwn(doc, f.id) }, mod ? "Pregunta quitada del módulo (lo respondido se guarda)" : "Pregunta quitada (lo respondido se guarda)");
            onClose();
          }}
        >
          {mod ? "Quitarla del módulo" : "Quitar la pregunta"}
        </Button>
      )}
    </div>
  );
}

// ---------- Añadir una pregunta ----------

type Kind = "text" | "choice" | "yesno" | "yesno_detail" | "scale" | "number" | "date" | "zones";
const TYPES: { id: Kind; label: string }[] = [
  { id: "text", label: "Texto" },
  { id: "choice", label: "Opciones" },
  { id: "yesno", label: "Sí/No" },
  { id: "yesno_detail", label: "Sí/No con detalle" },
  { id: "scale", label: "Escala" },
  { id: "number", label: "Número" },
  { id: "date", label: "Fecha" },
  { id: "zones", label: "Zonas del cuerpo" },
];

function AddSheet({ sectionId, onAdd }: { sectionId: string; onAdd: (f: OwnField) => void }) {
  const [kind, setKind] = useState<Kind>("text");
  const [label, setLabel] = useState("");
  const [long, setLong] = useState(false);
  const [multi, setMulti] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [other, setOther] = useState(false);
  const [detail, setDetail] = useState("¿Cuál?");
  const [unit, setUnit] = useState("");
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
    ...(kind === "number" && unit ? { unit } : {}),
    ...(sensitive ? { sensitive: true } : {}),
  };
  const preview: Field | null = field.label
    ? kind === "choice"
      ? { id: field.id, label: field.label, type: multi ? "multi" : "choice", options: field.options ?? [], who }
      : kind === "number"
        ? { id: field.id, label: field.label, type: "number", unit, min: 0, max: 100000, who }
        : ({ ...field, options: undefined } as unknown as Field)
    : null;
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
      {kind === "number" && <Pick label="Unidad" options={[{ id: "", label: "Sin unidad" }, ...NUMBER_UNITS.map((u) => ({ id: u, label: u }))]} value={unit} onChange={setUnit} />}
      <Pick label="La contesta" options={WHO} value={who} onChange={setWho} />
      <Toggle label="Pregunta delicada" hint="Lleva «Prefiero no responder» y no puede ser obligatoria (salud mental, sexualidad, tóxicos…)." on={sensitive} onChange={setSensitive} />
      {preview && <Preview field={preview} />}
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

export function CustomFieldsPage() {
  const cloud = useCloud();
  const toast = useToast();
  const [params] = useSearchParams();
  const canEdit = !cloud?.clinic || cloud.clinic.role === "admin";
  const admins = useAdmins(!canEdit);
  const loaded = useAsync(
    async () => {
      const db = getDb();
      const [templates, def, mods] = await Promise.all([listTemplates(db), getDefaultTemplateId(db), listModuleDocs(db)]);
      return { templates, def, mods };
    },
    [],
    { tables: ["settings"] },
  );
  /** La plantilla que se edita (si no, la de por defecto). */
  const [tplId, setTplId] = useState<string | null>(null);
  const currentId = tplId ?? loaded.data?.def ?? GENERAL;
  /** Lo último guardado aquí (antes de que vuelva de la base): la pantalla no espera a la escritura. */
  const [local, setLocal] = useState<TemplateDoc | null>(null);
  const [localMods, setLocalMods] = useState<Record<string, ModuleDoc>>({});
  const doc = (local?.id === currentId ? local : null) ?? loaded.data?.templates.find((t) => t.id === currentId) ?? null;
  const mods = useMemo(() => {
    const byId = new Map((loaded.data?.mods ?? []).map((m) => [m.id, m]));
    for (const m of Object.values(localMods)) byId.set(m.id, m);
    return [...byId.values()];
  }, [loaded.data?.mods, localMods]);
  const [open, setOpen] = useState<{ section: string; id: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; label: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [sheet, setSheet] = useState<null | "new" | "menu" | "section-new" | "module-new" | { section: string }>(null);
  const [undo, setUndo] = useState<{ text: string; prev: Change } | null>(null);
  /** Las novedades de OmniClin que se acaban de ver (salen marcadas «nueva»). */
  const [news, setNews] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const view = useMemo(() => (doc ? editorView(doc, mods) : []), [doc, mods]);
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
  /** Cuántas escrituras faltan por terminar: mientras haya alguna, la lista está «ocupada» (aria-busy). */
  const [pending, setPending] = useState(0);
  /** Guarda la plantilla y los módulos que cambian (se ve al momento) y ofrece deshacerlo unos segundos. */
  function commit(c: Change, undoText: string | null = "Guardado"): Promise<void> {
    if (!doc || !canEdit) return Promise.resolve();
    const prev: Change = { ...(c.doc ? { doc } : {}), ...(c.mods ? { mods: c.mods.map((m) => mods.find((x) => x.id === m.id) ?? blankModule(m.id, m.name)) } : {}) };
    const n = ++seq.current;
    if (c.doc) setLocal(c.doc);
    if (c.mods) setLocalMods((lm) => ({ ...lm, ...Object.fromEntries(c.mods!.map((m) => [m.id, m])) }));
    if (timer.current) clearTimeout(timer.current);
    if (undoText) {
      setUndo({ text: undoText, prev });
      timer.current = setTimeout(() => setUndo(null), UNDO_MS);
    } else setUndo(null);
    setPending((p) => p + 1);
    chain.current = chain.current.then(async () => {
      try {
        const db = getDb();
        for (const m of c.mods ?? []) {
          const saved = await saveModuleDoc(db, m, memberEmail());
          if (n === seq.current) setLocalMods((lm) => ({ ...lm, [saved.id]: saved }));
        }
        if (c.doc) {
          const saved = await saveTemplateDoc(db, c.doc, memberEmail());
          // Solo la última: una escritura anterior que termina tarde no tapa lo que se ha hecho después.
          if (n === seq.current) setLocal(saved);
        }
        bumpData("settings");
      } catch (e) {
        if (n === seq.current) {
          if (prev.doc) setLocal(prev.doc);
          if (prev.mods) setLocalMods((lm) => ({ ...lm, ...Object.fromEntries(prev.mods!.map((m) => [m.id, m])) }));
          setUndo(null);
        }
        toast(e instanceof Error ? e.message : String(e), "danger");
      } finally {
        setPending((p) => p - 1);
      }
    });
    return chain.current;
  }
  /** Lo que se hace con las plantillas (crear, duplicar, archivar…): directo a la base, sin «Deshacer». */
  const run = async <T,>(work: () => Promise<T>, done: string): Promise<T | null> => {
    try {
      const out = await work();
      bumpData("settings");
      toast(done, "success");
      return out;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
      return null;
    }
  };
  const show = (id: string) => {
    setLocal(null);
    setTplId(id);
    setNews(new Set());
  };
  const toggle = (item: EditorItem, on: boolean) => {
    if (!doc) return;
    const warn = !on && !item.own && !item.module ? hideWarning(item.field.id) : null;
    if (warn) return setAsking({ id: item.field.id, label: item.field.label });
    void commit({ doc: setHidden(doc, item.field.id, !on, item.module) }, on ? "Pregunta visible" : "Pregunta oculta");
  };

  if (!doc || !loaded.data)
    return <Page title="Anamnesis de la clínica" backTo="/ajustes">{loaded.error ? <Alert tone="danger" title={loaded.error.message} /> : <p className="text-sm text-text-muted">Cargando…</p>}</Page>;
  const def = loaded.data.def;
  const templates = loaded.data.templates;
  const active = templates.filter((t) => !t.archived);
  const isDefault = doc.id === def;
  const changes = changeCount(doc.delta);
  const openSection = view.find((s) => s.id === open?.section);
  const openIndex = openSection?.items.findIndex((i) => i.field.id === open?.id) ?? -1;
  const openItem = openIndex >= 0 ? openSection!.items[openIndex]! : null;
  const resolved = resolveTemplate(doc, mods);
  const required = resolved.sections.flatMap((s) => s.fields).filter((f) => f.required).length;
  const inTemplate = doc.delta.modules.map((tm) => ({ tm, rm: resolveModule(tm.id, mods.find((m) => m.id === tm.id)) })).filter((x) => x.rm);
  const modName = (id: string) => inTemplate.find((x) => x.tm.id === id)?.rm?.name ?? id;
  // Novedades de OmniClin aún no vistas: del tronco y de cada módulo de OmniClin que lleva.
  const trunkNew = trunkNews(doc);
  const modNew = inTemplate.filter((x) => x.rm!.news.length);
  const newCount = trunkNew.length + modNew.reduce((n, x) => n + x.rm!.news.length, 0);
  const ownMods = mods.filter((m) => !m.id.startsWith("m_"));
  const freeOwn = ownMods.filter((m) => !m.archived && !doc.delta.modules.some((t) => t.id === m.id));
  const sectionMenu = sheet && typeof sheet === "object" ? view.find((s) => s.id === sheet.section) : undefined;

  return (
    <Page title="Anamnesis de la clínica" backTo="/ajustes">
      <p className="text-sm text-text-muted">Lo que cambies lo ve todo el equipo. Lo ya respondido no se toca.</p>
      {!canEdit && <Alert tone="info" title={`La cambia quien administra la clínica${admins.length ? `: ${admins.join(", ")}` : "."}`} />}

      {/* Las plantillas: chips (si hay más de una), «+ Nueva» y «⋯» con lo de la que se ve. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Plantillas">
        {active.length > 1 &&
          active.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === doc.id}
              onClick={() => show(t.id)}
              className={cx("min-h-11 rounded-pill border px-4 text-sm font-semibold", t.id === doc.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-surface")}
            >
              {t.name}
            </button>
          ))}
        {canEdit && (
          <Button variant="secondary" size="sm" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setSheet("new")}>
            {active.length > 1 ? "Nueva" : "Nueva plantilla"}
          </Button>
        )}
        {canEdit && (
          <button type="button" aria-label={`Más opciones de la plantilla «${doc.name}»`} onClick={() => setSheet("menu")} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface">
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      {(active.length > 1 || doc.archived) && (
        <p className="-mt-2 text-sm text-text-muted">
          Plantilla «{doc.name}»{isDefault ? " · la que sale por defecto" : ""}
          {doc.archived ? " · archivada" : ""}
        </p>
      )}
      {doc.by && doc.at && (
        <p className="text-sm text-text-muted">
          Último cambio: {doc.by}, el {new Date(doc.at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" })}
        </p>
      )}
      {canEdit && newCount > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-md bg-surface p-3 text-sm">
          <span>
            {trunkNew.length > 0 && `La plantilla de OmniClin tiene ${trunkNew.length === 1 ? "1 pregunta nueva" : `${trunkNew.length} preguntas nuevas`}. `}
            {modNew.map((x) => `El módulo «${x.rm!.name}» tiene ${x.rm!.news.length === 1 ? "1 pregunta nueva" : `${x.rm!.news.length} preguntas nuevas`}. `)}
          </span>
          <button
            type="button"
            className="min-h-11 font-semibold text-accent underline"
            onClick={() => {
              setNews(new Set([...trunkNew, ...modNew.flatMap((x) => x.rm!.news)]));
              void commit({ doc: { ...doc, base: BASE_VERSION }, mods: modNew.map((x) => ackModule(mods.find((m) => m.id === x.tm.id) ?? blankModule(x.tm.id))) }, null);
            }}
          >
            Ver
          </button>
        </p>
      )}

      <div aria-busy={pending > 0} className="flex flex-col gap-4">
        {view.map((s) => {
          const visible = s.items.filter((i) => !i.hidden);
          const toPatient = visible.filter((i) => i.field.type !== "cif" && forPatient(i.field)).length;
          const tag = s.module ? (s.module.startsWith("m_") ? "Módulo de OmniClin" : "Módulo de la clínica") : s.added ? "Apartado de la clínica" : undefined;
          return (
            <Fold
              key={s.id}
              id={`plantilla-${s.id}`}
              title={clean(s.title)}
              tag={tag}
              count={`${visible.length} ${visible.length === 1 ? "pregunta" : "preguntas"} · ${toPatient} al paciente`}
              open={focus === s.id || s.items.some((i) => news.has(i.field.id))}
            >
              <ul aria-label={`Preguntas: ${clean(s.title)}`} className="flex flex-col divide-y divide-border">
                {s.items.map((item) => (
                  <li key={item.field.id} className="flex items-center gap-1">
                    {canEdit ? (
                      <button type="button" onClick={() => setOpen({ section: s.id, id: item.field.id })} className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-md px-2 py-1 text-left hover:bg-surface">
                        <Row item={item} moduleName={item.module && item.module !== s.module ? modName(item.module) : undefined} isNew={news.has(item.field.id)} />
                      </button>
                    ) : (
                      <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-2 py-1">
                        <Row item={item} moduleName={item.module && item.module !== s.module ? modName(item.module) : undefined} />
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
                  {isTrunkSection(s) && s.changed && (
                    <Button variant="ghost" size="sm" icon={<RotateCcw aria-hidden="true" className="size-4" />} onClick={() => void commit({ doc: resetSection(doc, s.id) }, `${clean(s.title)}: como el original`)}>
                      Volver al original este apartado
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSheet({ section: s.id })}>
                    Nombre y orden del apartado
                  </Button>
                </div>
              )}
            </Fold>
          );
        })}
      </div>
      {canEdit && (
        <Button variant="ghost" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setSheet("section-new")}>
          Añadir apartado
        </Button>
      )}

      {/* Los módulos de especialidad: los de esta plantilla, los de la clínica y la biblioteca de OmniClin. */}
      <section aria-labelledby="h-cf-modulos" className="flex flex-col gap-3">
        <h2 id="h-cf-modulos" className="text-lg">
          Módulos
        </h2>
        <p className="text-sm text-text-muted">Bloques de preguntas de una especialidad. Lo que cambies en un módulo se ve en todas las plantillas que lo llevan.</p>
        {inTemplate.length > 0 && (
          <ul aria-label="Módulos de esta plantilla" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
            {inTemplate.map(({ tm, rm }) => (
              <li key={tm.id} className="flex flex-col gap-2 px-3 py-2">
                <span className="flex flex-col">
                  <span className="font-semibold break-words">{rm!.name}</span>
                  <span className="text-sm text-text-muted">
                    {rm!.lib ? "De OmniClin" : "De la clínica"} · {rm!.items.filter((i) => !i.removed).length} preguntas
                  </span>
                </span>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void commit({ doc: removeModule(doc, tm.id) }, `«${rm!.name}» quitado de esta plantilla`)}>
                      Quitar de esta plantilla
                    </Button>
                    {rm!.lib && rm!.changed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RotateCcw aria-hidden="true" className="size-4" />}
                        onClick={() => void commit({ mods: [resetModule(mods.find((m) => m.id === tm.id) ?? blankModule(tm.id))] }, `«${rm!.name}»: versión de OmniClin`)}
                      >
                        Volver a la versión de OmniClin
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy aria-hidden="true" className="size-4" />}
                      onClick={() => {
                        const copy = copyModule(rm!, `${rm!.name} (copia)`.slice(0, LIMITS.label), newOwnId);
                        void commit({ mods: [copy] }, null);
                        toast(`Copia en «De la clínica»: «${copy.name}»`, "success");
                      }}
                    >
                      Duplicar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <>
            <h3 className="text-base">De la clínica</h3>
            {freeOwn.length > 0 && (
              <ul aria-label="Módulos de la clínica" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
                {freeOwn.map((m) => (
                  <li key={m.id} className="flex flex-col gap-2 px-3 py-2">
                    <span className="flex flex-col">
                      <span className="font-semibold break-words">{m.name}</span>
                      <span className="text-sm text-text-muted">{m.added.filter((f) => !f.removed).length} preguntas</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => void commit({ doc: addModule(doc, m.id, mods) }, `«${m.name}» añadido`)}>
                        Añadir a esta plantilla
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void commit({ mods: [{ ...m, archived: true }] }, `«${m.name}» archivado`)}>
                        Archivar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setSheet("module-new")}>
              Nuevo módulo
            </Button>
            {ownMods.some((m) => m.archived) && (
              <ul aria-label="Módulos archivados" className="divide-y divide-border overflow-hidden rounded-lg border border-dashed border-border-input">
                {ownMods
                  .filter((m) => m.archived)
                  .map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="text-text-muted">{m.name} · archivado</span>
                      <Button variant="ghost" size="sm" onClick={() => void commit({ mods: [{ ...m, archived: undefined }] }, `«${m.name}» se puede volver a usar`)}>
                        Volver a usarlo
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
            <h3 className="text-base">Biblioteca de OmniClin</h3>
            {MODULES_LIBRARY.some((m) => !doc.delta.modules.some((t) => t.id === m.id)) && (
              <ul aria-label="Módulos de OmniClin" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
                {MODULES_LIBRARY.filter((m) => !doc.delta.modules.some((t) => t.id === m.id)).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold break-words">{m.name}</span>
                      <span className="text-sm text-text-muted">
                        {m.fields.length} preguntas · versión {m.version}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Añadir «${m.name}» a esta plantilla`}
                      icon={<Plus aria-hidden="true" className="size-4" />}
                      onClick={() => {
                        const existing = mods.find((x) => x.id === m.id);
                        void commit({ doc: addModule(doc, m.id, mods), ...(existing ? {} : { mods: [blankModule(m.id)] }) }, `«${m.name}» añadido`);
                      }}
                    >
                      Añadir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-text-muted">Los demás módulos de OmniClin (y la versión revisada de estos) llegarán con una actualización: lo que hayas cambiado se respetará.</p>
          </>
        )}
      </section>

      {canEdit && (
        <ProposalsEditor
          own={doc.delta.propose}
          fromModules={resolveTemplate({ ...doc, delta: { ...doc.delta, propose: undefined } }, mods).propose}
          onChange={(p, text) => void commit({ doc: setProposals(doc, p) }, text)}
        />
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
              void commit(prev, null);
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
            mods={mods}
            view={view}
            sectionId={open.section}
            item={openItem}
            first={openIndex === 0}
            last={openIndex === openSection!.items.length - 1}
            required={required}
            onChange={(c, text) => void commit(c, text)}
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
              const sec = view.find((s) => s.id === adding);
              // En el apartado propio de un módulo, la pregunta es del módulo (se ve en todas sus plantillas).
              if (sec?.module) {
                const m = mods.find((x) => x.id === sec.module) ?? blankModule(sec.module);
                void commit({ mods: [addModuleField(m, { ...f, section: MODULE_SELF })] }, "Pregunta añadida al módulo");
              } else void commit({ doc: addOwn(doc, f, undefined, mods) }, "Pregunta añadida");
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
                void commit({ doc: setHidden(doc, asking.id, true) }, "Pregunta oculta");
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
          <p>Se quitarán tus {changes === 1 ? "cambios (1)" : `${changes} cambios`}. Lo respondido por los pacientes no cambia.</p>
          <Button
            block
            onClick={() => {
              void commit({ doc: resetAll(doc) }, "Plantilla de OmniClin");
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

      <Sheet open={sheet === "new"} onClose={() => setSheet(null)} title="Nueva plantilla">
        {sheet === "new" && (
          <NewTemplateSheet
            mods={mods}
            onCreate={async (name, ids) => {
              const created = await run(() => createTemplate(getDb(), name, ids, memberEmail()), `Plantilla «${name}» creada`);
              setSheet(null);
              if (created) show(created.id);
            }}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title={`Plantilla «${doc.name}»`}>
        {sheet === "menu" && (
          <TemplateMenu
            doc={doc}
            isDefault={isDefault}
            archived={templates.filter((t) => t.archived)}
            onDefault={async () => {
              await run(() => setDefaultTemplate(getDb(), doc.id), `«${doc.name}» sale ahora por defecto`);
              setSheet(null);
            }}
            onRename={async (name) => {
              await run(() => renameTemplate(getDb(), doc.id, name, memberEmail()), "Nombre cambiado");
              setLocal(null);
              setSheet(null);
            }}
            onDuplicate={async () => {
              const copy = await run(() => duplicateTemplate(getDb(), doc.id, memberEmail()), "Plantilla duplicada");
              setSheet(null);
              if (copy) show(copy.id);
            }}
            onArchive={async () => {
              const done = await run(() => archiveTemplate(getDb(), doc.id, true, memberEmail()), `«${doc.name}» archivada`);
              setSheet(null);
              if (done) show(def);
            }}
            onRestore={async (t) => {
              const done = await run(() => archiveTemplate(getDb(), t.id, false, memberEmail()), `«${t.name}» se puede volver a usar`);
              setSheet(null);
              if (done) show(t.id);
            }}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "section-new"} onClose={() => setSheet(null)} title="Nuevo apartado">
        {sheet === "section-new" && (
          <NameForm
            label="Nombre del apartado"
            action="Añadir apartado"
            onSave={(name) => {
              void commit({ doc: addSection(doc, name) }, "Apartado añadido");
              setSheet(null);
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!sectionMenu} onClose={() => setSheet(null)} title={sectionMenu ? `Apartado «${clean(sectionMenu.title)}»` : "Apartado"}>
        {sectionMenu && (
          <div className="flex flex-col gap-3">
            <NameForm
              label="Nombre del apartado"
              action="Guardar el nombre"
              initial={clean(sectionMenu.title)}
              onSave={(name) => {
                void commit({ doc: renameSection(doc, sectionMenu.id, name) }, "Nombre cambiado");
                setSheet(null);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={view[0]?.id === sectionMenu.id} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => void commit({ doc: moveSection(doc, sectionMenu.id, -1, mods) }, "Apartado subido")}>
                Subir el apartado
              </Button>
              <Button variant="secondary" size="sm" disabled={view.at(-1)?.id === sectionMenu.id} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => void commit({ doc: moveSection(doc, sectionMenu.id, 1, mods) }, "Apartado bajado")}>
                Bajar el apartado
              </Button>
            </div>
            {sectionMenu.added && (
              <>
                <Button
                  variant="ghost"
                  className="text-danger"
                  disabled={sectionMenu.items.length > 0}
                  icon={<Trash aria-hidden="true" className="size-4" />}
                  onClick={() => {
                    void commit({ doc: removeSection(doc, sectionMenu.id) }, "Apartado quitado");
                    setSheet(null);
                  }}
                >
                  Quitar el apartado
                </Button>
                {sectionMenu.items.length > 0 && <p className="text-sm text-text-muted">Para quitarlo, antes mueve sus preguntas a otro apartado o quítalas.</p>}
              </>
            )}
          </div>
        )}
      </Sheet>
      <Sheet open={sheet === "module-new"} onClose={() => setSheet(null)} title="Nuevo módulo">
        {sheet === "module-new" && (
          <NewModuleSheet
            onCreate={(name, guardian) => {
              const m: ModuleDoc = { v: 1, id: newModuleId(), name, fields: {}, added: [], ...(guardian ? { guardian: true } : {}) };
              void commit({ mods: [m], doc: addModule(doc, m.id, [...mods, m]) }, null);
              toast(`Módulo «${name}» creado: añádele preguntas en su apartado`, "success");
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

/** Un nombre y su botón (apartado nuevo, renombrar). */
function NameForm({ label, action, initial = "", onSave }: { label: string; action: string; initial?: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Escribe el nombre.");
        onSave(name.trim());
      }}
    >
      <TextField label={label} value={name} maxLength={LIMITS.label} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
      <Button type="submit" block>
        {action}
      </Button>
    </form>
  );
}

/** «+ Nueva»: nombre y módulos que lleva (de OmniClin y de la clínica). */
function NewTemplateSheet({ mods, onCreate }: { mods: ModuleDoc[]; onCreate: (name: string, moduleIds: string[]) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = [
    ...MODULES_LIBRARY.map((m) => ({ id: m.id, name: m.name, tag: "De OmniClin" })),
    ...mods.filter((m) => !m.id.startsWith("m_") && !m.archived).map((m) => ({ id: m.id, name: m.name, tag: "De la clínica" })),
  ];
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Escribe el nombre de la plantilla.");
        onCreate(name.trim(), picked);
      }}
    >
      <TextField label="Nombre" placeholder="Por ejemplo: Suelo pélvico" value={name} maxLength={LIMITS.label} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">Módulos que lleva</legend>
        <p className="text-sm text-text-muted">Lleva el tronco con los cambios de la que sale por defecto; lo que sobre, lo ocultas después.</p>
        {list.map((m) => (
          <Toggle key={m.id} label={m.name} hint={m.tag} on={picked.includes(m.id)} onChange={(v) => setPicked((p) => (v ? [...p, m.id] : p.filter((x) => x !== m.id)))} />
        ))}
      </fieldset>
      <Button type="submit" block>
        Crear
      </Button>
    </form>
  );
}

/** «⋯» de la plantilla: usar por defecto, renombrar, duplicar, archivar; y las archivadas. */
function TemplateMenu({
  doc,
  isDefault,
  archived,
  onDefault,
  onRename,
  onDuplicate,
  onArchive,
  onRestore,
}: {
  doc: TemplateDoc;
  isDefault: boolean;
  archived: TemplateDoc[];
  onDefault: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: (t: TemplateDoc) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!isDefault && !doc.archived && (
        <Button variant="secondary" block onClick={onDefault}>
          Usar por defecto
        </Button>
      )}
      <NameForm label="Nombre de la plantilla" action="Renombrar" initial={doc.name} onSave={onRename} />
      <Button variant="secondary" block icon={<Copy aria-hidden="true" className="size-4" />} onClick={onDuplicate}>
        Duplicar
      </Button>
      {!isDefault && doc.id !== GENERAL && !doc.archived && (
        <Button variant="secondary" block onClick={onArchive}>
          Archivar
        </Button>
      )}
      {(isDefault || doc.id === GENERAL) && <p className="text-sm text-text-muted">{doc.id === GENERAL ? "«General» no se archiva." : "La que sale por defecto no se archiva: elige antes otra por defecto."}</p>}
      <p className="text-sm text-text-muted">Archivar no cambia nada de lo ya hecho: los motivos que la usan la conservan.</p>
      {archived.length > 0 && (
        <section aria-label="Plantillas archivadas" className="flex flex-col gap-2">
          <h3 className="text-base">Archivadas</h3>
          {archived.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-text-muted">{t.name}</span>
              <Button variant="ghost" size="sm" onClick={() => onRestore(t)}>
                Volver a usarla
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** «+ Nuevo módulo»: nombre y si lo contesta un familiar o tutor. */
function NewModuleSheet({ onCreate }: { onCreate: (name: string, guardian: boolean) => void }) {
  const [guardian, setGuardian] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">Se añade a esta plantilla con su apartado propio: después le añades preguntas como a cualquier apartado, y lo puedes usar en otras plantillas.</p>
      <Toggle label="Lo contesta un familiar o tutor" hint="Al principio del formulario se pregunta quién contesta." on={guardian} onChange={setGuardian} />
      <NameForm label="Nombre del módulo" action="Crear el módulo" onSave={(name) => onCreate(name, guardian)} />
    </div>
  );
}

/**
 * «Al abrir un motivo con esta plantilla»: los cuestionarios y las mediciones que salen primero en «Valorar». Si la
 * clínica no los cambia, los de sus módulos.
 */
function ProposalsEditor({ own, fromModules, onChange }: { own?: Proposals; fromModules?: Proposals; onChange: (p: Proposals | null, text: string) => void }) {
  const now: Proposals = own ?? fromModules ?? { questionnaires: [], measures: [] };
  const set = (p: Partial<Proposals>, text: string) => onChange({ ...now, ...p }, text);
  const kinds = [...ACTIVE, ...ownKinds()];
  const picked = proposedQuestionnaires(now.questionnaires);
  return (
    <section aria-labelledby="h-cf-propone" className="flex flex-col gap-3">
      <h2 id="h-cf-propone" className="text-lg">
        Al abrir un motivo con esta plantilla
      </h2>
      <p className="text-sm text-text-muted">Salen primero en «Valorar», a un toque. Solo son atajos: no se pasa ni se mide nada solo.</p>
      <PickMany
        label="Mediciones"
        options={MEASURES.map((m) => m.label)}
        value={MEASURES.filter((m) => now.measures.includes(m.id)).map((m) => m.label)}
        onChange={(labels) => set({ measures: MEASURES.filter((m) => labels.includes(m.label)).map((m) => m.id) }, "Mediciones propuestas cambiadas")}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Cuestionarios</legend>
        {picked.length > 0 && (
          <ul className="flex flex-col gap-1">
            {picked.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3">
                <span className="min-w-0 py-2 break-words">{k.name}</span>
                <Button variant="ghost" size="sm" aria-label={`Quitar «${k.name}»`} onClick={() => set({ questionnaires: now.questionnaires.filter((x) => x !== k.id) }, "Cuestionario quitado")}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <SelectField
          label="Añadir un cuestionario"
          value=""
          onChange={(e) => e.target.value && set({ questionnaires: [...now.questionnaires, e.target.value] }, "Cuestionario propuesto")}
        >
          <option value="">Elige uno…</option>
          {kinds
            .filter((k) => !now.questionnaires.includes(k.id))
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
        </SelectField>
      </fieldset>
      {own && fromModules && (
        <Button variant="ghost" size="sm" className="self-start" icon={<RotateCcw aria-hidden="true" className="size-4" />} onClick={() => onChange(null, "Lo que proponen sus módulos")}>
          Volver a lo que proponen sus módulos
        </Button>
      )}
    </section>
  );
}
