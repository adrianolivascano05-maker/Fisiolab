// Informe de alta de un motivo de consulta, para imprimir o guardar en PDF: fechas y número de sesiones, diagnóstico,
// cómo ha cambiado (dolor, cuestionarios y mediciones, del primero al último), el tratamiento hecho y las
// recomendaciones al alta (se guardan en su anamnesis, «Recomendaciones al alta»). Más corto que el informe completo.
import { Printer } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { fmtDate, testTitle } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { SharePdf } from "./SharePdf";
import { safeName } from "../cloud/saveToDrive";
import { getAnamnesis, listQuestionnaires, listSessions, saveAnamnesis } from "../data/clinical";
import { getDb } from "../data/db";
import { ALL, currentEpisode, episodeLabel, getFocus, listEpisodes } from "../data/episodes";
import { ageOn, getClinic } from "../data/privacy";
import { getPatient, listTests } from "../data/repo";
import { Alert } from "../ui/Alert";
import { TopBar } from "../ui/AppBar";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { EpisodePicker } from "./EpisodePicker";
import { mainValue } from "./measures";
import { questionnaireGroups } from "./outcomeParts";
import { TextArea } from "./parts";
import { kindOf, scoreText, type QDetails } from "./questionnaires";
import { Block, Letterhead, SignatureLine } from "./reportParts";
import { painSeries } from "./timeline";

const th = "border-b border-border px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted";
const td = "border-b border-border px-2 py-1.5 align-top";
const day = (iso: string) => fmtDate(iso.length === 10 ? `${iso}T12:00:00` : iso);

/** «Mejor», «Peor» o «Igual», según qué sea mejor en esa escala. */
const verdict = (first: number, last: number, better: "higher" | "lower") => (last === first ? "Igual" : (last > first) === (better === "higher") ? "Mejor" : "Peor");

export function DischargePage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const article = useRef<HTMLElement>(null);
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, anamnesis, sessions, tests, questionnaires, clinic, episodes, focus, current] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listSessions(db, id),
      listTests(db, id),
      listQuestionnaires(db, id),
      getClinic(db),
      listEpisodes(db, id),
      getFocus(db, id),
      currentEpisode(db, id),
    ]);
    return { patient, anamnesis, sessions, tests, questionnaires, clinic, episodes, focus, episode: episodes.find((e) => e.id === current) ?? episodes[0]! };
  }, [id]);
  const [advice, setAdvice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const v = data.data?.anamnesis?.answers.alta_recomendaciones;
    setAdvice(typeof v === "string" ? v : "");
  }, [data.data?.anamnesis]);

  const back = `/pacientes/${id}`;
  const bar = (
    <div className="print:hidden">
      <TopBar title="Informe de alta" backTo={back} />
    </div>
  );
  const shell = (body: ReactNode) => (
    <>
      {bar}
      <main className="mx-auto max-w-3xl p-4">{body}</main>
    </>
  );
  if (data.error) return shell(<LoadError error={data.error} />);
  if (!data.data) return shell(<Loading />);
  const { patient, anamnesis, sessions, tests, questionnaires, clinic, episodes, focus, episode } = data.data;
  if (!patient) return shell(<LoadError error={new Error("Este paciente no existe.")} />);
  // Viendo todos los motivos juntos no se sabe de cuál es el alta: se elige uno.
  if (focus === ALL && episodes.length > 1)
    return shell(
      <Alert tone="info" title="¿De qué motivo de consulta es el alta?">
        <p>Estás viendo todos los motivos juntos. Elige uno:</p>
        <div className="mt-2">
          <EpisodePicker patientId={id} />
        </div>
      </Alert>,
    );

  const a = anamnesis?.answers ?? {};
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const today = new Date().toISOString();
  const ordered = [...sessions].reverse(); // de la primera a la última
  const valued = str("fecha_valoracion");
  const start = valued || ordered[0]?.performedAt || episode.startedAt;
  const years = ageOn(patient.birthDate);

  // Dolor: el primero que conste (anamnesis o primera sesión) y el último.
  const pain = painSeries({ sessions, wellness: [], anamnesis });
  // Cuestionarios: la primera y la última puntuación de cada uno.
  const qRows = questionnaireGroups(questionnaires)
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const last = g.items[0]!;
      const first = g.items.at(-1)!;
      const k = kindOf(last.kind, last.details as QDetails);
      return { name: g.name, first: scoreText(k, first.score), last: scoreText(k, last.score), n: g.items.length, change: g.items.length > 1 ? verdict(first.score, last.score, k.better) : "—" };
    });
  // Mediciones: la primera y la última de cada una.
  const mGroups = new Map<string, typeof tests>();
  for (const t of tests) if (mainValue(t)) mGroups.set(testTitle(t), [...(mGroups.get(testTitle(t)) ?? []), t]);
  const mRows = [...mGroups].map(([title, list]) => {
    const last = mainValue(list[0]!)!;
    const first = mainValue(list.at(-1)!)!;
    const text = (v: typeof last) => `${v.prefix ? `${v.prefix} ` : ""}${v.text}${v.unit === "°" ? "°" : v.unit ? ` ${v.unit}` : ""}`;
    return { title, first: text(first), last: text(last), n: list.length };
  });
  // Tratamiento: lo que se hizo en las sesiones, sin repetir, en el orden en que se empezó.
  const treatments = [...new Set(ordered.map((s) => s.treatment.trim()).filter(Boolean))].slice(0, 12);

  async function saveAdvice() {
    setSaving(true);
    try {
      await saveAnamnesis(getDb(), id, { ...(anamnesis?.answers ?? {}), alta_recomendaciones: advice.trim() });
      toast("Recomendaciones guardadas", "success");
      data.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setSaving(false);
    }
  }

  const facts: [string, string][] = [
    ["Paciente", patient.name],
    ["Edad", years !== null ? `${years} años` : "—"],
    ["Motivo de consulta", episodeLabel(episode)],
    ["Inicio", day(start)],
    ["Alta", episode.closedAt ? day(episode.closedAt) : `${day(today)} (motivo aún abierto)`],
    ["Sesiones", String(sessions.length)],
    ...(str("derivado_por") ? [["Derivado por", str("derivado_por")] as [string, string]] : []),
  ];

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden">
          {!episode.closedAt && (
            <Alert tone="info" title="Este motivo de consulta sigue abierto">
              Al darlo por terminado (arriba en la ficha, «Motivo» → «Dar por terminado») la fecha de alta queda puesta.
            </Alert>
          )}
          <TextArea
            label="Recomendaciones al alta"
            hint="Ejercicios para seguir en casa, qué vigilar, cuándo volver. Salen en el informe y se guardan en su anamnesis."
            value={advice}
            onChange={setAdvice}
          />
          <Button variant="secondary" loading={saving} onClick={() => void saveAdvice()}>
            Guardar las recomendaciones
          </Button>
          <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <SharePdf
            make={async () => {
              const { reportPdf } = await import("./reportPdf");
              return reportPdf(article.current!);
            }}
            fileName={safeName(`Alta ${patient.name} ${today.slice(0, 10)}.pdf`)}
            title="Informe de alta de fisioterapia"
          />
          <DriveSaveButton
            label="Guardar en mi Drive (PDF)"
            make={async () => {
              const { reportPdf } = await import("./reportPdf");
              return { name: safeName(`Alta ${patient.name} ${today.slice(0, 10)}.pdf`), mimeType: "application/pdf", bytes: await reportPdf(article.current!) };
            }}
          />
        </div>

        <article ref={article} aria-label="Informe de alta" className="flex flex-col gap-5 rounded-lg border border-border bg-white p-6 text-[0.9375rem] leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <Letterhead clinic={clinic} title="Informe de alta de fisioterapia" subtitle={fmtDate(today)} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-40 shrink-0 text-text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {(str("diagnostico_funcional") || str("motivo")) && (
            <Block title="Diagnóstico fisioterapéutico">
              {str("diagnostico_funcional") ? <p className="whitespace-pre-line">{str("diagnostico_funcional")}</p> : <p className="whitespace-pre-line">{str("motivo")}</p>}
            </Block>
          )}

          <Block title="Evolución">
            {pain.length === 0 && qRows.length === 0 && mRows.length === 0 ? (
              <p className="text-text-muted">No hay dolor, cuestionarios ni mediciones registrados en este motivo.</p>
            ) : (
              <div role="region" aria-label="Evolución" tabIndex={0} className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-focus">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Medida</th>
                      <th className={th}>Al inicio</th>
                      <th className={th}>Al alta</th>
                      <th className={th}>Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pain.length > 0 && (
                      <tr>
                        <td className={td}>Dolor (EVA 0-10)</td>
                        <td className={`${td} nums`}>{pain[0]!.pain}</td>
                        <td className={`${td} nums`}>{pain.at(-1)!.pain}</td>
                        <td className={td}>{pain.length > 1 ? verdict(pain[0]!.pain, pain.at(-1)!.pain, "lower") : "—"}</td>
                      </tr>
                    )}
                    {qRows.map((q) => (
                      <tr key={q.name}>
                        <td className={td}>{q.name}</td>
                        <td className={`${td} nums`}>{q.first}</td>
                        <td className={`${td} nums`}>{q.n > 1 ? q.last : "—"}</td>
                        <td className={td}>{q.change}</td>
                      </tr>
                    ))}
                    {mRows.map((m) => (
                      <tr key={m.title}>
                        <td className={td}>{m.title}</td>
                        <td className={`${td} nums`}>{m.first}</td>
                        <td className={`${td} nums`}>{m.n > 1 ? m.last : "—"}</td>
                        <td className={td}>{m.n > 1 ? `${m.n} mediciones` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Block>

          {treatments.length > 0 && (
            <Block title="Tratamiento realizado">
              <ul className="list-disc pl-5">
                {treatments.map((t) => (
                  <li key={t} className="whitespace-pre-line">
                    {t}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          <Block title="Recomendaciones al alta">
            {advice.trim() ? <p className="whitespace-pre-line">{advice.trim()}</p> : <p className="text-text-muted">—</p>}
          </Block>

          <SignatureLine name={clinic.professional} license={clinic.license} date={fmtDate(today)} />
        </article>
      </main>
    </div>
  );
}
