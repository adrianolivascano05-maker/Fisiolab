// Ficha › Anamnesis: los datos del paciente, la anamnesis por apartados (con el diagnóstico en CIF), las banderas rojas y
// amarillas y los accesos a la exploración. Rellenar o cambiar, con su borrador.
import { ChevronDown, ChevronRight, Pencil, Send } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { fmtDate } from "../app/format";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { getAnamnesis, latestFindings, listFindings, listQuestionnaires, listSessions, saveAnamnesis, type AnswerValue, type Answers, type Finding } from "../data/clinical";
import { getDb } from "../data/db";
import { ALL, currentEpisode, episodeLabel, getFocus, listEpisodes } from "../data/episodes";
import { getPatient, listTests, type Patient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { useToast } from "../ui/Toast";
import { answerText, answered, answeredCount, baseBlocks, fieldIn, isMetaKey, orphanAnswers, orphanText, visibleFields, type Field, type Section } from "./anamnesis";
import { LevelSwitch } from "./LevelSwitch";
import { HighlightPanel } from "./HighlightPanel";
import { listSentForms } from "../data/patientForms";
import { ANAMNESIS_KIND } from "./patientForms";
import { RedFlagPanel } from "./RedFlagPanel";
import { CifPicker } from "./cif/CifPicker";
import { draftDiagnosis, personalFactors } from "./cif/prose";
import { evidenceFrom } from "./cif/suggest";
import { YellowFlagPanel } from "./YellowFlagPanel";
import { BASE_SECTIONS, useSnapshot, useTemplateFor } from "./useAnamnesis";
import { readSources, sourceText, stampSources, TPL } from "./answerMeta";
import { knownField, markTemplateUsed } from "../data/anamnesisTemplates";
import { memberEmail } from "../data/member";
import { trends } from "./measures";
import { FieldInput } from "./FieldInput";
import { symmetryRows } from "./symmetry";
import { PatientShell } from "./PatientShell";
import { dayText, Guard, sexLabels, todayDay, useLoad } from "./pageKit";
import { ageOn } from "../data/privacy";

// ---------- Anamnesis ----------


/** Nombre, edad, sexo y contacto vienen de los datos del paciente (se editan allí). */
function PatientBasics({ patient }: { patient: Patient }) {
  const years = ageOn(patient.birthDate);
  const rows: [string, string][] = [
    ["Nombre y apellidos", patient.name],
    ["Fecha de nacimiento", patient.birthDate ? fmtDate(`${patient.birthDate}T12:00:00`) : "—"],
    ["Edad", years !== null ? `${years} años` : "—"],
    ["Sexo", patient.sex ? sexLabels[patient.sex] : "—"],
    ["Teléfono", patient.phone || "—"],
    ["Email", patient.email || "—"],
    ...(patient.address ? [["Dirección", patient.address] as [string, string]] : []),
  ];
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Campos que en ancho ocupan las dos columnas: los de texto largo, la escala del dolor, las opciones múltiples y la CIF. */
const wideField = (f: Field) => f.type === "textarea" || f.type === "cif" || f.type === "scale" || f.type === "multi";

/** Apartados que se ven abiertos al llegar: lo que más se consulta (motivo, precauciones, diagnóstico y plan). */
const OPEN_FIRST = new Set(["motivo", "antecedentes", "diagnostico", "objetivos"]);
/** La fecha de la valoración se pone sola: no cuenta como pregunta. */
const asked = (fields: Field[]) => fields.filter((f) => f.id !== "fecha_valoracion");
/** Campos con respuesta en un apartado (sin contar la fecha, que se pone sola). */
const filled = (section: Section, a: Answers) => answeredCount(a, asked(section.fields));
const questions = (n: number) => (n === 1 ? "1 pregunta" : `${n} preguntas`);

/** Un apartado de la anamnesis que se pliega: el título, cuántos campos tiene rellenos y el contenido. */
function Fold({ id, title, count, open, children }: { id: string; title: string; count: string; open: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open || undefined} className="group scroll-mt-20 rounded-lg border border-border bg-bg shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold text-brand-ink">{title.replace(/^\d+\.\s*/, "")}</span>
        <span className="flex items-center gap-2 text-sm text-text-muted">
          {count}
          <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>
    </details>
  );
}

/** Lo que la app ya sabe de la exploración: tests registrados y movilidad medida. */
/** En el apartado de exploración física: lo registrado vive en Valoración; aquí, una línea que lleva allí. */
function ExplorationLinks({ id, findings, romTrends }: { id: string; findings: Finding[]; romTrends: ReturnType<typeof trends> }) {
  const n = latestFindings(findings).length;
  const what = [n ? (n === 1 ? "1 test" : `${n} tests`) : "", romTrends.length ? "movilidad medida" : ""].filter(Boolean).join(" y ");
  return (
    <Link to={`/pacientes/${id}/valoracion`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-accent">
      {what ? `Tests y mediciones (${what}): en Valoración` : "Tests y mediciones: en Valoración"} <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

export function AnamnesisPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  /** Recién creado un motivo de consulta: su id, para abrir su anamnesis para rellenar. */
  const editEpisode = (location.state as { editEpisode?: string } | null)?.editEpisode;
  const toast = useToast();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, anamnesis, findings, tests, episodes, focus, current, sessions, questionnaires] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listFindings(db, id),
      listTests(db, id),
      listEpisodes(db, id),
      getFocus(db, id),
      currentEpisode(db, id),
      listSessions(db, id),
      listQuestionnaires(db, id),
    ]);
    // Lo que contestó el paciente en sus enlaces de este motivo (aunque no se pusiera porque ya había algo escrito).
    const fromPatient = new Map<string, AnswerValue>();
    for (const f of (await listSentForms(db, id)).filter((x) => x.kind === ANAMNESIS_KIND && x.importedAt && x.answers && x.episodeId === current).sort((a, b) => (a.answeredAt ?? "").localeCompare(b.answeredAt ?? "")))
      for (const [k, v] of Object.entries(f.answers!)) if (!isMetaKey(k)) fromPatient.set(k, v as AnswerValue);
    // Viendo todos los motivos, la anamnesis es la del último abierto: se dice cuál.
    const shown = focus === ALL && episodes.length > 1 ? episodes.find((e) => e.id === current) : undefined;
    return { patient, anamnesis, findings, tests, shown, current, sessions, questionnaires, fromPatient };
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answers | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** La anamnesis base (lo mínimo: se abre siempre así) o la ampliada (todas las preguntas). */
  const [wide, setWide] = useState(false);
  /** Preguntas de la ampliada que se rellenaron estando en ella: al volver a la base se quedan a la vista. */
  const [sticky, setSticky] = useState<ReadonlySet<string>>(new Set());
  const autoStarted = useRef(false);
  /** Lo que había al empezar a editar: al guardar solo se escribe lo que se ha cambiado aquí (lo que llegue mientras tanto, p. ej. del paciente, se queda). */
  const base = useRef<Answers>({});
  /** La plantilla de esta anamnesis (la de su motivo: `__tpl`; sin ella, la de por defecto), tal como está ahora. */
  const tpl = useTemplateFor(data.data?.anamnesis?.answers[TPL]);
  const sections = tpl?.sections ?? BASE_SECTIONS;
  /** La plantilla con la que se hizo esta anamnesis: para leer con su pregunta lo que ya no está en la ficha. */
  const snap = useSnapshot(data.data?.anamnesis?.answers[TPL]);
  const allFields = sections.flatMap((x) => x.fields);

  // Sin anamnesis todavía: se empieza directamente a rellenar, con la fecha de hoy (solo al entrar). Recién creado un
  // motivo de consulta, en cuanto llega su anamnesis (la que ya trae los datos personales).
  useEffect(() => {
    if (!data.data) return;
    if (editEpisode && data.data.current === editEpisode) {
      autoStarted.current = true;
      base.current = { ...data.data.anamnesis?.answers };
      setDraft({ ...data.data.anamnesis?.answers });
      setEditing(true);
      navigate(".", { replace: true, state: null });
    } else if (!data.data.anamnesis && !autoStarted.current) {
      autoStarted.current = true;
      base.current = {};
      setDraft({ fecha_valoracion: todayDay() });
      setEditing(true);
    }
  }, [data.data, editEpisode, navigate]);

  if (!data.data) return <Guard state={data} title="Anamnesis" back={`/pacientes/${id}`} />;
  const { patient, anamnesis, findings, tests, shown, sessions, questionnaires, fromPatient } = data.data;
  if (!patient) return <Page title="Anamnesis" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const romTrends = trends(tests.filter((t) => t.movement !== null));

  const labelOf = (fid: string) => fieldIn(sections, fid)?.label ?? fid;
  const set = (fid: string) => (v: AnswerValue) => setDraft((d) => ({ ...d, [fid]: v }));
  const startEdit = () => {
    base.current = { ...anamnesis?.answers };
    setDraft({ ...anamnesis?.answers });
    setEditing(true);
    setError(null);
    setWide(false);
    setSticky(new Set());
  };
  /** Guarda lo cambiado. false si no se pudo (el error queda a la vista). */
  const persist = async (): Promise<boolean> => {
    if (!draft) return false;
    setSaving(true);
    setError(null);
    try {
      // Sobre lo que hay ahora, solo los campos cambiados aquí: lo que haya llegado mientras (las respuestas del
      // paciente, otro dispositivo) no se pisa.
      const db = getDb();
      const now = (await getAnamnesis(db, id))?.answers ?? {};
      let merged: Answers = { ...now };
      const changed: string[] = [];
      for (const k of new Set([...Object.keys(base.current), ...Object.keys(draft)])) {
        if (JSON.stringify(draft[k] ?? null) !== JSON.stringify(base.current[k] ?? null)) {
          merged[k] = draft[k] ?? null;
          changed.push(k);
        }
      }
      if (changed.length) {
        // La plantilla con la que se hizo (la primera vez; luego conserva la suya) y quién escribió cada respuesta.
        if (typeof merged[TPL] !== "string" && tpl) merged[TPL] = await markTemplateUsed(db, tpl);
        merged = stampSources(merged, changed, { by: "clinician", ...(memberEmail() ? { who: memberEmail()! } : {}), at: new Date().toISOString() });
      }
      await saveAnamnesis(db, id, merged);
      toast("Anamnesis guardada", "success");
      // También la cabecera: el nombre del motivo de consulta sale de la anamnesis.
      bumpData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(await persist())) return;
    setEditing(false);
    setDraft(null);
    window.scrollTo({ top: 0 });
  };
  /** «Modificar»: a Ajustes → Anamnesis de la clínica. Lo que se haya escrito aquí se guarda antes: no se pierde. */
  const modify = async () => {
    const dirty = !!draft && [...new Set([...Object.keys(base.current), ...Object.keys(draft)])].some((k) => k !== "fecha_valoracion" && JSON.stringify(draft[k] ?? null) !== JSON.stringify(base.current[k] ?? null));
    if (dirty && !(await persist())) return;
    navigate("/ajustes/anamnesis");
  };

  if (editing && draft) {
    /** Las preguntas que se ven: en la base, las de la base y, de la ampliada, las que ya tienen respuesta guardada. */
    const saved = anamnesis?.answers ?? {};
    const fieldsOf = (section: Section) => visibleFields(section.fields, draft).filter((f) => wide || !f.extra || answered(saved[f.id]) || sticky.has(f.id));
    const toggle = (next: boolean) => {
      // Lo rellenado en la ampliada se queda a la vista al volver a la base.
      if (!next) setSticky(new Set(allFields.filter((f) => f.extra && answered(draft[f.id])).map((f) => f.id)));
      setWide(next);
    };
    const input = (f: Field) => (
      <div key={f.id} className={cx(wideField(f) && "@4xl:col-span-2")}>
        {f.type === "cif" ? (
          <CifPicker
            label={f.label}
            hint={f.hint}
            value={Array.isArray(draft[f.id]) ? (draft[f.id] as string[]) : []}
            onChange={set(f.id)}
            regions={Array.isArray(draft.regiones) ? (draft.regiones as string[]) : []}
            evidence={evidenceFrom(draft, sessions, questionnaires, symmetryRows(tests))}
            onDraft={() => {
              const text = draftDiagnosis(Array.isArray(draft.cif) ? (draft.cif as string[]) : [], {
                personal: personalFactors(draft, patient.birthDate),
              });
              const now = typeof draft.diagnostico_funcional === "string" ? draft.diagnostico_funcional.trim() : "";
              // Lo redactado se añade debajo de lo que ya hubiera escrito; nunca lo borra.
              set("diagnostico_funcional")(now ? `${now}\n\n${text}` : text);
              toast("Perfil CIF pasado a texto: revísalo debajo", "success");
            }}
          />
        ) : (
          <FieldInput field={f} value={draft[f.id]} onChange={set(f.id)} />
        )}
      </div>
    );
    /** Lo que cuelga de un apartado: las banderas rojas del motivo, las frases anotadas y los accesos a la exploración. */
    const extras = (sectionId: string) => (
      <>
        {sectionId === "motivo" && (
          <div className="@4xl:col-span-2">
            <RedFlagPanel
              answers={draft}
              labelOf={labelOf}
              onMark={(label) => {
                const now = Array.isArray(draft.banderas_rojas) ? (draft.banderas_rojas as string[]) : [];
                if (!now.includes(label)) set("banderas_rojas")([...now, label]);
              }}
            />
          </div>
        )}
        {sectionId === "tratamientos" && (
          <div className="@4xl:col-span-2">
            <YellowFlagPanel answers={draft} labelOf={labelOf} patientId={id} links={false} />
          </div>
        )}
        {sectionId === "exploracion" && (
          <div className="@4xl:col-span-2">
            <ExplorationLinks id={id} findings={findings} romTrends={romTrends} />
          </div>
        )}
      </>
    );
    return (
      <PatientShell patient={patient} id={id} tabs={false}>
        <h2 className="text-xl">{anamnesis ? "Editar anamnesis" : "Anamnesis"}</h2>
        {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
        {/* La base (lo mínimo), la ampliada (todo) y «Modificar» (qué preguntas salen en cada una). */}
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <LevelSwitch wide={wide} onChange={toggle} base={questions(asked(allFields.filter((f) => !f.extra)).length)} full={questions(asked(allFields).length)} />
          </div>
          <button type="button" onClick={() => void modify()} className="inline-flex min-h-12 flex-col items-center justify-center rounded-lg border border-border bg-bg px-3 text-sm leading-tight font-semibold text-accent hover:bg-surface">
            Modificar
            <span className="text-xs font-normal text-text-muted">preguntas</span>
          </button>
        </div>
        <p className="text-sm text-text-muted">{wide ? "Todas las preguntas. Rellena lo que necesites; todo se puede completar más tarde." : "Lo mínimo para valorar. Lo demás está en la ampliada; todo se puede completar más tarde."}</p>
        {/* Aún sin anamnesis: mandarle su parte al móvil, como en Cuestionarios, sin tener que buscarlo. */}
        {!anamnesis && (
          <Link to={`/pacientes/${id}/formularios?enviar=anamnesis`} className="inline-flex min-h-12 items-center justify-center gap-1.5 self-start rounded-md border border-border bg-bg px-4 text-sm font-semibold text-accent hover:bg-surface">
            <Send aria-hidden="true" className="size-4 shrink-0" /> Enviar al móvil del paciente
          </Link>
        )}
        {/* En ancho (el ordenador) y con la ampliada, el índice fijo a la izquierda y los apartados a la derecha; en el móvil, el índice arriba. */}
        <div className={cx("flex flex-col gap-4", wide && "@2xl:grid @2xl:grid-cols-[13rem_minmax(0,1fr)] @2xl:items-start @2xl:gap-x-6")}>
        {/* Índice: la ampliada es larga; cada apartado a un toque. La base cabe sin índice. */}
        {wide && (
        <nav aria-label="Apartados de la anamnesis" className="@2xl:sticky @2xl:top-[calc(var(--layout-header)+1rem)]">
          <ul className="flex flex-wrap gap-2 @2xl:flex-col">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#anamnesis-${section.id}`}
                  onClick={(e) => {
                    // Sin tocar la dirección: «Volver» sigue llevando a la ficha. Si el apartado está plegado, se abre.
                    e.preventDefault();
                    const el = document.getElementById(`anamnesis-${section.id}`);
                    if (el instanceof HTMLDetailsElement) el.open = true;
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex min-h-11 items-center rounded-pill border border-border-input bg-bg px-3 text-sm font-semibold hover:bg-surface @2xl:w-full">
                  {section.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        )}
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {/* La base: tres bloques a la vista, sin plegar. */}
          {!wide &&
            baseBlocks(sections, fieldsOf).map((block) => (
              <section key={block.id} id={`anamnesis-${block.id}`} aria-labelledby={`h-anamnesis-${block.id}`} className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-border bg-bg p-4 shadow-card">
                <h3 id={`h-anamnesis-${block.id}`} className="text-lg font-semibold text-brand-ink">
                  {block.title}
                </h3>
                <div className="flex flex-col gap-4 @4xl:grid @4xl:grid-cols-2 @4xl:gap-x-6">
                  {block.parts.map((part) => (
                    <Fragment key={part.section}>
                      {part.fields.map(input)}
                      {extras(part.section)}
                    </Fragment>
                  ))}
                </div>
              </section>
            ))}
          {/* La ampliada: apartado por apartado, como siempre. */}
          {wide &&
            sections.map((section) => {
            const n = filled(section, draft);
            return (
              <Fold
                key={section.id}
                id={`anamnesis-${section.id}`}
                title={section.title}
                count={n ? `${n} de ${section.fields.length}` : ""}
                open={OPEN_FIRST.has(section.id) || (n > 0 && !!anamnesis)}
              >
                <div role="group" aria-label={section.title} className="flex flex-col gap-4 @4xl:grid @4xl:grid-cols-2 @4xl:gap-x-6">
                  {section.id === "datos" && (
                    <div className="flex flex-col gap-2 rounded-md bg-surface p-3 @4xl:col-span-2">
                      <PatientBasics patient={patient} />
                      <Link to={`/pacientes/${id}/editar`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent">
                        Editar nombre, nacimiento, sexo y contacto
                      </Link>
                    </div>
                  )}
                  {/* Las preguntas con «Mostrar solo si…» aparecen debajo de la suya cuando se cumple. */}
                  {fieldsOf(section).map(input)}
                  {extras(section.id)}
                </div>
              </Fold>
            );
          })}
          {error && <Alert tone="danger" title="No se pudo guardar">{error}</Alert>}
          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
            {anamnesis && (
              <Button variant="secondary" size="lg" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
            <Button type="submit" size="lg" block loading={saving}>
              Guardar anamnesis
            </Button>
          </div>
        </form>
        </div>
      </PatientShell>
    );
  }

  if (!anamnesis) return <PatientShell patient={patient} id={id}><Loading /></PatientShell>;
  const a = anamnesis.answers;
  // Cuánto hay de la base (lo mínimo) y cuánto más de la ampliada.
  const baseFields = asked(allFields.filter((f) => !f.extra));
  const doneBase = answeredCount(a, baseFields);
  const doneExtra = answeredCount(a, allFields.filter((f) => f.extra));
  const valued = typeof a.fecha_valoracion === "string" ? a.fecha_valoracion : null;
  const orphans = orphanAnswers(a, sections);
  const sources = readSources(a);
  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex flex-col">
        <h2 className="text-xl">Anamnesis</h2>
        {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
        <p className="text-sm text-text-muted">
          {valued ? `Valoración del ${dayText(valued)}` : `Rellenada el ${fmtDate(anamnesis.createdAt)}`}
          {anamnesis.updatedAt !== anamnesis.createdAt && ` · actualizada el ${fmtDate(anamnesis.updatedAt)}`} · {doneBase} de {baseFields.length} de la base
          {doneExtra > 0 && ` · ${doneExtra} de la ampliada`}
        </p>
      </div>
      {/* Las dos acciones, en una fila: editarla aquí o mandarle su parte al móvil. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={startEdit}>
          Editar anamnesis
        </Button>
        <Link to={`/pacientes/${id}/formularios?enviar=anamnesis`} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-border bg-bg px-2 text-center text-sm font-semibold text-accent hover:bg-surface">
          <Send aria-hidden="true" className="size-4 shrink-0" /> Mandar su parte al paciente
        </Link>
      </div>
      <RedFlagPanel answers={a} labelOf={labelOf} />
      <YellowFlagPanel answers={a} labelOf={labelOf} patientId={id} />
      {/* Según la configuración de ahora de la clínica (su plantilla tal como está). */}
      <HighlightPanel answers={a} fields={tpl?.all ?? []} />
      {sections.map((section) => {
        const rows = section.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "");
        const n = filled(section, a);
        // Lo que toca en este apartado: las preguntas de la base y, de la ampliada, las respondidas. Un apartado solo
        // de la ampliada y sin nada escrito no sale (está en «Editar» → «Ampliada»).
        const due = asked(section.fields).filter((f) => !f.extra || answered(a[f.id])).length;
        if (!due && !rows.length && section.id !== "datos") return null;
        return (
          <Fold key={section.id} id={`an-${section.id}`} title={section.title} count={n ? `${n} de ${due}` : "Sin rellenar"} open={OPEN_FIRST.has(section.id) && n > 0}>
            {section.id === "datos" && <PatientBasics patient={patient} />}
            {rows.length > 0 ? (
              <dl className="flex flex-col gap-2 @2xl:grid @2xl:grid-cols-2 @2xl:gap-x-6">
                {rows.map((f) => {
                  const text = answerText(f, a[f.id] ?? null);
                  return (
                    <div key={f.id} className={cx("flex flex-col", (wideField(f) || text.length > 60) && "@2xl:col-span-2")}>
                      <dt className="text-sm text-text-muted">{f.label}</dt>
                      <dd className="whitespace-pre-line">{text}</dd>
                      {sources[f.id]?.by === "patient" && <dd className="text-xs text-text-muted">Lo contestó {sourceText(sources[f.id]!).replace(/^El paciente/, "el paciente")}</dd>}
                      {fromPatient.has(f.id) && JSON.stringify(fromPatient.get(f.id)) !== JSON.stringify(a[f.id]) && (
                        <dd className="text-sm whitespace-pre-line text-text-muted">El paciente contestó: {answerText(f, fromPatient.get(f.id) ?? null)}</dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            ) : (
              section.id !== "datos" && <p className="text-sm text-text-muted">Sin rellenar.</p>
            )}
            {section.id === "exploracion" && <ExplorationLinks id={id} findings={findings} romTrends={romTrends} />}
          </Fold>
        );
      })}
      {orphans.length > 0 && (
        <section aria-labelledby="an-otros" className="flex flex-col gap-2 rounded-lg border border-dashed border-border-input p-4">
          <h3 id="an-otros" className="text-lg">
            Respuestas a preguntas que ya no están
          </h3>
          <dl className="flex flex-col gap-2">
            {orphans.map(([k, v]) => {
              const o = orphanText(k, v, knownField(k, snap, tpl));
              return (
                <div key={k} className="flex flex-col">
                  <dt className="text-sm text-text-muted">{o.label}</dt>
                  <dd>{o.text}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </PatientShell>
  );
}
