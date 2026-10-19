// Pantallas de la ficha clínica: anamnesis, exploración (tests especiales), mediciones (con cuestionarios y
// simetría) y sesiones.
import { Activity, CalendarCheck, CalendarClock, ClipboardList, ExternalLink, ListChecks, NotebookPen, Pencil, Plus, Search, Stethoscope, Trash } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { decimalText, fmt, fmtDate, fmtDateTime, parseDecimal, testTitle } from "../app/format";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import {
  deleteFinding,
  deleteQuestionnaire,
  deleteSession,
  getAnamnesis,
  getFinding,
  getQuestionnaire,
  getSession,
  latestFindings,
  listFindings,
  listQuestionnaires,
  listSessions,
  saveAnamnesis,
  saveFinding,
  saveQuestionnaire,
  saveSession,
  type AnswerValue,
  type Answers,
  type Finding,
  type FindingResult,
  type FindingSide,
  type Questionnaire,
  type Session,
} from "../data/clinical";
import { getDb } from "../data/db";
import { ALL, currentEpisode, episodeLabel, getFocus, listEpisodes } from "../data/episodes";
import { getPatient, listTests, listWellness, type Patient } from "../data/repo";
import { useFavorites } from "../gallery/useFavorites";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { CalendarSheet, DEFAULT_VISIT_MINUTES, fmtVisit, visitEvent } from "./CalendarButton";
import { ANAMNESIS, ALL_FIELDS, answerText, answeredCount, clinicalSummary, orphanAnswers, regionLabel, type Field } from "./anamnesis";
import { findTest, galleryRegionLabel, galleryTests, galleryUrl, resultMeaning, searchTests, testsForRegions, type SpecialTest } from "./galleryLink";
import { AnalysisNav, TestList } from "./measureParts";
import { mainValue, trends } from "./measures";
import { QuestionnaireTiles, SymmetryPanel } from "./outcomeParts";
import { Chips, NumberScale, PainScale, ResultBadge, resultLabels, sideShort, TextArea } from "./parts";
import { byRegions, displayName, getKind, kindOf, OTHER, psfsScore, QUESTIONNAIRES, scoreText, type Better, type QDetails } from "./questionnaires";
import { LSI_REFERENCE, symmetryRows } from "./symmetry";
import { madridDay } from "./timeline";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { PatientShell } from "./PatientShell";
import { formFor, type Answers as FormAnswers } from "./forms";
import { FormFill, formResult } from "./FormFill";

// ---------- Utilidades ----------

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → valor de un <input type="datetime-local"> en la hora del dispositivo. */
const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const todayDay = () => localInput(new Date().toISOString()).slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localInput(d.toISOString()).slice(0, 10);
};
const dayText = (day: string) => fmtDate(`${day}T12:00:00`);

function age(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}
const sexLabels = { female: "Mujer", male: "Hombre", other: "Otro" } as const;

/** Página de una pestaña de la ficha: título con el nombre, pestañas y el contenido. */
function useLoad<T>(id: string, load: () => Promise<T>) {
  return useAsync(load, [id]);
}

function Guard({ state, title, back }: { state: { error: Error | null; data: unknown }; title: string; back: string }) {
  if (state.error) return <Page title={title} backTo={back}><LoadError error={state.error} /></Page>;
  return <Page title={title} backTo={back}><Loading /></Page>;
}

const primaryLink = "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover";

// ---------- Anamnesis ----------

function FieldInput({ field, value, onChange }: { field: Field; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const s = typeof value === "string" ? value : "";
  switch (field.type) {
    case "text":
      return <TextField label={field.label} hint={field.hint} value={s} inputMode={field.inputMode} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <TextField label={field.label} hint={field.hint} type="date" value={s} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <TextArea label={field.label} hint={field.hint} value={s} rows={field.rows ?? 3} onChange={onChange} />;
    case "scale":
      return <PainScale label={field.label} hint={field.hint} value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "choice":
    case "multi":
      return (
        <Chips
          label={field.label}
          hint={field.hint}
          options={field.options}
          multiple={field.type === "multi"}
          value={Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []}
          onChange={(v) => onChange(field.type === "multi" ? v : (v[0] ?? null))}
          render={field.id === "regiones" ? regionLabel : undefined}
        />
      );
    case "number":
      return <TextField label={`${field.label} (${field.unit})`} hint={field.hint} inputMode="decimal" value={typeof value === "number" ? String(value).replace(".", ",") : s} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Nombre, edad y sexo vienen de los datos del paciente (se editan allí). */
function PatientBasics({ patient }: { patient: Patient }) {
  const years = age(patient.birthDate);
  const rows: [string, string][] = [
    ["Nombre y apellidos", patient.name],
    ["Fecha de nacimiento", patient.birthDate ? fmtDate(`${patient.birthDate}T12:00:00`) : "—"],
    ["Edad", years !== null ? `${years} años` : "—"],
    ["Sexo", patient.sex ? sexLabels[patient.sex] : "—"],
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

  // Sin anamnesis todavía: se empieza directamente a rellenar, con la fecha de hoy (solo al entrar). Recién creado un
  // motivo de consulta, en cuanto llega su anamnesis (la que ya trae los datos personales).
  useEffect(() => {
    if (!data.data) return;
    if (editEpisode && data.data.current === editEpisode) {
      autoStarted.current = true;
      setDraft({ ...(data.data.anamnesis?.answers ?? {}) });
      setEditing(true);
      navigate(".", { replace: true, state: null });
    } else if (!data.data.anamnesis && !autoStarted.current) {
      autoStarted.current = true;
      setDraft({ fecha_valoracion: todayDay() });
      setEditing(true);
    }
  }, [data.data, editEpisode, navigate]);

  if (!data.data) return <Guard state={data} title="Anamnesis" back={`/pacientes/${id}`} />;
  const { patient, anamnesis, findings, tests, shown } = data.data;
  if (!patient) return <Page title="Anamnesis" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const romTrends = trends(tests.filter((t) => t.movement !== null));

  const set = (fid: string) => (v: AnswerValue) => setDraft((d) => ({ ...(d ?? {}), [fid]: v }));
  const startEdit = () => {
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
      await saveAnamnesis(getDb(), id, draft);
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
            {ANAMNESIS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#anamnesis-${section.id}`}
                  onClick={(e) => {
                    // Sin tocar la dirección: «Volver» sigue llevando a la ficha.
                    e.preventDefault();
                    document.getElementById(`anamnesis-${section.id}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex min-h-9 items-center rounded-pill border border-border-input bg-bg px-3 text-sm font-semibold hover:bg-surface">
                  {section.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {ANAMNESIS.map((section) => (
            <fieldset key={section.id} id={`anamnesis-${section.id}`} className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-border bg-bg p-4 shadow-card">
              <legend className="float-left mb-1 w-full text-lg font-semibold text-brand">{section.title}</legend>
              {section.id === "datos" && (
                <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
                  <PatientBasics patient={patient} />
                  <Link to={`/pacientes/${id}/editar`} className="self-start text-sm font-semibold text-accent">
                    Editar nombre, nacimiento y sexo
                  </Link>
                </div>
              )}
              {section.fields.map((f) => (
                <FieldInput key={f.id} field={f} value={draft[f.id]} onChange={set(f.id)} />
              ))}
              {section.id === "exploracion" && <ExplorationLinks id={id} findings={findings} romTrends={romTrends} />}
            </fieldset>
          ))}
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
  const done = answeredCount(a);
  const valued = typeof a.fecha_valoracion === "string" ? a.fecha_valoracion : null;
  const orphans = orphanAnswers(a);
  const red = clinicalSummary(a).redFlags;
  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-xl">Anamnesis</h2>
          {shown && <p className="text-sm font-semibold">Del motivo «{episodeLabel(shown)}»</p>}
          <p className="text-sm text-text-muted">
            {valued ? `Valoración del ${dayText(valued)}` : `Rellenada el ${fmtDate(anamnesis.createdAt)}`}
            {anamnesis.updatedAt !== anamnesis.createdAt && ` · actualizada el ${fmtDate(anamnesis.updatedAt)}`} · {done} de {ALL_FIELDS.length} campos
          </p>
        </div>
        <Button variant="secondary" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={startEdit}>
          Editar
        </Button>
      </div>
      {red.length > 0 && (
        <Alert tone="danger" title={`Banderas rojas: ${red.length}`}>
          {red.join(" · ")}. Valora derivar.
        </Alert>
      )}
      {ANAMNESIS.map((section) => {
        const rows = section.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "");
        return (
          <section key={section.id} aria-labelledby={`an-${section.id}`} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-4 shadow-card">
            <h3 id={`an-${section.id}`} className="text-lg text-brand">
              {section.title}
            </h3>
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
          </section>
        );
      })}
      {orphans.length > 0 && (
        <section aria-labelledby="an-otros" className="flex flex-col gap-2 rounded-lg border border-dashed border-border-input p-4">
          <h3 id="an-otros" className="text-lg">
            Otros datos guardados
          </h3>
          <dl className="flex flex-col gap-2">
            {orphans.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-sm text-text-muted">{k}</dt>
                <dd>{answerText(undefined, v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </PatientShell>
  );
}

// ---------- Exploración ----------

const resultOrder: Record<FindingResult, number> = { positive: 0, inconclusive: 1, negative: 2 };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function ExplorationPage() {
  const { id = "" } = useParams();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, findings, anamnesis] = await Promise.all([getPatient(db, id), listFindings(db, id), getAnamnesis(db, id)]);
    return { patient, findings, anamnesis };
  });
  if (!data.data) return <Guard state={data} title="Exploración" back={`/pacientes/${id}`} />;
  const { patient, findings, anamnesis } = data.data;
  const current = latestFindings(findings).sort((x, y) => resultOrder[x.result] - resultOrder[y.result]);
  const currentIds = new Set(current.map((f) => f.id));
  const older = findings.filter((f) => !currentIds.has(f.id));
  const count = (r: FindingResult) => current.filter((f) => f.result === r).length;
  const regions = anamnesis ? clinicalSummary(anamnesis.answers).regions : [];
  const done = new Set(findings.map((f) => f.galleryTest));
  const suggested = testsForRegions(regions).filter((t) => !done.has(t.id)).slice(0, 6);
  const byRegion = new Map<string, Finding[]>();
  for (const f of current) byRegion.set(f.region, [...(byRegion.get(f.region) ?? []), f]);

  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Exploración</h2>
        <Link to={`/pacientes/${id}/exploracion/nuevo`} className={primaryLink}>
          <Plus aria-hidden="true" className="size-5" /> Nuevo test
        </Link>
      </div>
      {current.length > 0 && (
        <p className="nums flex flex-wrap gap-2 text-sm">
          <ResultBadge result="positive">{plural(count("positive"), "positivo")}</ResultBadge>
          <ResultBadge result="negative">{plural(count("negative"), "negativo")}</ResultBadge>
          {count("inconclusive") > 0 && <ResultBadge result="inconclusive">{plural(count("inconclusive"), "dudoso")}</ResultBadge>}
        </p>
      )}
      {current.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Ningún test registrado">
          Registra cada test especial que hagas como positivo, negativo o dudoso. También puedes hacerlo desde la Guía de tests, en la ficha de cada test.
        </EmptyState>
      ) : (
        [...byRegion].map(([region, list]) => (
          <section key={region} aria-labelledby={`ex-${region}`} className="flex flex-col gap-2">
            <h3 id={`ex-${region}`} className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              {regionLabel(region)}
            </h3>
            <ul className="flex flex-col gap-2">
              {list.map((f) => (
                <FindingRow key={f.id} f={f} id={id} />
              ))}
            </ul>
          </section>
        ))
      )}
      {suggested.length > 0 && (
        <section aria-labelledby="ex-sug" className="flex flex-col gap-2">
          <h3 id="ex-sug" className="text-lg">
            Tests de la zona
          </h3>
          <p className="text-sm text-text-muted">Según la anamnesis ({regions.map(regionLabel).join(", ")}), de más a menos útiles.</p>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
            {suggested.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{t.name}</span>
                  <span className="truncate text-sm text-text-muted">{t.group}</span>
                </span>
                <Link to={`/pacientes/${id}/exploracion/nuevo?test=${t.id}`} className="tap inline-flex items-center rounded-md px-3 text-sm font-semibold text-accent hover:bg-accent-soft">
                  Registrar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {older.length > 0 && (
        <details className="rounded-lg border border-border bg-bg p-3">
          <summary className="cursor-pointer font-semibold">Resultados anteriores ({older.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {older.map((f) => (
              <FindingRow key={f.id} f={f} id={id} />
            ))}
          </ul>
        </details>
      )}
    </PatientShell>
  );
}

function FindingRow({ f, id }: { f: Finding; id: string }) {
  const meaning = resultMeaning(findTest(f.galleryTest), f.result);
  return (
    <li>
      <Link to={`/pacientes/${id}/exploracion/${f.id}`} className="block">
        <Card className="flex flex-col gap-1.5 hover:border-accent">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {f.testName}
              {f.side && <span className="font-normal text-text-muted"> · {f.side === "both" ? "ambos lados" : f.side === "left" ? "izquierdo" : "derecho"}</span>}
            </span>
            <ResultBadge result={f.result} />
          </span>
          <span className="text-sm text-text-muted">{fmtDate(f.performedAt)}</span>
          {meaning && (
            <span className="text-sm">
              {f.result === "positive" ? "LR+" : "LR−"} {fmt(meaning.lr, f.result === "positive" ? 1 : 2)} · {meaning.text}
            </span>
          )}
          {f.notes && <span className="text-sm whitespace-pre-line">{f.notes}</span>}
        </Card>
      </Link>
    </li>
  );
}

const sideOptions: { v: FindingSide | null; label: string }[] = [
  { v: "right", label: "Derecho" },
  { v: "left", label: "Izquierdo" },
  { v: "both", label: "Los dos" },
  { v: null, label: "No aplica" },
];
const sideFromAnamnesis = (lado: string): FindingSide | null => (lado === "Derecho" ? "right" : lado === "Izquierdo" ? "left" : lado === "Los dos" ? "both" : null);

/** Elegir el test: buscador, favoritos de la galería y los de la zona de la anamnesis. */
function TestPicker({ regions, onPick }: { regions: string[]; onPick: (t: SpecialTest) => void }) {
  const [q, setQ] = useState("");
  const { favorites } = useFavorites();
  const found = useMemo(() => searchTests(q), [q]);
  const favs = favorites.map(findTest).filter((t): t is SpecialTest => !!t);
  const zone = testsForRegions(regions).slice(0, 12);
  const group = (title: string, list: SpecialTest[]) =>
    list.length > 0 && (
      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
          {list.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onPick(t)} className="flex min-h-14 w-full flex-col items-start px-3 py-2 text-left hover:bg-surface">
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm text-text-muted">
                  {galleryRegionLabel(t)} · {t.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          aria-label="Buscar test"
          placeholder={`Buscar entre ${galleryTests.length} tests: Lachman, Neer…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 w-full rounded-md border border-border-input bg-bg pr-3 pl-10 text-base"
        />
      </div>
      {q.trim() ? (found.length ? group("Resultados", found) : <p className="text-sm text-text-muted">Ningún test se llama así.</p>) : null}
      {!q.trim() && group(`Tests de la zona (${regions.map(regionLabel).join(", ")})`, zone)}
      {!q.trim() && group("Tus favoritos de la Guía de tests", favs)}
      {!q.trim() && !zone.length && !favs.length && <p className="text-sm text-text-muted">Escribe el nombre del test. Si rellenas la zona en la anamnesis, aquí verás los de esa zona.</p>}
    </div>
  );
}

export function FindingFormPage() {
  const { id = "", fid } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useLoad(`${id}|${fid ?? ""}`, async () => {
    const db = getDb();
    const [patient, finding, anamnesis] = await Promise.all([getPatient(db, id), fid ? getFinding(db, fid) : null, getAnamnesis(db, id)]);
    return { patient, finding, anamnesis };
  });
  const [result, setResult] = useState<FindingResult | null>(null);
  const [side, setSide] = useState<FindingSide | null | undefined>(undefined);
  const [when, setWhen] = useState(() => localInput(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const f = data.data?.finding;
    if (!f) return;
    setResult(f.result);
    setSide(f.side);
    setWhen(localInput(f.performedAt));
    setNotes(f.notes);
  }, [data.data?.finding]);

  if (!data.data) return <Guard state={data} title="Test de exploración" back={`/pacientes/${id}/exploracion`} />;
  const { patient, finding, anamnesis } = data.data;
  const back = `/pacientes/${id}/exploracion`;
  if (fid && !finding) return <Page title="Test" backTo={back}><LoadError error={new Error("Este resultado no existe.")} /></Page>;
  const summary = anamnesis ? clinicalSummary(anamnesis.answers) : null;
  const testId = finding?.galleryTest ?? params.get("test");
  const test = testId ? findTest(testId) : undefined;
  const chosenSide = side === undefined ? sideFromAnamnesis(summary?.side ?? "") : side;
  const meaning = result ? resultMeaning(test, result) : null;

  if (!testId) {
    return (
      <Page title="Test de exploración" backTo={back} tabs={false}>
        <p className="text-text-muted">{patient?.name}: elige el test que has hecho.</p>
        <TestPicker regions={summary?.regions ?? []} onPick={(t) => setParams({ test: t.id }, { replace: true })} />
      </Page>
    );
  }
  const name = test?.name ?? finding?.testName ?? testId;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!result) {
      setError("Marca si ha sido positivo, negativo o dudoso.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveFinding(
        getDb(),
        id,
        {
          galleryTest: testId,
          testName: name,
          region: test?.region ?? finding?.region ?? "",
          performedAt: new Date(when).toISOString(),
          side: chosenSide,
          result,
          notes,
        },
        fid,
      );
      toast(`${name}: ${resultLabels[result].toLowerCase()}`, "success");
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!fid) return;
    await deleteFinding(getDb(), fid);
    toast("Resultado borrado");
    navigate(back, { replace: true });
  };

  return (
    <Page title={fid ? "Editar resultado" : "Test de exploración"} backTo={back} tabs={false}>
      <Card className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {patient?.name} · {test ? `${galleryRegionLabel(test)} · ${test.group}` : regionLabel(finding?.region ?? "")}
        </span>
        <span className="text-lg font-semibold">{name}</span>
        {test && <span className="text-sm">Positivo si: {test.positive}</span>}
        <span className="flex flex-wrap gap-3">
          {test && (
            <Link to={`${galleryUrl(test)}?paciente=${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
              <ExternalLink aria-hidden="true" className="size-4" /> Ver cómo se hace
            </Link>
          )}
          {!fid && (
            <button type="button" onClick={() => setParams({}, { replace: true })} className="text-sm font-semibold text-accent">
              Cambiar de test
            </button>
          )}
        </span>
      </Card>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Resultado</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["positive", "negative", "inconclusive"] as const).map((r) => (
              <label key={r} className="relative">
                <input type="radio" name="result" checked={result === r} onChange={() => setResult(r)} className="peer sr-only" />
                <span
                  className={cx(
                    "flex h-14 items-center justify-center rounded-md border text-base font-semibold",
                    "border-border-input bg-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                    r === "positive" && "peer-checked:border-danger peer-checked:bg-danger peer-checked:text-on-accent",
                    r === "negative" && "peer-checked:border-text peer-checked:bg-text peer-checked:text-bg",
                    r === "inconclusive" && "peer-checked:border-warning peer-checked:bg-warning peer-checked:text-on-accent",
                  )}
                >
                  {resultLabels[r]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {meaning && (
          <Alert tone={result === "positive" ? "warning" : "info"} title={`${result === "positive" ? "LR+" : "LR−"} ${fmt(meaning.lr, result === "positive" ? 1 : 2)} · ${meaning.text}`}>
            Según {meaning.source}. Combínalo con el resto de la exploración.
          </Alert>
        )}
        <Chips
          label="Lado"
          options={sideOptions.map((o) => o.label)}
          value={[sideOptions.find((o) => o.v === chosenSide)!.label]}
          onChange={(v) => setSide(sideOptions.find((o) => o.label === v[0])?.v ?? null)}
        />
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <TextArea label="Notas" hint="Qué notaste: dolor, tope blando, aprensión…" value={notes} onChange={setNotes} />
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" size="lg" block loading={saving}>
          {fid ? "Guardar cambios" : "Guardar resultado"}
        </Button>
        {fid && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
            Borrar este resultado
          </Button>
        )}
      </form>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar este resultado?">
        <p>Se borrará el resultado de {name} del {fmtDate(finding?.performedAt ?? new Date().toISOString())}.</p>
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

// ---------- Mediciones ----------

export function MeasurementsPage() {
  const { id = "" } = useParams();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, tests, wellness, questionnaires] = await Promise.all([getPatient(db, id), listTests(db, id), listWellness(db, id), listQuestionnaires(db, id)]);
    return { patient, tests, wellness, questionnaires };
  });
  if (!data.data) return <Guard state={data} title="Mediciones" back={`/pacientes/${id}`} />;
  const { patient, tests, wellness, questionnaires } = data.data;
  const symmetry = symmetryRows(tests);
  const above = symmetry.filter((r) => r.lsi >= LSI_REFERENCE).length;
  return (
    <PatientShell patient={patient} id={id}>
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

      <section aria-labelledby="cuestionarios" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cuestionarios" className="text-lg">
            Cuestionarios
          </h2>
          <Link to={`/pacientes/${id}/cuestionarios/nuevo`} className={primaryLink}>
            <ListChecks aria-hidden="true" className="size-5" /> Nuevo cuestionario
          </Link>
        </div>
        {questionnaires.length ? (
          <QuestionnaireTiles patientId={id} items={questionnaires} />
        ) : (
          <p className="text-sm text-text-muted">La PSFS y el cambio global se contestan aquí; de KOOS, LEFS, NDI y los demás se anota la puntuación de su hoja.</p>
        )}
      </section>

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

export function SessionsPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  // Con Google Calendar conectado la cita se apunta sola: no hace falta ofrecer el enlace.
  const autoCalendar = useAutoCalendar();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, sessions, findings, tests] = await Promise.all([getPatient(db, id), listSessions(db, id), listFindings(db, id), listTests(db, id)]);
    return { patient, sessions, findings, tests };
  });
  if (!data.data) return <Guard state={data} title="Sesiones" back={`/pacientes/${id}`} />;
  const { patient, sessions, findings, tests } = data.data;
  const review = sessions[0]?.reviewOn ?? null;
  const today = todayDay();
  // Al guardar una sesión con siguiente cita se ofrece pasarla al calendario (la próxima cita, con su botón, está en la cabecera).
  const justSaved = sessions.find((s) => s.id === params.get("calendario"));
  const justSavedEvent = justSaved && patient && !autoCalendar ? visitEvent(justSaved, patient) : null;
  return (
    <PatientShell patient={patient} id={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Sesiones</h2>
        <Link to={`/pacientes/${id}/sesiones/nueva`} className={primaryLink}>
          <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
        </Link>
      </div>
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
        <CalendarSheet open onClose={() => setParams({}, { replace: true })} event={justSavedEvent} title="¿Añadir la cita a tu calendario?" />
      )}
    </PatientShell>
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
    const [patient, session, sessions] = await Promise.all([getPatient(db, id), sid ? getSession(db, sid) : null, listSessions(db, id)]);
    // La duración de la siguiente cita: la que se usó la última vez.
    return { patient, session, lastMinutes: sessions.find((s) => s.nextMinutes)?.nextMinutes ?? DEFAULT_VISIT_MINUTES };
  });
  const [when, setWhen] = useState(() => localInput(new Date().toISOString()));
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
    setNextAt(s.nextAt ? localInput(s.nextAt) : "");
    setNextMinutes(s.nextMinutes);
  }, [data.data?.session]);

  const back = `/pacientes/${id}/sesiones`;
  if (!data.data) return <Guard state={data} title="Sesión" back={back} />;
  const { patient, session, lastMinutes } = data.data;
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
      toast(sid ? "Sesión guardada" : "Sesión registrada", "success");
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
      <p className="text-text-muted">{patient?.name}</p>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <PainScale label="Dolor hoy (EVA 0-10)" value={pain} onChange={setPain} />
        <TextArea label="Qué refiere" hint="Cómo ha ido desde la última sesión, qué nota." value={subjective} onChange={setSubjective} />
        <TextArea label="Qué encuentras" hint="Exploración de hoy, cambios." value={objective} onChange={setObjective} />
        <TextArea label="Tratamiento" value={treatment} onChange={setTreatment} rows={4} />
        <TextArea label="Plan y ejercicios para casa" value={plan} onChange={setPlan} />
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
                Sin fecha
              </Button>
            )}
          </div>
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

  const back = `/pacientes/${id}/mediciones`;
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
    return (
      <Page title="Nuevo cuestionario" backTo={back} tabs={false}>
        <p className="text-text-muted">{patient?.name}: elige el cuestionario. Se rellena aquí y la nota se calcula sola.</p>
        <ul className="flex flex-col gap-2">
          {QUESTIONNAIRES.filter((k) => k.inApp).map((k) => option({ id: k.id, name: k.name, text: k.hint ?? "" }))}
          {byRegions(regions)
            .filter(({ kind: k }) => !k.inApp)
            .map(({ kind: k, forRegion }) => {
              const f = formFor(k.id);
              const how = !f ? "Anotas la nota" : f.sheet ? "Con su hoja oficial: marcas las respuestas" : `${f.sections.reduce((n, s) => n + s.items.length, 0)} preguntas`;
              return option({ id: k.id, name: k.name, text: `${how} · de ${k.min} a ${k.max}, ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`, tag: forRegion ? "Su zona" : undefined });
            })}
          {option({ id: OTHER, name: "Otro cuestionario", text: "Escribe su nombre y su rango." })}
        </ul>
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
    kind === "psfs" ? { activities: activities.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), score: a.score ?? Number.NaN })) }
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
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setParams({}, { replace: true })}>
            Cambiar de cuestionario
          </Button>
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
                        <span className="font-semibold">{fmt(sub.score, Number.isInteger(sub.score) ? 0 : 1)}{known?.subscales ? "/100" : " %"}</span>
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
