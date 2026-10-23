// Carta de derivación a su médico: los datos del paciente, por qué consulta, las alarmas encontradas en la
// anamnesis (src/clinical/redFlags.ts), su funcionamiento redactado con la CIF (el perfil de la anamnesis o, si no lo
// hay, el que proponen los datos de la ficha: dolor, cuestionarios y mediciones; con el dato que respalda cada
// calificador y sus factores personales), sus cuestionarios con cómo se leen y qué valoran dicho con las categorías
// de la CIF, el diagnóstico fisioterapéutico y lo que se le ha hecho. Sale redactada con lo que hay
// en la ficha en ese momento y todo se puede cambiar antes de imprimirla o enviarla; no se guarda.
import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { safeName } from "../cloud/saveToDrive";
import { getAnamnesis, listQuestionnaires, listSessions } from "../data/clinical";
import { getDb } from "../data/db";
import { ageOn, getClinic } from "../data/privacy";
import { getPatient, listTests } from "../data/repo";
import { TopBar } from "../ui/AppBar";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { TextArea } from "./parts";
import { loadCatalog, readEntry, type Coded } from "./cif/cif";
import { draftDiagnosis, personalFactors } from "./cif/prose";
import { autoProfile, evidenceFrom } from "./cif/suggest";
import { cifPhrases, informsText, latestQuestionnaires } from "./referral";
import { symmetryRows } from "./symmetry";
import { redFlagReview, type FlagHit, type Urgency } from "./redFlags";
import { Block, Letterhead, SignatureLine } from "./reportParts";
import { SharePdf } from "./SharePdf";

type Priority = Urgency | "ordinaria";
const PRIORITY: Record<Priority, string> = {
  urgente: "Urgente: valoración hoy",
  preferente: "Preferente: valoración en los próximos días",
  ordinaria: "Ordinaria",
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listText = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
const how = (h: FlagHit) => (h.from === "marcada" ? "" : h.from === "paciente" ? " (referido por el paciente)" : " (anotado en la anamnesis, por confirmar)");

export function ReferralPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, anamnesis, sessions, clinic, questionnaires, tests] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      getClinic(db),
      listQuestionnaires(db, id),
      listTests(db, id),
    ]);
    return { patient, anamnesis, sessions, clinic, questionnaires, tests };
  }, [id]);
  const article = useRef<HTMLElement>(null);
  const [to, setTo] = useState("A su médico de Atención Primaria");
  const [priority, setPriority] = useState<Priority>("ordinaria");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  /** El funcionamiento con la CIF, ya redactado; y si sale del perfil de la anamnesis o lo proponen los datos. */
  const [functioning, setFunctioning] = useState("");
  const [proposed, setProposed] = useState(false);
  const [withQuestionnaires, setWithQuestionnaires] = useState(true);
  /** Los títulos de la CIF y el perfil usado, para decir qué valora cada cuestionario. */
  const [cif, setCif] = useState<{ titles: Map<string, string>; profile: Coded[] }>({ titles: new Map(), profile: [] });
  const [ready, setReady] = useState(false);

  // La primera vez, la carta redactada con lo que hay en la ficha.
  useEffect(() => {
    if (ready || !data.data?.patient) return;
    const { patient, anamnesis, sessions, questionnaires, tests } = data.data;
    let live = true;
    void (async () => {
      const a = anamnesis?.answers ?? {};
      // La CIF: el perfil de la anamnesis; sin él, el que proponen el dolor, los cuestionarios y las mediciones.
      const own = Array.isArray(a.cif) ? (a.cif as string[]) : [];
      const catalog = await loadCatalog();
      const titles = new Map(catalog.map((e) => [e.code, e.title]));
      const evidence = evidenceFrom(a, sessions, questionnaires, symmetryRows(tests));
      const entries = own.length ? own : autoProfile(evidence, (c) => titles.get(c), new Set());
      if (!live) return;
      setCif({ titles, profile: entries.map(readEntry).flatMap((e) => (e ? [e.coded] : [])) });
      const { hits, patterns } = redFlagReview(a, patient.birthDate);
      const years = ageOn(patient.birthDate);
      const motivo = typeof a.motivo === "string" ? a.motivo.trim() : "";
      const phrases = cifPhrases(entries);
      setPriority(patterns[0]?.pattern.urgency ?? "ordinaria");
      setReason(
        [
          `${years !== null ? `Paciente de ${years} años` : "Paciente"}${motivo ? ` que consulta por ${lower(motivo).replace(/\.$/, "")}` : " valorado en fisioterapia"}.`,
          phrases.length ? `Según la CIF, presenta ${listText(phrases)}.` : "",
          hits.length ? `En la valoración presenta: ${listText(hits.map((h) => `${lower(h.flag.label)}${how(h)}`))}.` : "",
          patterns.length
            ? `Solicito su valoración para descartar ${listText(patterns.map((p) => lower(p.pattern.name.replace(/^Posible /, ""))))} antes de continuar con el tratamiento de fisioterapia.`
            : "Solicito su valoración.",
        ]
          .filter(Boolean)
          .join(" "),
      );
      setFunctioning(draftDiagnosis(entries, { evidence, personal: personalFactors(a, patient.birthDate) }));
      setProposed(!own.length && entries.length > 0);
      setDiagnosis(typeof a.diagnostico_funcional === "string" ? a.diagnostico_funcional : "");
      const first = sessions.at(-1);
      setTreatment(sessions.length ? `${sessions.length === 1 ? "1 sesión" : `${sessions.length} sesiones`} de fisioterapia desde el ${fmtDate(first!.performedAt)}.` : "Valoración inicial, sin tratamiento todavía.");
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [data.data, ready]);

  const bar = (
    <div className="print:hidden">
      <TopBar title="Carta de derivación" backTo={`/pacientes/${id}`} />
    </div>
  );
  if (data.error) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={data.error} /></main></>;
  if (!data.data || !ready) return <>{bar}<main className="mx-auto max-w-3xl p-4"><Loading /></main></>;
  const { patient, anamnesis, clinic, questionnaires } = data.data;
  if (!patient) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={new Error("Este paciente no existe.")} /></main></>;
  const a = anamnesis?.answers ?? {};
  const { hits, patterns } = redFlagReview(a, patient.birthDate);
  const years = ageOn(patient.birthDate);
  const results = latestQuestionnaires(questionnaires);
  const today = new Date().toISOString();
  const physio = clinic.professional || (typeof a.fisioterapeuta === "string" ? a.fisioterapeuta : "");
  const facts: [string, string][] = [
    ["Paciente", patient.name],
    ...(patient.dni ? [["DNI o NIE", patient.dni] as [string, string]] : []),
    ["Edad", years !== null ? `${years} años` : "—"],
    ...(patient.phone ? [["Teléfono", patient.phone] as [string, string]] : []),
  ];
  const fileName = safeName(`Derivacion ${patient.name} ${today.slice(0, 10)}.pdf`);

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden">
          <p className="text-sm text-text-muted">Sale redactada con lo que hay en la ficha. Revísala y cambia lo que quieras: no se guarda.</p>
          <TextField label="Dirigida a" value={to} onChange={(e) => setTo(e.target.value)} />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">Prioridad</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                <label key={p} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="prioridad" className="size-5 accent-accent" checked={priority === p} onChange={() => setPriority(p)} />
                  {PRIORITY[p]}
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label="Motivo de la derivación" value={reason} onChange={setReason} rows={5} />
          <TextArea
            label="Funcionamiento según la CIF"
            hint={
              proposed
                ? "Propuesto con los datos de la ficha (dolor, cuestionarios y mediciones), porque la anamnesis aún no tiene perfil CIF: revísalo."
                : "Del perfil CIF de la anamnesis, con el dato que respalda cada calificador y sus factores personales."
            }
            value={functioning}
            onChange={setFunctioning}
            rows={5}
          />
          <TextArea label="Diagnóstico fisioterapéutico" value={diagnosis} onChange={setDiagnosis} />
          {results.length > 0 && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-accent" checked={withQuestionnaires} onChange={(e) => setWithQuestionnaires(e.target.checked)} />
              Incluir los cuestionarios de los últimos 6 meses ({results.length})
            </label>
          )}
          <TextArea label="Tratamiento realizado y respuesta" value={treatment} onChange={setTreatment} />
          <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <SharePdf
            make={async () => {
              const { reportPdf } = await import("./reportPdf");
              return reportPdf(article.current!);
            }}
            fileName={fileName}
            title="Carta de derivación"
          />
        </div>

        <article ref={article} aria-label="Carta de derivación" className="flex flex-col gap-5 rounded-lg border border-border bg-white p-6 text-[0.9375rem] leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <Letterhead clinic={clinic} title="Informe de derivación" subtitle={fmtDate(today)} />
          <p>
            <span className="text-text-muted">A la atención de:</span> <span className="font-semibold">{to.trim() || "—"}</span>
            <br />
            <span className="text-text-muted">Prioridad:</span> <span className="font-semibold">{PRIORITY[priority]}</span>
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <Block title="Motivo de la derivación">
            <p className="whitespace-pre-line">{reason.trim() || "—"}</p>
          </Block>
          {hits.length > 0 && (
            <Block title="Signos y síntomas de alarma">
              <ul className="flex list-disc flex-col gap-0.5 pl-5">
                {hits.map((h) => (
                  <li key={h.flag.id}>
                    {h.flag.label}
                    {how(h)}
                  </li>
                ))}
              </ul>
              {patterns.length > 0 && <p className="mt-2">A descartar: {patterns.map((p) => `${lower(p.pattern.name.replace(/^Posible /, ""))} (${p.pattern.urgency})`).join("; ")}.</p>}
            </Block>
          )}
          {diagnosis.trim() && (
            <Block title="Diagnóstico fisioterapéutico">
              <p className="whitespace-pre-line">{diagnosis.trim()}</p>
            </Block>
          )}
          {functioning.trim() && (
            <Block title="Funcionamiento (CIF)">
              <p className="whitespace-pre-line">{functioning.trim()}</p>
            </Block>
          )}
          {withQuestionnaires && results.length > 0 && (
            <Block title="Cuestionarios">
              <ul className="flex list-disc flex-col gap-0.5 pl-5">
                {results.map((r) => (
                  <li key={r.key}>
                    {r.name} ({fmtDate(r.at)}): <span className="font-semibold">{r.score}</span>
                    {r.reading ? `. ${r.reading.replace(/\.$/, "")}` : ""}.
                    {r.codes.length ? ` Valora: ${informsText(r.codes, (c) => cif.titles.get(c), cif.profile)}.` : ""}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {treatment.trim() && (
            <Block title="Tratamiento de fisioterapia">
              <p className="whitespace-pre-line">{treatment.trim()}</p>
            </Block>
          )}
          <p>Quedo a su disposición para cualquier aclaración. Un saludo.</p>
          <SignatureLine name={physio} license={clinic.license} date={fmtDate(today)} />
        </article>
      </main>
    </div>
  );
}
