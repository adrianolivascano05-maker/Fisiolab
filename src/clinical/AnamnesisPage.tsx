// Ficha › Anamnesis: los datos del paciente, la anamnesis por apartados (con el diagnóstico en CIF), las banderas rojas y
// amarillas y los accesos a la exploración. Rellenar o cambiar, con su borrador.
import { ChevronDown, ChevronRight, Pencil, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { answerText, answeredCount, fieldIn, orphanAnswers, orphanText, type Field, type Section } from "./anamnesis";
import { RedFlagPanel } from "./RedFlagPanel";
import { CifPicker } from "./cif/CifPicker";
import { draftDiagnosis, personalFactors } from "./cif/prose";
import { evidenceFrom } from "./cif/suggest";
import { YellowFlagPanel } from "./YellowFlagPanel";
import { useAnamnesisSections } from "./useAnamnesis";
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
/** Campos con respuesta en un apartado (sin contar la fecha, que se pone sola). */
const filled = (section: Section, a: Answers) => answeredCount(a, section.fields.filter((f) => f.id !== "fecha_valoracion"));

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
    // Viendo todos los motivos, la anamnesis es la del último abierto: se dice cuál.
    const shown = focus === ALL && episodes.length > 1 ? episodes.find((e) => e.id === current) : undefined;
    return { patient, anamnesis, findings, tests, shown, current, sessions, questionnaires };
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answers | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  /** Lo que había al empezar a editar: al guardar solo se escribe lo que se ha cambiado aquí (lo que llegue mientras tanto, p. ej. del paciente, se queda). */
  const base = useRef<Answers>({});
  const sections = useAnamnesisSections();
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
  const { patient, anamnesis, findings, tests, shown, sessions, questionnaires } = data.data;
  if (!patient) return <Page title="Anamnesis" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const romTrends = trends(tests.filter((t) => t.movement !== null));

  const labelOf = (fid: string) => fieldIn(sections, fid)?.label ?? fid;
  const set = (fid: string) => (v: AnswerValue) => setDraft((d) => ({ ...d, [fid]: v }));
  const startEdit = () => {
    base.current = { ...anamnesis?.answers };
    setDraft({ ...anamnesis?.answers });
    setEditing(true);
    setError(null);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      // Sobre lo que hay ahora, solo los campos cambiados aquí: lo que haya llegado mientras (las respuestas del
      // paciente, otro dispositivo) no se pisa.
      const db = getDb();
      const now = (await getAnamnesis(db, id))?.answers ?? {};
      const merged: Answers = { ...now };
      for (const k of new Set([...Object.keys(base.current), ...Object.keys(draft)])) {
        if (JSON.stringify(draft[k] ?? null) !== JSON.stringify(base.current[k] ?? null)) merged[k] = draft[k] ?? null;
      }
      await saveAnamnesis(db, id, merged);
      toast("Anamnesis guardada", "success");
      setEditing(false);
      setDraft(null);
      // También la cabecera: el nombre del motivo de consulta sale de la anamnesis.
      bumpData();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing && draft) {
    return (
      <PatientShell patient={patient} id={id} tabs={false}>
        <h2 className="text-xl">{anamnesis ? "Editar anamnesis" : "Anamnesis"}</h2>
        {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
        <p className="text-sm text-text-muted">Ficha de anamnesis de fisioterapia: historia clínica y valoración inicial. Rellena lo que necesites; todo se puede completar más tarde.</p>
        {/* Aún sin anamnesis: mandarle su parte al móvil, como en Cuestionarios, sin tener que buscarlo. */}
        {!anamnesis && (
          <Link to={`/pacientes/${id}/formularios?enviar=anamnesis`} className="inline-flex min-h-12 items-center justify-center gap-1.5 self-start rounded-md border border-border bg-bg px-4 text-sm font-semibold text-accent hover:bg-surface">
            <Send aria-hidden="true" className="size-4 shrink-0" /> Enviar al móvil del paciente
          </Link>
        )}
        {/* En ancho (el ordenador), el índice fijo a la izquierda y los apartados a la derecha; en el móvil, el índice arriba. */}
        <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-[13rem_minmax(0,1fr)] @2xl:items-start @2xl:gap-x-6">
        {/* Índice: la ficha es larga; cada apartado a un toque. */}
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
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {sections.map((section) => {
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
                  {section.fields.map((f) => (
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
                            evidence: evidenceFrom(draft, sessions, questionnaires, symmetryRows(tests)),
                            personal: personalFactors(draft, patient.birthDate),
                          });
                          const now = typeof draft.diagnostico_funcional === "string" ? draft.diagnostico_funcional.trim() : "";
                          // Lo redactado se añade debajo de lo que ya hubiera escrito; nunca lo borra.
                          set("diagnostico_funcional")(now ? `${now}\n\n${text}` : text);
                          toast("Diagnóstico redactado con la CIF: revísalo debajo", "success");
                        }}
                      />
                    ) : (
                      <FieldInput field={f} value={draft[f.id]} onChange={set(f.id)} />
                    )}
                    </div>
                  ))}
                  {section.id === "motivo" && (
                    <div className="@4xl:col-span-2">
                    <RedFlagPanel
                      answers={draft}
                      birthDate={patient.birthDate}
                      labelOf={labelOf}
                      patientId={id}
                      onMark={(label) => {
                        const now = Array.isArray(draft.banderas_rojas) ? (draft.banderas_rojas as string[]) : [];
                        if (!now.includes(label)) set("banderas_rojas")([...now, label]);
                      }}
                    />
                    </div>
                  )}
                  {section.id === "tratamientos" && (
                    <div className="@4xl:col-span-2">
                      <YellowFlagPanel answers={draft} labelOf={labelOf} patientId={id} links={false} />
                    </div>
                  )}
                  {section.id === "exploracion" && (
                    <div className="@4xl:col-span-2">
                      <ExplorationLinks id={id} findings={findings} romTrends={romTrends} />
                    </div>
                  )}
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
  const done = answeredCount(a, allFields);
  const valued = typeof a.fecha_valoracion === "string" ? a.fecha_valoracion : null;
  const orphans = orphanAnswers(a, sections);
  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex flex-col">
        <h2 className="text-xl">Anamnesis</h2>
        {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
        <p className="text-sm text-text-muted">
          {valued ? `Valoración del ${dayText(valued)}` : `Rellenada el ${fmtDate(anamnesis.createdAt)}`}
          {anamnesis.updatedAt !== anamnesis.createdAt && ` · actualizada el ${fmtDate(anamnesis.updatedAt)}`} · {done} de {allFields.length} campos
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
      <RedFlagPanel answers={a} birthDate={patient.birthDate} labelOf={labelOf} patientId={id} />
      <YellowFlagPanel answers={a} labelOf={labelOf} patientId={id} />
      {sections.map((section) => {
        const rows = section.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "");
        const n = filled(section, a);
        return (
          <Fold key={section.id} id={`an-${section.id}`} title={section.title} count={n ? `${n} de ${section.fields.length}` : "Sin rellenar"} open={OPEN_FIRST.has(section.id) && n > 0}>
            {section.id === "datos" && <PatientBasics patient={patient} />}
            {rows.length > 0 ? (
              <dl className="flex flex-col gap-2 @2xl:grid @2xl:grid-cols-2 @2xl:gap-x-6">
                {rows.map((f) => {
                  const text = answerText(f, a[f.id] ?? null);
                  return (
                    <div key={f.id} className={cx("flex flex-col", (wideField(f) || text.length > 60) && "@2xl:col-span-2")}>
                      <dt className="text-sm text-text-muted">{f.label}</dt>
                      <dd className="whitespace-pre-line">{text}</dd>
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
            Otros datos guardados
          </h3>
          <dl className="flex flex-col gap-2">
            {orphans.map(([k, v]) => {
              const o = orphanText(k, v);
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
