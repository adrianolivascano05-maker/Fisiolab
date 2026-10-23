// Pestaña Exploración de la ficha: los tests especiales registrados y el formulario para apuntar uno desde la Biblioteca
// de tests (carga los textos de la guía, por eso va aparte del resto de la ficha).
import { ExternalLink, Plus, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { MeasurementsSection, QuestionnairesSection } from "./ClinicalPages";
import { formStatus, listSentForms } from "../data/patientForms";
import { fmt, fmtDate } from "../app/format";
import { LoadError, Page } from "../app/Page";
import {
  deleteFinding,
  getAnamnesis,
  getFinding,
  latestFindings,
  listFindings,
  listQuestionnaires,
  saveFinding,
  type Finding,
  type FindingResult,
  type FindingSide,
} from "../data/clinical";
import { getDb } from "../data/db";
import { getPatient, listTests, listWellness } from "../data/repo";
import { useFavorites } from "../gallery/useFavorites";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { clinicalSummary, regionLabel } from "./anamnesis";
import { findTest, galleryRegionLabel, galleryTests, galleryUrl, resultMeaning, searchTests, testsByRegion, type SpecialTest } from "./galleryLink";
import { Chips, ResultBadge, resultLabels, TextArea } from "./parts";
import { PatientShell } from "./PatientShell";
import { Guard, localInput, useLoad } from "./pageKit";

// ---------- Exploración ----------

const resultOrder: Record<FindingResult, number> = { positive: 0, inconclusive: 1, negative: 2 };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Valoración › Exploración: los tests especiales registrados (los de la zona de la anamnesis encabezan el selector de
 * «Registrar un test»). */
function ExplorationSection({ id, findings }: { id: string; findings: Finding[] }) {
  const current = latestFindings(findings).sort((x, y) => resultOrder[x.result] - resultOrder[y.result]);
  const currentIds = new Set(current.map((f) => f.id));
  const older = findings.filter((f) => !currentIds.has(f.id));
  const count = (r: FindingResult) => current.filter((f) => f.result === r).length;
  const byRegion = new Map<string, Finding[]>();
  for (const f of current) byRegion.set(f.region, [...(byRegion.get(f.region) ?? []), f]);
  return (
    <div className="flex flex-col gap-3">
      <Link to={`/pacientes/${id}/exploracion/nuevo`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
        <Plus aria-hidden="true" className="size-5" /> Registrar un test
      </Link>
      {current.length > 0 && (
        <p className="nums flex flex-wrap gap-2 text-sm">
          <ResultBadge result="positive">{plural(count("positive"), "positivo")}</ResultBadge>
          <ResultBadge result="negative">{plural(count("negative"), "negativo")}</ResultBadge>
          {count("inconclusive") > 0 && <ResultBadge result="inconclusive">{plural(count("inconclusive"), "dudoso")}</ResultBadge>}
        </p>
      )}
      {current.length === 0 ? (
        <p className="text-sm text-text-muted">Ningún test registrado. Apunta cada test especial como positivo, negativo o dudoso; los de su zona salen primero.</p>
      ) : (
        [...byRegion].map(([region, list]) => (
          <section key={region} aria-labelledby={`ex-${region}`} className="flex flex-col gap-2">
            <h4 id={`ex-${region}`} className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              {regionLabel(region)}
            </h4>
            <ul className="flex flex-col gap-2">
              {list.map((f) => (
                <FindingRow key={f.id} f={f} id={id} />
              ))}
            </ul>
          </section>
        ))
      )}
      {older.length > 0 && (
        <details className="rounded-lg border border-border bg-bg p-3">
          <summary className="min-h-8 cursor-pointer font-semibold">Resultados anteriores ({older.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {older.map((f) => (
              <FindingRow key={f.id} f={f} id={id} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const BLOCKS = [
  { id: "exploracion", label: "Exploración" },
  { id: "cuestionarios", label: "Cuestionarios" },
  { id: "mediciones", label: "Mediciones" },
] as const;
type Block = (typeof BLOCKS)[number]["id"];
const LAST_BLOCK = "fisiolab.valoracion.bloque";
const rememberBlock = (patientId: string, b: Block) => {
  try {
    sessionStorage.setItem(`${LAST_BLOCK}.${patientId}`, b);
  } catch {
    /* sin almacenamiento */
  }
};
const lastBlock = (patientId: string): Block | null => {
  try {
    const v = sessionStorage.getItem(`${LAST_BLOCK}.${patientId}`);
    return BLOCKS.some((b) => b.id === v) ? (v as Block) : null;
  } catch {
    return null;
  }
};

/** Pestaña Valoración: Exploración, Cuestionarios y Mediciones en una página, con tres títulos y saltos entre ellos.
 * Se abre en el bloque que pide la dirección (#cuestionarios…) o en el último que se usó con este paciente. */
export function AssessmentPage() {
  const { id = "" } = useParams();
  const { hash } = useLocation();
  const data = useLoad(id, async () => {
    const db = getDb();
    const [patient, findings, questionnaires, tests, wellness, forms] = await Promise.all([
      getPatient(db, id),
      listFindings(db, id),
      listQuestionnaires(db, id),
      listTests(db, id),
      listWellness(db, id),
      listSentForms(db, id),
    ]);
    return { patient, findings, questionnaires, tests, wellness, waiting: forms.filter((f) => formStatus(f) === "pending").length };
  });
  const ready = !!data.data;
  useEffect(() => {
    if (!ready) return;
    const wanted = (hash.slice(1) as Block) || lastBlock(id);
    if (!wanted || wanted === "exploracion") return;
    document.getElementById(`valoracion-${wanted}`)?.scrollIntoView({ block: "start" });
    rememberBlock(id, wanted);
  }, [ready, hash, id]);
  if (!data.data) return <Guard state={data} title="Valoración" back={`/pacientes/${id}`} />;
  const { patient, findings, questionnaires, tests, wellness, waiting } = data.data;
  if (!patient) return <Page title="Valoración" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const head = (b: Block) => BLOCKS.find((x) => x.id === b)!.label;
  return (
    <PatientShell patient={patient} id={id}>
      <nav aria-label="Bloques de la valoración" className="flex gap-1 rounded-lg border border-border p-1">
        {BLOCKS.map((b) => (
          <a
            key={b.id}
            href={`#valoracion-${b.id}`}
            onClick={(e) => {
              e.preventDefault();
              rememberBlock(id, b.id);
              document.getElementById(`valoracion-${b.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md px-1 text-sm font-semibold text-accent hover:bg-surface"
          >
            {b.label}
          </a>
        ))}
      </nav>
      {/* En ancho (el ordenador), los bloques en columnas: Exploración y Cuestionarios a la izquierda y Mediciones a la
          derecha; en muy ancho, uno por columna. En el móvil, seguidos. */}
      <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-2 @2xl:items-start @2xl:gap-x-6 @4xl:grid-cols-3">
      <div className="flex flex-col gap-4 @4xl:contents">
      <section id="valoracion-exploracion" aria-labelledby="h-exploracion" className="flex scroll-mt-40 flex-col gap-3">
        <h2 id="h-exploracion" className="text-xl">
          {head("exploracion")}
        </h2>
        <ExplorationSection id={id} findings={findings} />
      </section>
      <section id="valoracion-cuestionarios" aria-labelledby="h-cuestionarios" className="flex scroll-mt-40 flex-col gap-3 border-t border-border pt-4 @4xl:border-t-0 @4xl:pt-0">
        <h2 id="h-cuestionarios" className="text-xl">
          {head("cuestionarios")}
        </h2>
        <QuestionnairesSection id={id} questionnaires={questionnaires} wellness={wellness[0] ?? null} waiting={waiting} />
      </section>
      </div>
      <section id="valoracion-mediciones" aria-labelledby="h-mediciones" className="flex scroll-mt-40 flex-col gap-3 border-t border-border pt-4 @2xl:border-t-0 @2xl:pt-0">
        <h2 id="h-mediciones" className="text-xl">
          {head("mediciones")}
        </h2>
        <MeasurementsSection id={id} patient={patient} tests={tests} />
      </section>
      </div>
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
  const zones = testsByRegion(regions);
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
      {!q.trim() && zones.map((g) => <Fragment key={g.region}>{group(`Tests de ${regionLabel(g.region)} (${g.tests.length})`, g.tests)}</Fragment>)}
      {!q.trim() && group("Tus favoritos de la Biblioteca", favs)}
      {!q.trim() && !zones.length && !favs.length && <p className="text-sm text-text-muted">Escribe el nombre del test. Si rellenas la zona en la anamnesis, aquí verás los de esa zona.</p>}
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

  if (!data.data) return <Guard state={data} title="Registrar un test" back={`/pacientes/${id}/exploracion`} />;
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
      <Page title="Registrar un test" backTo={back} tabs={false}>
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
    <Page title={fid ? "Editar resultado" : "Registrar un test"} backTo={back} tabs={false}>
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

