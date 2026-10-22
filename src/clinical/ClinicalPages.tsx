// Pantallas de la ficha clínica: anamnesis, mediciones (con cuestionarios y simetría) y sesiones. La exploración
// (tests especiales) está en ExplorationPages.tsx, para no cargar la Guía de tests al abrir las demás.
import { SHOW_EXERCISES } from "../app/features";
import { Activity, CalendarCheck, CalendarClock, ChevronDown, ClipboardList, ListChecks, NotebookPen, Pencil, Plus, Send, Trash, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { decimalText, fmt, fmtDate, fmtDateTime, parseDecimal, testTitle } from "../app/format";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import {
  deleteQuestionnaire,
  deleteSession,
  getAnamnesis,
  getQuestionnaire,
  getSession,
  latestFindings,
  listFindings,
  listQuestionnaires,
  listSessions,
  saveAnamnesis,
  saveQuestionnaire,
  saveSession,
  sessionCount,
  type AnswerValue,
  type Answers,
  type Finding,
  type Questionnaire,
  type Session,
} from "../data/clinical";
import { getAppointment } from "../data/appointments";
import { getDb } from "../data/db";
import { ALL, currentEpisode, episodeLabel, getFocus, listEpisodes } from "../data/episodes";
import { getPatient, listTests, listWellness, type Patient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { addPayment, chargeText, euros, nextSessionCharge, type Method } from "../data/billing";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { useAsync } from "../app/useAsync";
import { CalendarSheet, DEFAULT_VISIT_MINUTES, fmtVisit, visitEvent } from "./CalendarButton";
import { answerText, answeredCount, clinicalSummary, fieldIn, orphanAnswers, orphanText, type Section } from "./anamnesis";
import { RedFlagPanel } from "./RedFlagPanel";
import { CifPicker } from "./cif/CifPicker";
import { draftDiagnosis } from "./cif/cif";
import { YellowFlagPanel } from "./YellowFlagPanel";
import { useAnamnesisSections } from "./useAnamnesis";
import { BodyMapInput } from "./BodyMap";
import { lastMethod, MethodPicker, rememberMethod } from "./billingForms";
import { parseMarks } from "./bodyMap";
import { AnalysisNav, TestList } from "./measureParts";
import { mainValue, trends } from "./measures";
import { QuestionnaireTiles, SymmetryPanel } from "./outcomeParts";
import { Chips, NumberScale, PainScale, ResultBadge, sideShort, TextArea } from "./parts";
import { FieldInput } from "./FieldInput";
import { byRegions, displayName, getKind, kindOf, mapScore, OTHER, psfsScore, QUESTIONNAIRES, scoreText, type Better, type QDetails } from "./questionnaires";
import { LSI_REFERENCE, symmetryRows } from "./symmetry";
import { madridDay } from "./timeline";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { PatientShell } from "./PatientShell";
import { formFor, type Answers as FormAnswers } from "./forms";
import { FormFill, formResult } from "./FormFill";
import { SENDABLE } from "./patientForms";
import { addDays, dayText, Guard, localInput, primaryLink, sexLabels, todayDay, useLoad } from "./pageKit";
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

/** Apartados que se ven abiertos al llegar: lo que más se consulta (motivo, precauciones, diagnóstico y plan). */
const OPEN_FIRST = new Set(["motivo", "antecedentes", "diagnostico", "objetivos"]);
/** Campos con respuesta en un apartado (sin contar la fecha, que se pone sola). */
const filled = (section: Section, a: Answers) => answeredCount(a, section.fields.filter((f) => f.id !== "fecha_valoracion"));

/** Un apartado de la anamnesis que se pliega: el título, cuántos campos tiene rellenos y el contenido. */
function Fold({ id, title, count, open, children }: { id: string; title: string; count: string; open: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open || undefined} className="group scroll-mt-20 rounded-lg border border-border bg-bg shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold text-brand">{title}</span>
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
function ExplorationLinks({ id, findings, romTrends }: { id: string; findings: Finding[]; romTrends: ReturnType<typeof trends> }) {
  const current = latestFindings(findings);
  if (!current.length && !romTrends.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
      {current.length > 0 && (
        <>
          <p className="text-sm font-semibold">Tests registrados en Exploración</p>
          <ul className="flex flex-wrap gap-1.5">
            {current.map((f) => (
              <li key={f.id}>
                <Link to={`/pacientes/${id}/exploracion/${f.id}`}>
                  <ResultBadge result={f.result}>
                    {f.testName}
                    {f.side ? ` ${sideShort[f.side]}` : ""}
                  </ResultBadge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {romTrends.length > 0 && (
        <>
          <p className="text-sm font-semibold">Movilidad medida</p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {romTrends.map((t) => (
              <li key={t.title}>
                <Link to={`/tests/${t.latest.id}`} className="underline-offset-2 hover:underline">
                  {t.title}: <span className="nums font-semibold">{t.value.text}°</span> <span className="text-text-muted">({fmtDate(t.latest.performedAt)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
    const [patient, anamnesis, findings, tests, episodes, focus, current] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listFindings(db, id),
      listTests(db, id),
      listEpisodes(db, id),
      getFocus(db, id),
      currentEpisode(db, id),
    ]);
    // Viendo todos los motivos, la anamnesis es la del último abierto: se dice cuál.
    const shown = focus === ALL && episodes.length > 1 ? episodes.find((e) => e.id === current) : undefined;
    return { patient, anamnesis, findings, tests, shown, current };
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
      base.current = { ...(data.data.anamnesis?.answers ?? {}) };
      setDraft({ ...(data.data.anamnesis?.answers ?? {}) });
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
  const { patient, anamnesis, findings, tests, shown } = data.data;
  if (!patient) return <Page title="Anamnesis" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const romTrends = trends(tests.filter((t) => t.movement !== null));

  const labelOf = (fid: string) => fieldIn(sections, fid)?.label ?? fid;
  const set = (fid: string) => (v: AnswerValue) => setDraft((d) => ({ ...(d ?? {}), [fid]: v }));
  const startEdit = () => {
    base.current = { ...(anamnesis?.answers ?? {}) };
    setDraft({ ...(anamnesis?.answers ?? {}) });
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
        {/* Índice: la ficha es larga; cada apartado a un toque. */}
        <nav aria-label="Apartados de la anamnesis">
          <ul className="flex flex-wrap gap-2">
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
                  className="inline-flex min-h-9 items-center rounded-pill border border-border-input bg-bg px-3 text-sm font-semibold hover:bg-surface">
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
                <div role="group" aria-label={section.title} className="flex flex-col gap-4">
                  {section.id === "datos" && (
                    <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
                      <PatientBasics patient={patient} />
                      <Link to={`/pacientes/${id}/editar`} className="self-start text-sm font-semibold text-accent">
                        Editar nombre, nacimiento, sexo y contacto
                      </Link>
                    </div>
                  )}
                  {section.fields.map((f) =>
                    f.type === "cif" ? (
                      <CifPicker
                        key={f.id}
                        label={f.label}
                        hint={f.hint}
                        value={Array.isArray(draft[f.id]) ? (draft[f.id] as string[]) : []}
                        onChange={set(f.id)}
                        regions={Array.isArray(draft.regiones) ? (draft.regiones as string[]) : []}
                        onDraft={() => {
                          const text = draftDiagnosis(Array.isArray(draft.cif) ? (draft.cif as string[]) : []);
                          const now = typeof draft.diagnostico_funcional === "string" ? draft.diagnostico_funcional.trim() : "";
                          // Lo redactado se añade debajo de lo que ya hubiera escrito; nunca lo borra.
                          set("diagnostico_funcional")(now ? `${now}\n\n${text}` : text);
                          toast("Diagnóstico redactado con la CIF: revísalo debajo", "success");
                        }}
                      />
                    ) : (
                      <FieldInput key={f.id} field={f} value={draft[f.id]} onChange={set(f.id)} />
                    ),
                  )}
                  {section.id === "motivo" && (
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
                  )}
                  {section.id === "tratamientos" && <YellowFlagPanel answers={draft} labelOf={labelOf} patientId={id} links={false} />}
                  {section.id === "exploracion" && <ExplorationLinks id={id} findings={findings} romTrends={romTrends} />}
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-xl">Anamnesis</h2>
          {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
          <p className="text-sm text-text-muted">
            {valued ? `Valoración del ${dayText(valued)}` : `Rellenada el ${fmtDate(anamnesis.createdAt)}`}
            {anamnesis.updatedAt !== anamnesis.createdAt && ` · actualizada el ${fmtDate(anamnesis.updatedAt)}`} · {done} de {allFields.length} campos
          </p>
        </div>
        <Button variant="secondary" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={startEdit}>
          Editar anamnesis
        </Button>
      </div>
      <Link to={`/pacientes/${id}/formularios?enviar=anamnesis`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent">
        <Send aria-hidden="true" className="size-4" /> Mandar al paciente su parte para que la rellene
      </Link>
      <RedFlagPanel answers={a} birthDate={patient.birthDate} labelOf={labelOf} patientId={id} />
      <YellowFlagPanel answers={a} labelOf={labelOf} patientId={id} />
      {sections.map((section) => {
        const rows = section.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "");
        const n = filled(section, a);
        return (
          <Fold key={section.id} id={`an-${section.id}`} title={section.title} count={n ? `${n} de ${section.fields.length}` : "Sin rellenar"} open={OPEN_FIRST.has(section.id) && n > 0}>
            {section.id === "datos" && <PatientBasics patient={patient} />}
            {rows.length > 0 ? (
              <dl className="flex flex-col gap-2">
                {rows.map((f) => (
                  <div key={f.id} className="flex flex-col">
                    <dt className="text-sm text-text-muted">{f.label}</dt>
                    <dd className="whitespace-pre-line">{answerText(f, a[f.id] ?? null)}</dd>
                  </div>
                ))}
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

// ---------- Mediciones y cuestionarios ----------

/** Dentro de la pestaña Mediciones: las pruebas físicas o los cuestionarios, cada uno en su pantalla. */
function MeasureSwitch({ id, current }: { id: string; current: "pruebas" | "cuestionarios" }) {
  const item = (key: typeof current, to: string, label: string) => (
    <Link
      to={to}
      replace
      aria-current={current === key ? "page" : undefined}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm font-semibold ${current === key ? "bg-bg text-brand shadow-card" : "text-text-muted hover:text-text"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Pruebas o cuestionarios" className="flex gap-1 rounded-lg bg-surface p-1">
      {item("pruebas", `/pacientes/${id}/mediciones`, "Pruebas físicas")}
      {item("cuestionarios", `/pacientes/${id}/cuestionarios`, "Cuestionarios")}
    </nav>
  );
}

export function QuestionnairesPage() {
  const { id = "" } = useParams();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, questionnaires] = await Promise.all([getPatient(db, id), listQuestionnaires(db, id)]);
    return { patient, questionnaires };
  });
  if (!data.data) return <Guard state={data} title="Cuestionarios" back={`/pacientes/${id}`} />;
  const { patient, questionnaires } = data.data;
  return (
    <PatientShell patient={patient} id={id}>
      <MeasureSwitch id={id} current="cuestionarios" />
      <Link to={`/pacientes/${id}/cuestionarios/nuevo`} className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover">
        <ListChecks aria-hidden="true" className="size-5" /> Nuevo cuestionario
      </Link>
      {questionnaires.length ? (
        <QuestionnaireTiles patientId={id} items={questionnaires} />
      ) : (
        <EmptyState icon={ListChecks} title="Sin cuestionarios todavía">
          Se rellenan aquí pregunta a pregunta y la nota sale sola. Si el paciente lo hizo en papel, puedes anotar solo la puntuación.
        </EmptyState>
      )}
    </PatientShell>
  );
}

export function MeasurementsPage() {
  const { id = "" } = useParams();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, tests, wellness] = await Promise.all([getPatient(db, id), listTests(db, id), listWellness(db, id)]);
    return { patient, tests, wellness };
  });
  if (!data.data) return <Guard state={data} title="Mediciones" back={`/pacientes/${id}`} />;
  const { patient, tests, wellness } = data.data;
  const symmetry = symmetryRows(tests);
  const above = symmetry.filter((r) => r.lsi >= LSI_REFERENCE).length;
  return (
    <PatientShell patient={patient} id={id}>
      <MeasureSwitch id={id} current="pruebas" />
      <Link to={`/pacientes/${id}/test`} className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover">
        <Plus aria-hidden="true" className="size-5" /> Nueva medición
      </Link>
      <AnalysisNav id={id} tests={tests} wellness={wellness[0] ?? null} />

      {symmetry.length > 0 && (
        <section aria-labelledby="simetria" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="simetria" className="text-lg">
              Simetría entre lados
            </h2>
            <span className="nums text-sm text-text-muted">
              {above} de {symmetry.length} en el {LSI_REFERENCE} % o más
            </span>
          </div>
          <p className="-mt-1 text-sm text-text-muted">
            Lado peor entre lado mejor, con la última medición de cada lado. La raya marca el {LSI_REFERENCE} %, la referencia que se suele pedir para volver al deporte.
          </p>
          <SymmetryPanel rows={symmetry} />
        </section>
      )}

      {tests.length === 0 ? (
        <EmptyState icon={Activity} title="Sin mediciones todavía">
          Pulsa «Nueva medición» para registrar su primer salto, su fuerza o su movilidad.
        </EmptyState>
      ) : (
        <>
          <h2 className="text-lg">Todas las mediciones</h2>
          <TestList tests={tests} />
        </>
      )}
    </PatientShell>
  );
}

// ---------- Sesiones ----------

/** «No volver a preguntar» en la hoja del calendario que sale al guardar una sesión (de este dispositivo). La
 * siguiente cita sigue teniendo su botón de calendario en la ficha. */
const CALENDAR_PROMPT_KEY = "fisiolab.calendarPrompt.off";
function calendarPromptOff(): boolean {
  try {
    return localStorage.getItem(CALENDAR_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}
function setCalendarPromptOff() {
  try {
    localStorage.setItem(CALENDAR_PROMPT_KEY, "1");
  } catch {
    /* sin almacenamiento: volverá a preguntar */
  }
}

export function SessionsPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  // Con Google Calendar conectado la cita se apunta sola: no hace falta ofrecer el enlace.
  const autoCalendar = useAutoCalendar();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, sessions, findings, tests, count] = await Promise.all([getPatient(db, id), listSessions(db, id), listFindings(db, id), listTests(db, id), sessionCount(db, id)]);
    return { patient, sessions, findings, tests, count };
  });
  if (!data.data) return <Guard state={data} title="Sesiones" back={`/pacientes/${id}`} />;
  const { patient, sessions, findings, tests, count } = data.data;
  const review = sessions[0]?.reviewOn ?? null;
  const today = todayDay();
  // Al guardar una sesión con siguiente cita se ofrece pasarla al calendario (la próxima cita, con su botón, está en la cabecera).
  const justSaved = sessions.find((s) => s.id === params.get("calendario"));
  const justSavedEvent = justSaved && patient && !autoCalendar && !calendarPromptOff() ? visitEvent(justSaved, patient) : null;
  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Sesiones</h2>
        <Link to={`/pacientes/${id}/sesiones/nueva`} className={primaryLink}>
          <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
        </Link>
      </div>
      {count.planned !== null && <SessionMeter done={count.done} planned={count.planned} />}
      {review && (
        <Alert tone={review <= today ? "warning" : "info"} title={review < today ? `Reevaluación pendiente desde el ${dayText(review)}` : review === today ? "Reevaluar hoy" : `Próxima reevaluación: ${dayText(review)}`} />
      )}
      {sessions.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin sesiones todavía">
          Registra cada visita: el dolor de ese día, qué refiere, qué haces y cuándo reevaluar.
        </EmptyState>
      ) : (
        <ol aria-label="Sesiones" className="flex flex-col gap-3">
          {sessions.map((s, i) => (
            <SessionCard key={s.id} s={s} n={sessions.length - i} id={id} findings={findings.filter((f) => madridDay(f.performedAt) === madridDay(s.performedAt))} tests={tests.filter((t) => madridDay(t.performedAt) === madridDay(s.performedAt))} />
          ))}
        </ol>
      )}
      {justSavedEvent && (
        <CalendarSheet
          open
          onClose={() => setParams({}, { replace: true })}
          event={justSavedEvent}
          title="¿Añadir la cita a tu calendario?"
          onNever={() => {
            setCalendarPromptOff();
            setParams({}, { replace: true });
          }}
        />
      )}
    </PatientShell>
  );
}

/** Cuántas sesiones lleva de las previstas (o del bono) en este motivo de consulta. */
function SessionMeter({ done, planned }: { done: number; planned: number }) {
  const left = planned - done;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {done} de {planned} sesiones
        </span>
        <span className={cx("text-sm", left <= 0 ? "font-semibold text-warning" : "text-text-muted")}>
          {left > 1 ? `Quedan ${left}` : left === 1 ? "Queda 1" : left === 0 ? "Hechas todas" : `${-left} más de las previstas`}
        </span>
      </div>
      <div role="progressbar" aria-label="Sesiones hechas" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={Math.min(done, planned)} className="h-2 overflow-hidden rounded-pill bg-surface">
        <div className={cx("h-full rounded-pill", left <= 0 ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, (done / planned) * 100)}%` }} />
      </div>
    </Card>
  );
}

function SessionCard({ s, n, id, findings, tests }: { s: Session; n: number; id: string; findings: Finding[]; tests: Awaited<ReturnType<typeof listTests>> }) {
  const rows: [string, string][] = [
    ["Refiere", s.subjective],
    ["Encuentras", s.objective],
    ["Tratamiento", s.treatment],
    ["Plan", s.plan],
  ];
  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-semibold">Sesión {n}</span>
            <span className="text-sm text-text-muted">{fmtDateTime(s.performedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {s.pain !== null && <span className="nums rounded-pill bg-danger-soft px-2.5 py-0.5 text-sm font-semibold text-danger">Dolor {s.pain}/10</span>}
            <Link to={`/pacientes/${id}/sesiones/${s.id}`} aria-label={`Editar la sesión ${n}`} className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
              <Pencil aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
        {rows.some(([, v]) => v) && (
          <dl className="flex flex-col gap-1.5 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold">{k}</dt>
                  <dd className="whitespace-pre-line">{v}</dd>
                </div>
              ))}
          </dl>
        )}
        {(findings.length > 0 || tests.length > 0) && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ese día</span>
            <ul className="flex flex-wrap gap-1.5">
              {findings.map((f) => (
                <li key={f.id}>
                  <Link to={`/pacientes/${id}/exploracion/${f.id}`}>
                    <ResultBadge result={f.result}>
                      {f.testName}
                      {f.side ? ` ${sideShort[f.side]}` : ""}
                    </ResultBadge>
                  </Link>
                </li>
              ))}
              {tests.slice(0, 6).map((t) => {
                const v = mainValue(t);
                return (
                  <li key={t.id}>
                    <Link to={`/tests/${t.id}`} className="inline-flex min-h-7 items-center rounded-pill bg-accent-soft px-2.5 text-sm font-semibold text-accent">
                      {testTitle(t)}
                      {v ? ` · ${v.text}${v.unit === "°" ? "°" : v.unit ? ` ${v.unit}` : ""}` : " · sin marcar"}
                    </Link>
                  </li>
                );
              })}
              {tests.length > 6 && (
                <li>
                  <Link to={`/pacientes/${id}/mediciones`} className="inline-flex min-h-7 items-center rounded-pill px-2.5 text-sm font-semibold text-accent underline-offset-2 hover:underline">
                    y {tests.length - 6} mediciones más
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
        {s.nextAt && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <CalendarCheck aria-hidden="true" className="size-4 text-accent" /> Siguiente cita: {fmtVisit(s.nextAt)} · {s.nextMinutes} min
          </span>
        )}
        {s.reviewOn && (
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
            <CalendarClock aria-hidden="true" className="size-4" /> Reevaluar el {dayText(s.reviewOn)}
          </span>
        )}
      </Card>
    </li>
  );
}

export function SessionFormPage() {
  const { id = "", sid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const autoCalendar = useAutoCalendar();
  const data = useLoad(`${id}|${sid ?? ""}`, async () => {
    const db = getDb();
    const [patient, session, sessions, appointment, count] = await Promise.all([
      getPatient(db, id),
      sid ? getSession(db, sid) : null,
      listSessions(db, id),
      sid ? getAppointment(db, sid) : null,
      sessionCount(db, id),
    ]);
    // La duración de la siguiente cita: la que se usó la última vez. La sesión anterior, para repetir su tratamiento.
    return {
      patient,
      session,
      appointment,
      count,
      previous: sid ? null : (sessions[0] ?? null),
      lastMinutes: sessions.find((s) => s.nextMinutes)?.nextMinutes ?? DEFAULT_VISIT_MINUTES,
    };
  });
  // Desde una cita de la agenda («Atender»), la sesión lleva la hora de la cita, no la de ahora.
  const [query] = useSearchParams();
  const [when, setWhen] = useState(() => {
    const at = query.get("hora");
    return localInput(at && !Number.isNaN(Date.parse(at)) ? at : new Date().toISOString());
  });
  const [pain, setPain] = useState<number | null>(null);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [treatment, setTreatment] = useState("");
  const [plan, setPlan] = useState("");
  const [reviewOn, setReviewOn] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [nextMinutes, setNextMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  /** Una sesión nueva: si la paga un bono o es suelta (y cobrarla al guardar). */
  const charge = useAsync(async () => {
    if (sid) return null;
    const at = new Date(when);
    return Number.isNaN(at.getTime()) ? null : nextSessionCharge(getDb(), id, at.toISOString(), todayDay());
  }, [id, sid, when]);
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState<Method>(lastMethod);

  useEffect(() => {
    const s = data.data?.session;
    if (!s) return;
    setWhen(localInput(s.performedAt));
    setPain(s.pain);
    setSubjective(s.subjective);
    setObjective(s.objective);
    setTreatment(s.treatment);
    setPlan(s.plan);
    setReviewOn(s.reviewOn ?? "");
    // La cita que se dio en esta sesión, como está ahora en la agenda (se puede haber movido después).
    const a = data.data?.appointment;
    const next = a ? (a.status === "cancelled" ? null : a.startsAt) : s.nextAt;
    setNextAt(next ? localInput(next) : "");
    setNextMinutes(a?.minutes ?? s.nextMinutes);
  }, [data.data?.session, data.data?.appointment]);

  // Una sesión nueva sigue con la reevaluación pendiente de la anterior (si no, se perdía al guardar sin fecha).
  const carried = !sid ? (data.data?.previous?.reviewOn ?? null) : null;
  useEffect(() => {
    if (carried) setReviewOn((r) => r || carried);
  }, [carried]);

  const back = `/pacientes/${id}/sesiones`;
  if (!data.data) return <Guard state={data} title="Sesión" back={back} />;
  const { patient, session, lastMinutes, previous, count } = data.data;
  if (sid && !session) return <Page title="Sesión" backTo={back}><LoadError error={new Error("Esta sesión no existe.")} /></Page>;
  const minutes = nextMinutes ?? lastMinutes;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = nextAt ? new Date(nextAt).toISOString() : null;
      const saved = await saveSession(
        getDb(),
        id,
        { performedAt: new Date(when).toISOString(), pain, subjective, objective, treatment, plan, reviewOn: reviewOn || null, nextAt: next, nextMinutes: next ? minutes : null },
        sid,
      );
      const c = charge.data;
      if (!sid && payNow && c?.kind === "loose" && c.cents > 0) {
        rememberMethod(payMethod);
        await addPayment(getDb(), id, { amountCents: c.cents, method: payMethod, paidOn: when.slice(0, 10), concept: "Sesión de fisioterapia" });
      }
      const extra = !sid && c ? (c.kind === "pack" ? (c.leftAfter ? ` · quedan ${c.leftAfter} del bono` : " · bono gastado") : c.kind === "loose" && payNow ? ` · cobrada ${euros(c.cents)}` : "") : "";
      toast(sid ? "Sesión guardada" : `Sesión registrada${extra}`, "success");
      // Cita nueva o cambiada: se ofrece pasarla al calendario.
      const changed = next !== null && (next !== session?.nextAt || minutes !== session?.nextMinutes);
      navigate(changed ? `${back}?calendario=${saved}` : back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!sid) return;
    await deleteSession(getDb(), sid);
    toast("Sesión borrada");
    navigate(back, { replace: true });
  };
  const base = when.slice(0, 10) || todayDay();
  /** La hora de esta sesión al cuarto de hora más cercano, `n` días después. */
  const sameTimeIn = (n: number) => {
    const d = new Date(when);
    d.setDate(d.getDate() + n);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
    return Number.isNaN(d.getTime()) ? "" : localInput(d.toISOString());
  };

  return (
    <Page title={sid ? "Editar sesión" : "Nueva sesión"} backTo={back} tabs={false}>
      <p className="text-text-muted">
        {patient?.name}
        {!sid && count.planned !== null && ` · sesión ${count.done + 1} de ${count.planned}`}
      </p>
      {!sid && count.planned !== null && count.done >= count.planned && (
        <Alert tone="warning" title={`Ya lleva las ${count.planned} sesiones previstas`}>
          Si sigue, cambia el número en su anamnesis (Objetivos → Sesiones previstas).
        </Alert>
      )}
      {charge.data && charge.data.kind !== "none" && (
        <div className={cx("flex flex-col gap-2 rounded-md p-3", charge.data.kind === "pack" && charge.data.leftAfter === 0 ? "bg-warning-soft" : "bg-surface")}>
          <p className="text-sm font-semibold">
            <Wallet aria-hidden="true" className="mr-1 inline size-4 align-[-2px]" />
            {chargeText(charge.data)}
            {charge.data.kind === "pack" && charge.data.leftAfter === 0 && (
              <>
                {" "}
                ·{" "}
                <Link to={`/pacientes/${id}/cobros`} className="text-accent underline">
                  ofrécele renovarlo
                </Link>
              </>
            )}
          </p>
          {charge.data.kind === "loose" && charge.data.cents > 0 && (
            <>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-accent" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
                Cobrada ahora
              </label>
              {payNow && <MethodPicker value={payMethod} onChange={setPayMethod} name="pago-sesion" />}
            </>
          )}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <PainScale label="Dolor hoy (EVA 0-10)" value={pain} onChange={setPain} />
        <TextArea label="Qué refiere" hint="Cómo ha ido desde la última sesión, qué nota." value={subjective} onChange={setSubjective} />
        <TextArea label="Qué encuentras" hint="Exploración de hoy, cambios." value={objective} onChange={setObjective} />
        {previous && (previous.treatment || previous.plan) && (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              setTreatment(previous.treatment);
              setPlan(previous.plan);
            }}
          >
            Repetir el tratamiento de la última sesión ({fmtDate(previous.performedAt)})
          </Button>
        )}
        <TextArea label="Tratamiento" value={treatment} onChange={setTreatment} rows={4} />
        <TextArea label="Plan y ejercicios para casa" value={plan} onChange={setPlan} />
        {SHOW_EXERCISES && (
          <Link to={`/pacientes/${id}/ejercicios`} className="-mt-2 self-start text-sm font-semibold text-accent underline">
            Su hoja de ejercicios para casa (para imprimir o enviar)
          </Link>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Siguiente cita</legend>
          <div className="flex flex-wrap gap-2">
            {[7, 14].map((d) => (
              <Button key={d} variant={nextAt && nextAt === sameTimeIn(d) ? "primary" : "secondary"} size="sm" onClick={() => setNextAt(sameTimeIn(d))}>
                {d === 7 ? "Dentro de 1 semana" : "Dentro de 2 semanas"}
              </Button>
            ))}
            {nextAt && (
              <Button variant="ghost" size="sm" onClick={() => setNextAt("")}>
                Sin cita
              </Button>
            )}
          </div>
          <TextField label="Día y hora" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
          {nextAt && (
            <Chips label="Duración" options={["30", "45", "60", "90"]} render={(o) => `${o} min`} value={[String(minutes)]} onChange={(v) => v[0] && setNextMinutes(Number(v[0]))} />
          )}
          <p className="text-sm text-text-muted">Los botones la ponen a la hora de esta sesión, al cuarto de hora más cercano. {autoCalendar ? "Al guardar se apunta sola en tu Google Calendar." : "Al guardar podrás añadirla a tu calendario (Google, iPhone, Outlook…)."}</p>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Reevaluar</legend>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 28].map((d) => (
              <Button key={d} variant={reviewOn === addDays(base, d) ? "primary" : "secondary"} size="sm" onClick={() => setReviewOn(addDays(base, d))}>
                {d === 7 ? "En 1 semana" : d === 14 ? "En 2 semanas" : "En 4 semanas"}
              </Button>
            ))}
            {reviewOn && (
              <Button variant="ghost" size="sm" onClick={() => setReviewOn("")}>
                {carried && reviewOn === carried ? "Ya reevaluado hoy" : "Sin fecha"}
              </Button>
            )}
          </div>
          {carried && reviewOn === carried && (
            <p className="text-sm text-text-muted">
              Sigue la reevaluación pendiente del {dayText(carried)}. Si la haces hoy, pulsa «Ya reevaluado hoy» o pon la siguiente.
            </p>
          )}
          <TextField label="Fecha de reevaluación" type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} />
        </fieldset>
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" size="lg" block loading={saving}>
          {sid ? "Guardar cambios" : "Guardar sesión"}
        </Button>
        {sid && (
          <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
            Borrar sesión
          </Button>
        )}
      </form>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar esta sesión?">
        <p>Se borrará la sesión del {fmtDateTime(session?.performedAt ?? new Date().toISOString())}. Las mediciones y los tests de ese día no se borran.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}

// ---------- Cuestionarios ----------

/** Mapa del dolor: el dibujo y su nota (la intensidad más alta), que se ve al marcar. */
function PainMapScore({ marks, onChange }: { marks: string[]; onChange: (v: string[]) => void }) {
  const parsed = parseMarks(marks);
  let top: number | null = null;
  try {
    top = mapScore(parsed);
  } catch {
    top = null;
  }
  return (
    <>
      <BodyMapInput label="Zonas" hint="Toca en el dibujo dónde le duele o lo nota, o elígelo de la lista. Después pon la intensidad de cada zona." value={marks} onChange={onChange} />
      <p className="nums text-lg" aria-live="polite">
        Intensidad más alta: <span className="font-semibold">{top === null ? "—" : `${top}/10`}</span>
      </p>
    </>
  );
}

type PsfsActivity = { name: string; score: number | null };

export function QuestionnaireFormPage() {
  const { id = "", qid } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useLoad(`${id}|${qid ?? ""}`, async () => {
    const db = getDb();
    const [patient, record, all, anamnesis] = await Promise.all([getPatient(db, id), qid ? getQuestionnaire(db, qid) : null, listQuestionnaires(db, id), getAnamnesis(db, id)]);
    return { patient, record, all, anamnesis };
  });
  const [when, setWhen] = useState(() => localInput(new Date().toISOString()));
  const [score, setScore] = useState("");
  const [subscale, setSubscale] = useState<string[]>([]);
  const [activities, setActivities] = useState<PsfsActivity[]>([{ name: "", score: null }]);
  const [groc, setGroc] = useState<number | null>(null);
  const [marks, setMarks] = useState<string[]>([]);
  const [other, setOther] = useState<{ name: string; min: string; max: string; better: Better }>({ name: "", min: "0", max: "100", better: "higher" });
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<FormAnswers>({});
  // Los que tienen el cuestionario entero en la app se rellenan aquí; también se puede anotar solo la nota.
  const [mode, setMode] = useState<"fill" | "score">("fill");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const kind = data.data?.record?.kind ?? params.get("tipo") ?? "";
  const prefilled = useRef("");

  useEffect(() => {
    const q = data.data?.record;
    if (!q) return;
    const d = q.details as QDetails;
    setWhen(localInput(q.performedAt));
    setScore(decimalText(q.score));
    setSubscale(d.subscale ? [d.subscale] : []);
    if (d.activities?.length) setActivities(d.activities);
    if (q.kind === "groc") setGroc(q.score);
    if (d.marks) setMarks(d.marks);
    if (q.kind === OTHER) setOther({ name: d.name ?? "", min: decimalText(d.min ?? 0), max: decimalText(d.max ?? 100), better: d.better ?? "higher" });
    setAnswers(d.answers ?? {});
    setMode(d.answers ? "fill" : "score");
    setNotes(q.notes);
  }, [data.data?.record]);

  // Una PSFS nueva empieza con las actividades de la anterior: se puntúan las mismas para ver el cambio.
  useEffect(() => {
    if (qid || kind !== "psfs" || !data.data || prefilled.current === kind) return;
    prefilled.current = kind;
    const prev = data.data.all.find((q) => q.kind === "psfs");
    const names = (prev?.details as QDetails | undefined)?.activities?.map((a) => a.name) ?? [];
    if (names.length) setActivities(names.map((name) => ({ name, score: null })));
  }, [qid, kind, data.data]);

  const back = `/pacientes/${id}/cuestionarios`;
  if (!data.data) return <Guard state={data} title="Cuestionario" back={back} />;
  const { patient, record, all, anamnesis } = data.data;
  if (qid && !record) return <Page title="Cuestionario" backTo={back}><LoadError error={new Error("Este cuestionario no existe.")} /></Page>;

  if (!kind) {
    const regions = anamnesis ? clinicalSummary(anamnesis.answers).regions : [];
    const choose = (tipo: string) => setParams({ tipo }, { replace: true });
    const option = (k: { id: string; name: string; text: string; tag?: string }) => (
      <li key={k.id}>
        <button type="button" onClick={() => choose(k.id)} className="w-full text-left">
          <Card className="flex items-center gap-3 hover:border-accent">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{k.name}</span>
              <span className="text-sm text-text-muted">{k.text}</span>
            </span>
            {k.tag && <span className="shrink-0 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{k.tag}</span>}
          </Card>
        </button>
      </li>
    );
    const describe = (k: (typeof QUESTIONNAIRES)[number]) => {
      const f = formFor(k.id);
      const n = f?.sections.reduce((acc, sec) => acc + sec.items.length, 0);
      const range = k.unit && k.unit !== "%" ? k.unit : `de ${k.min} a ${k.max}, ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`;
      return `${n ? `${n} preguntas` : "Anotas la nota"} · ${range}`;
    };
    const ranked = byRegions(regions).filter(({ kind: k }) => !k.inApp);
    const TOPICS = ["Calidad de vida", "Estado de ánimo", "Dolor, miedo y creencias", "Actividad física"];
    // De su zona primero; después la evolución que cuenta el paciente, los generales por tema y el resto por zona.
    const groups = [
      { title: "De su zona", items: ranked.filter((r) => r.forRegion).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k), tag: "Su zona" })) },
      { title: "Cómo lo vive el paciente", items: QUESTIONNAIRES.filter((k) => k.inApp).map((k) => option({ id: k.id, name: k.name, text: k.hint ?? "" })) },
      ...TOPICS.map((topic) => ({
        title: topic,
        items: ranked.filter((r) => !r.forRegion && r.kind.topic === topic).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k) })),
      })),
      {
        title: "Por zona del cuerpo",
        items: [
          ...ranked.filter((r) => !r.forRegion && !r.kind.topic).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k) })),
          option({ id: OTHER, name: "Otro cuestionario", text: "Escribe su nombre y su rango." }),
        ],
      },
    ].filter((g) => g.items.length);
    return (
      <Page title="Nuevo cuestionario" backTo={back} tabs={false}>
        <p className="text-text-muted">{patient?.name}: elige el cuestionario. Se rellena aquí y la nota se calcula sola.</p>
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
            <h2 className="text-lg">{g.title}</h2>
            <ul className="flex flex-col gap-2">{g.items}</ul>
          </section>
        ))}
      </Page>
    );
  }

  const known = getKind(kind);
  const form = formFor(kind);
  const filling = !!form && mode === "fill";
  const result = filling ? formResult(form, answers) : null;
  const otherMin = parseDecimal(other.min);
  const otherMax = parseDecimal(other.max);
  const k = kindOf(kind, { name: other.name, min: otherMin ?? undefined, max: otherMax ?? undefined, better: other.better });
  const details: QDetails =
    kind === "mapa_dolor" ? { marks }
    : kind === "psfs" ? { activities: activities.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), score: a.score ?? Number.NaN })) }
    : filling ? { answers, ...(result && "ok" in result && result.ok.subscores ? { subscores: result.ok.subscores } : {}), ...(result && "ok" in result && result.ok.text ? { text: result.ok.text } : {}) }
    : known?.subscales ? { subscale: subscale[0] }
    : kind === OTHER ? { name: other.name.trim(), min: otherMin ?? undefined, max: otherMax ?? undefined, better: other.better }
    : {};
  const sameAs = (q: Questionnaire) => q.kind === kind && displayName(q.kind, q.details as QDetails) === displayName(kind, details);
  const previous = all.find((q) => q.id !== qid && sameAs(q) && (!record || q.performedAt < record.performedAt));
  const prevPsfs = all.find((q) => q.kind === "psfs" && q.id !== qid && (!record || q.performedAt < record.performedAt));
  const prevScore = (name: string) => (prevPsfs?.details as QDetails | undefined)?.activities?.find((a) => a.name === name.trim())?.score;
  // La media solo cuando cada actividad escrita tiene su puntuación.
  const named = activities.filter((a) => a.name.trim());
  const unrated = named.filter((a) => a.score === null).length;
  const psfsMean = named.length && !unrated ? named.reduce((s, a) => s + a.score!, 0) / named.length : null;

  const computeScore = (): number => {
    if (kind === "psfs") {
      if (activities.some((a) => a.name.trim() && a.score === null)) throw new RangeError("Puntúa cada actividad de 0 a 10.");
      return psfsScore(activities.map((a) => ({ name: a.name, score: a.score ?? Number.NaN })));
    }
    if (kind === "mapa_dolor") return mapScore(parseMarks(marks));
    if (kind === "groc") {
      if (groc === null) throw new RangeError("Marca cómo está respecto al inicio.");
      return groc;
    }
    if (filling) {
      if (!result || "missing" in result) throw new RangeError(result && "missing" in result ? result.missing : "Contesta el cuestionario.");
      if (result.ok.score === null) throw new RangeError("Este cuestionario solo tiene subescalas.");
      return result.ok.score;
    }
    if (known?.subscales && !subscale.length) throw new RangeError("Elige la subescala.");
    if (kind === OTHER) {
      if (!other.name.trim()) throw new RangeError("Escribe el nombre del cuestionario.");
      if (otherMin === null || otherMax === null || Number.isNaN(otherMin) || Number.isNaN(otherMax) || otherMin >= otherMax) throw new RangeError("Revisa el rango: el mínimo tiene que ser menor que el máximo.");
    }
    const v = parseDecimal(score);
    if (v === null) throw new RangeError("Escribe la puntuación.");
    if (Number.isNaN(v)) throw new RangeError("La puntuación tiene que ser un número.");
    if (v < k.min || v > k.max) throw new RangeError(`La puntuación va de ${k.min} a ${k.max}.`);
    return v;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const performedAt = new Date(when).toISOString();
      if (filling && known?.subscales) await saveSubscales(performedAt);
      else await saveQuestionnaire(getDb(), id, { kind, performedAt, score: computeScore(), details, notes }, qid);
      toast(qid ? "Cuestionario guardado" : "Cuestionario registrado", "success");
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };
  // KOOS, HOOS: una nota por subescala, cada una en su registro (así se ve la evolución de cada una), unidas por
  // `group` y con las mismas respuestas. Al editar, se cambian las del grupo; la subescala que ya no se pueda
  // calcular se borra.
  const saveSubscales = async (performedAt: string) => {
    if (!result || "missing" in result) throw new RangeError(result && "missing" in result ? result.missing : "Contesta el cuestionario.");
    const db = getDb();
    const group = (record?.details as QDetails | undefined)?.group ?? crypto.randomUUID();
    const siblings = all.filter((q) => q.kind === kind && (q.details as QDetails).group === group);
    if (record && !siblings.some((q) => q.id === record.id)) siblings.push(record);
    const subs = result.ok.subscores ?? [];
    for (const sub of subs) {
      const prev = siblings.find((q) => (q.details as QDetails).subscale === sub.name);
      await saveQuestionnaire(db, id, { kind, performedAt, score: sub.score, details: { subscale: sub.name, answers, group }, notes }, prev?.id);
    }
    for (const q of siblings) if (!subs.some((sub) => sub.name === (q.details as QDetails).subscale)) await deleteQuestionnaire(db, q.id);
  };
  const remove = async () => {
    if (!qid) return;
    await deleteQuestionnaire(getDb(), qid);
    toast("Cuestionario borrado");
    navigate(back, { replace: true });
  };
  const setActivity = (i: number, a: Partial<PsfsActivity>) => setActivities((list) => list.map((x, j) => (j === i ? { ...x, ...a } : x)));

  return (
    <Page title={qid ? "Editar cuestionario" : "Nuevo cuestionario"} backTo={back} tabs={false}>
      <p className="text-text-muted">{patient?.name}</p>
      <Card className="flex flex-col gap-2">
        <span className="text-lg font-semibold">{kind === OTHER ? "Otro cuestionario" : k.name}</span>
        {known?.hint && <p className="text-sm text-text-muted">{known.hint}</p>}
        {form && (
          <Chips
            label="Cómo"
            options={["fill", "score"]}
            render={(o) => (o === "fill" ? "Rellenarlo aquí" : "Solo anotar la nota")}
            value={[mode]}
            onChange={(v) => v[0] && setMode(v[0] as "fill" | "score")}
          />
        )}
        {!known?.inApp && kind !== OTHER && !filling && <p className="text-sm text-text-muted">Pásalo con su hoja oficial y escribe aquí la puntuación total.</p>}
        {previous && (
          <p className="text-sm">
            La última vez: <span className="nums font-semibold">{scoreText(k, previous.score)}</span> el {fmtDate(previous.performedAt)}
          </p>
        )}
        {!qid && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setParams({}, { replace: true })}>
              Cambiar de cuestionario
            </Button>
            {SENDABLE.some((x) => x.id === kind) && (
              <Link
                to={`/pacientes/${id}/formularios?enviar=${kind}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm font-semibold hover:bg-surface"
              >
                <Send aria-hidden="true" className="size-4" /> Que lo rellene en su móvil
              </Link>
            )}
          </div>
        )}
      </Card>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        {kind === OTHER && (
          <>
            <TextField label="Nombre del cuestionario" value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Mínimo" inputMode="decimal" value={other.min} onChange={(e) => setOther({ ...other, min: e.target.value })} />
              <TextField label="Máximo" inputMode="decimal" value={other.max} onChange={(e) => setOther({ ...other, max: e.target.value })} />
            </div>
            <Chips
              label="Qué es mejor"
              options={["higher", "lower"]}
              render={(o) => (o === "higher" ? "Más puntuación" : "Menos puntuación")}
              value={[other.better]}
              onChange={(v) => v[0] && setOther({ ...other, better: v[0] as Better })}
            />
          </>
        )}
        {known?.subscales && !filling && <Chips label="Subescala" options={known.subscales} value={subscale} onChange={setSubscale} />}
        {filling && form && <FormFill form={form} answers={answers} onChange={setAnswers} />}
        {filling && result && (
          <Card className="flex flex-col gap-2 border-accent" aria-live="polite">
            <h2 className="text-lg">Resultado</h2>
            {"missing" in result ? (
              <p className="text-text-muted">{result.missing}</p>
            ) : (
              <>
                {result.ok.score !== null && (
                  <p className="nums text-[2rem] leading-tight font-bold" aria-label={`Nota: ${scoreText(k, result.ok.score)}`}>
                    {scoreText(k, result.ok.score)}
                  </p>
                )}
                {result.ok.text && <p className="font-semibold">{result.ok.text}</p>}
                {result.ok.subscores && (
                  <ul className="nums flex flex-col gap-1">
                    {result.ok.subscores.map((sub) => (
                      <li key={sub.name} className="flex justify-between gap-2">
                        <span>{sub.name}</span>
                        <span className="font-semibold">
                          {known?.subscales
                            ? scoreText(kindOf(kind, { subscale: sub.name }), sub.score)
                            : `${fmt(sub.score, Number.isInteger(sub.score) ? 0 : 1)}${sub.max ? `/${sub.max}` : " %"}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
        {kind === "psfs" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Actividades</legend>
            <ol className="flex flex-col gap-3">
              {activities.map((a, i) => {
                const prev = qid ? undefined : prevScore(a.name);
                return (
                  <li key={i}>
                    <Card className="flex flex-col gap-3">
                      <TextField label={`Actividad ${i + 1}`} placeholder="Por ejemplo: bajar escaleras" value={a.name} onChange={(e) => setActivity(i, { name: e.target.value })} />
                      <NumberScale label={`Cómo hace la actividad ${i + 1}`} from={0} to={10} value={a.score} onChange={(score) => setActivity(i, { score })} ends={["0 no puede", "10 como antes"]} />
                      {prev !== undefined && <p className="nums -mt-1 text-sm text-text-muted">La última vez: {prev}/10</p>}
                      {activities.length > 1 && (
                        <Button variant="ghost" size="sm" className="self-start text-danger" onClick={() => setActivities((list) => list.filter((_, j) => j !== i))}>
                          Quitar la actividad {i + 1}
                        </Button>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
            {activities.length < 5 && (
              <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setActivities((list) => [...list, { name: "", score: null }])}>
                Añadir actividad
              </Button>
            )}
            <p className="nums text-lg" aria-live="polite">
              Media: <span className="font-semibold">{psfsMean === null ? "—" : `${fmt(psfsMean)}/10`}</span>
              {unrated > 0 && <span className="text-sm text-text-muted"> · falta puntuar {unrated === 1 ? "una actividad" : `${unrated} actividades`}</span>}
            </p>
          </fieldset>
        )}
        {kind === "mapa_dolor" && <PainMapScore marks={marks} onChange={setMarks} />}
        {kind === "groc" && (
          <NumberScale label="Respecto al inicio del tratamiento, ¿cómo está ahora?" from={-7} to={7} value={groc} onChange={setGroc} ends={["−7 muchísimo peor", "+7 muchísimo mejor"]} hint="0 igual" />
        )}
        {!known?.inApp && !filling && (
          <NumberField
            label="Puntuación"
            unit={k.unit ?? `/${fmt(k.max, Number.isInteger(k.max) ? 0 : 1)}`}
            hint={`De ${fmt(k.min, 0)} a ${fmt(k.max, 0)} · ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        )}
        <TextArea label="Notas" value={notes} onChange={setNotes} rows={2} />
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" size="lg" block loading={saving}>
          {qid ? "Guardar cambios" : "Guardar cuestionario"}
        </Button>
        {qid && (
          <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
            Borrar cuestionario
          </Button>
        )}
      </form>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar este cuestionario?">
        <p>Se borrará el registro del {fmtDate(record?.performedAt ?? new Date().toISOString())}.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
