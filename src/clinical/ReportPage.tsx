// Informe del paciente para imprimir o guardar en PDF desde el navegador: datos, anamnesis, exploración,
// evolución del dolor, mediciones (con la simetría entre lados), cuestionarios y sesiones. Se eligen los apartados; en papel solo sale el informe.
import { Printer } from "lucide-react";
import { TopBar } from "../ui/AppBar";
import { useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { fmt, fmtDate, fmtDateShort } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getAnamnesis, latestFindings, listFindings, listQuestionnaires, listSessions } from "../data/clinical";
import { getDb } from "../data/db";
import { getPatient, listTests, listWellness } from "../data/repo";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { Button } from "../ui/Button";
import { LogoMark } from "../ui/Logo";
import { ANAMNESIS, answerText } from "./anamnesis";
import { findTest, resultMeaning } from "./galleryLink";
import { trends } from "./measures";
import { questionnaireGroups } from "./outcomeParts";
import { PainChart, resultLabels } from "./parts";
import { kindOf, scoreText, type QDetails } from "./questionnaires";
import { LSI_REFERENCE, symmetryRows } from "./symmetry";
import { painSeries } from "./timeline";

const sexLabels = { female: "Mujer", male: "Hombre", other: "Otro" } as const;
const sideText = { left: "Izquierdo", right: "Derecho", both: "Los dos" } as const;
type Part = "anamnesis" | "exploracion" | "dolor" | "mediciones" | "cuestionarios" | "sesiones";
const PARTS: { id: Part; label: string }[] = [
  { id: "anamnesis", label: "Anamnesis" },
  { id: "exploracion", label: "Exploración" },
  { id: "dolor", label: "Evolución del dolor" },
  { id: "mediciones", label: "Mediciones" },
  { id: "cuestionarios", label: "Cuestionarios" },
  { id: "sesiones", label: "Sesiones" },
];

function age(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="break-after-avoid border-b-2 border-brand pb-1 text-lg text-brand">{title}</h2>
      {children}
    </section>
  );
}

/** Tabla ancha: en el móvil se desplaza a los lados, también con el teclado. */
function Scroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-focus">
      {children}
    </div>
  );
}

const th = "border-b border-border px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted";
const td = "border-b border-border px-2 py-1.5 align-top";

export function ReportPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, anamnesis, findings, sessions, tests, wellness, questionnaires] = await Promise.all([
      getPatient(db, id),
      getAnamnesis(db, id),
      listFindings(db, id),
      listSessions(db, id),
      listTests(db, id),
      listWellness(db, id),
      listQuestionnaires(db, id),
    ]);
    return { patient, anamnesis, findings, sessions, tests, wellness, questionnaires };
  }, [id]);
  const article = useRef<HTMLElement>(null);
  const [parts, setParts] = useState<Record<Part, boolean>>({ anamnesis: true, exploracion: true, dolor: true, mediciones: true, cuestionarios: true, sesiones: true });

  const back = `/pacientes/${id}`;
  const bar = (
    <div className="print:hidden">
      <TopBar title="Informe" backTo={back} />
    </div>
  );
  if (data.error) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={data.error} /></main></>;
  if (!data.data) return <>{bar}<main className="mx-auto max-w-3xl p-4"><Loading /></main></>;
  const { patient, anamnesis, findings, sessions, tests, wellness, questionnaires } = data.data;
  if (!patient) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={new Error("Este paciente no existe.")} /></main></>;

  const a = anamnesis?.answers ?? {};
  const years = age(patient.birthDate);
  const valued = typeof a.fecha_valoracion === "string" ? a.fecha_valoracion : null;
  const pain = painSeries({ sessions, wellness, anamnesis });
  const current = latestFindings(findings);
  const tr = trends(tests);
  const symmetry = symmetryRows(tests);
  const qGroups = questionnaireGroups(questionnaires);
  const physio = typeof a.fisioterapeuta === "string" ? a.fisioterapeuta : "";
  const today = new Date().toISOString();
  // Apartados de la anamnesis con algo escrito (la exploración física va con los tests).
  const sections = ANAMNESIS.filter((s) => s.id !== "exploracion")
    .map((s) => ({ s, rows: s.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "" && !["fecha_valoracion", "fisioterapeuta"].includes(f.id)) }))
    .filter((x) => x.rows.length);
  const examText = ANAMNESIS.find((s) => s.id === "exploracion")!.fields.filter((f) => answerText(f, a[f.id] ?? null) !== "");
  const facts: [string, string][] = [
    ["Paciente", patient.name],
    ["Edad", years !== null ? `${years} años` : "—"],
    ["Sexo", patient.sex ? sexLabels[patient.sex] : "—"],
    ["Fecha de la valoración", valued ? fmtDate(`${valued}T12:00:00`) : anamnesis ? fmtDate(anamnesis.createdAt) : "—"],
    ...(typeof a.derivado_por === "string" && a.derivado_por ? [["Derivado por", a.derivado_por] as [string, string]] : []),
    ...(patient.bodyMassKg ? [["Masa", `${fmt(patient.bodyMassKg)} kg`] as [string, string]] : []),
    ...(patient.heightCm ? [["Estatura", `${fmt(patient.heightCm, 0)} cm`] as [string, string]] : []),
  ];

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 14mm 14mm 16mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">Qué incluir</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PARTS.map((p) => (
                <label key={p.id} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" className="size-5 accent-accent" checked={parts[p.id]} onChange={(e) => setParts({ ...parts, [p.id]: e.target.checked })} />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir o guardar en PDF
          </Button>
          <p className="text-sm text-text-muted">En el diálogo de impresión, elige «Guardar como PDF» para tenerlo en un archivo.</p>
          <DriveSaveButton
            label="Guardar en mi Drive (PDF)"
            make={async () => {
              const { reportPdf } = await import("./reportPdf");
              return {
                name: safeName(`Informe ${patient.name} ${today.slice(0, 10)}.pdf`),
                mimeType: "application/pdf",
                bytes: await reportPdf(article.current!),
              };
            }}
          />
        </div>

        <article ref={article} aria-label="Informe" className="flex flex-col gap-5 rounded-lg border border-border bg-white p-6 text-[0.9375rem] leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
                Informe de fisioterapia
              </span>
              <span className="text-sm text-text-muted">Historia clínica y evolución · {fmtDate(today)}</span>
            </div>
            <span className="flex items-center gap-2">
              <LogoMark size={36} />
              <span className="flex flex-col leading-none">
                <span className="text-lg font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
                  Cénit
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Fisiolab</span>
              </span>
            </span>
          </header>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-44 shrink-0 text-text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {parts.anamnesis && (
            <Block title="Anamnesis">
              {sections.length === 0 ? (
                <p className="text-text-muted">Sin anamnesis registrada.</p>
              ) : (
                sections.map(({ s, rows }) => (
                  <div key={s.id} className="flex flex-col gap-1 break-inside-avoid">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{s.title}</h3>
                    <dl className="flex flex-col gap-1">
                      {rows.map((f) => (
                        <div key={f.id} className="grid grid-cols-[minmax(0,13rem)_1fr] gap-3">
                          <dt className="text-text-muted">{f.label}</dt>
                          <dd className="whitespace-pre-line">{answerText(f, a[f.id] ?? null)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))
              )}
            </Block>
          )}

          {parts.exploracion && (
            <Block title="Exploración física">
              {examText.length > 0 && (
                <dl className="flex flex-col gap-1">
                  {examText.map((f) => (
                    <div key={f.id} className="grid grid-cols-[minmax(0,13rem)_1fr] gap-3">
                      <dt className="text-text-muted">{f.label}</dt>
                      <dd className="whitespace-pre-line">{answerText(f, a[f.id] ?? null)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {current.length > 0 ? (
                <Scroll label="Pruebas ortopédicas y neurológicas">
                  <table className="w-full border-collapse text-sm">
                    <caption className="pb-1 text-left text-sm font-semibold">Pruebas ortopédicas y neurológicas</caption>
                    <thead>
                      <tr>
                        <th className={th}>Test</th>
                        <th className={th}>Lado</th>
                        <th className={th}>Resultado</th>
                        <th className={th}>Fecha</th>
                        <th className={th}>Qué aporta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.map((f) => {
                        const m = resultMeaning(findTest(f.galleryTest), f.result);
                        return (
                          <tr key={f.id} className="break-inside-avoid">
                            <td className={td}>
                              {f.testName}
                              {f.notes && <span className="block text-xs text-text-muted">{f.notes}</span>}
                            </td>
                            <td className={td}>{f.side ? sideText[f.side] : "—"}</td>
                            <td className={`${td} font-semibold ${f.result === "positive" ? "text-danger" : ""}`}>{resultLabels[f.result]}</td>
                            <td className={`${td} nums`}>{fmtDateShort(f.performedAt)}</td>
                            <td className={`${td} text-xs`}>{m ? `${f.result === "positive" ? "LR+" : "LR−"} ${fmt(m.lr, f.result === "positive" ? 1 : 2)}: ${m.text} (${m.source})` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Scroll>
              ) : (
                examText.length === 0 && <p className="text-text-muted">Sin exploración registrada.</p>
              )}
            </Block>
          )}

          {parts.dolor && pain.length > 0 && (
            <Block title="Evolución del dolor (EVA 0-10)">
              <div className="max-w-md">
                <PainChart points={pain} label={`Dolor de 0 a 10: ${pain.map((p) => `${fmtDate(p.at)} ${p.pain}`).join(", ")}`} />
              </div>
              <p>
                {pain.length === 1 ? `Dolor ${pain[0]!.pain}/10 el ${fmtDate(pain[0]!.at)}.` : `De ${pain[0]!.pain}/10 (${fmtDate(pain[0]!.at)}) a ${pain.at(-1)!.pain}/10 (${fmtDate(pain.at(-1)!.at)}), en ${pain.length} registros.`}
              </p>
            </Block>
          )}

          {parts.mediciones && tr.length > 0 && (
            <Block title="Mediciones">
              {symmetry.length > 0 && (
                <Scroll label="Simetría entre lados">
                  <table className="w-full border-collapse text-sm">
                    <caption className="pb-1 text-left text-sm font-semibold">Simetría entre lados (lado peor / lado mejor; referencia {LSI_REFERENCE} %)</caption>
                    <thead>
                      <tr>
                        <th className={th}>Medición</th>
                        <th className={`${th} text-right`}>Izquierda</th>
                        <th className={`${th} text-right`}>Derecha</th>
                        <th className={`${th} text-right`}>Simetría</th>
                      </tr>
                    </thead>
                    <tbody className="nums">
                      {symmetry.map((r) => (
                        <tr key={r.title} className="break-inside-avoid">
                          <td className={td}>{r.title}</td>
                          <td className={`${td} text-right ${r.weaker === "left" ? "font-semibold" : ""}`}>{r.left.text}</td>
                          <td className={`${td} text-right ${r.weaker === "right" ? "font-semibold" : ""}`}>{r.right.text}</td>
                          <td className={`${td} text-right font-semibold ${r.lsi < LSI_REFERENCE ? "text-warning" : ""}`}>{fmt(r.lsi, 0)} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Scroll>
              )}
              <Scroll label="Mediciones">
                <table className="w-full border-collapse text-sm">
                  <caption className="pb-1 text-left text-sm font-semibold">La última de cada medición</caption>
                  <thead>
                    <tr>
                      <th className={th}>Medición</th>
                      <th className={`${th} text-right`}>Última</th>
                      <th className={th}>Fecha</th>
                      <th className={`${th} text-right`}>Anterior</th>
                      <th className={`${th} text-right`}>Veces</th>
                    </tr>
                  </thead>
                  <tbody className="nums">
                    {tr.map((t) => {
                      const u = (v: { text: string; unit: string; prefix?: string }) => `${v.prefix ? `${v.prefix} ` : ""}${v.text}${v.unit === "°" ? "°" : v.unit ? ` ${v.unit}` : ""}`;
                      return (
                        <tr key={t.title} className="break-inside-avoid">
                          <td className={td}>{t.title}</td>
                          <td className={`${td} text-right font-semibold`}>{u(t.value)}</td>
                          <td className={td}>{fmtDateShort(t.latest.performedAt)}</td>
                          <td className={`${td} text-right`}>{t.previous ? u(t.previous) : "—"}</td>
                          <td className={`${td} text-right`}>{t.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Scroll>
            </Block>
          )}

          {parts.cuestionarios && qGroups.length > 0 && (
            <Block title="Cuestionarios">
              <Scroll label="Cuestionarios">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Cuestionario</th>
                      <th className={`${th} text-right`}>Primero</th>
                      <th className={`${th} text-right`}>Último</th>
                      <th className={th}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="nums">
                    {qGroups.map((g) => {
                      const last = g.items[0]!;
                      const first = g.items.at(-1)!;
                      const d = last.details as QDetails;
                      const k = kindOf(last.kind, d);
                      return (
                        <tr key={g.key} className="break-inside-avoid">
                          <td className={td}>
                            {g.name}
                            <span className="block text-xs text-text-muted">
                              {k.better === "higher" ? "Más es mejor" : "Menos es mejor"}
                              {d.activities?.length ? ` · ${d.activities.map((x) => `${x.name} ${x.score}`).join(", ")}` : ""}
                            </span>
                          </td>
                          <td className={`${td} text-right`}>{g.items.length > 1 ? `${scoreText(k, first.score)} (${fmtDateShort(first.performedAt)})` : "—"}</td>
                          <td className={`${td} text-right font-semibold`}>{scoreText(k, last.score)}</td>
                          <td className={td}>{fmtDateShort(last.performedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Scroll>
            </Block>
          )}

          {parts.sesiones && sessions.length > 0 && (
            <Block title={`Sesiones (${sessions.length})`}>
              <Scroll label="Sesiones">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Fecha</th>
                      <th className={`${th} text-right`}>Dolor</th>
                      <th className={th}>Tratamiento</th>
                      <th className={th}>Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sessions].reverse().map((s) => (
                      <tr key={s.id} className="break-inside-avoid">
                        <td className={`${td} nums whitespace-nowrap`}>{fmtDateShort(s.performedAt)}</td>
                        <td className={`${td} nums text-right`}>{s.pain !== null ? `${s.pain}/10` : "—"}</td>
                        <td className={`${td} whitespace-pre-line`}>{s.treatment || s.subjective || "—"}</td>
                        <td className={`${td} whitespace-pre-line`}>{s.plan || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </Block>
          )}

          <footer className="mt-4 flex flex-wrap justify-between gap-6 border-t border-border pt-4 text-sm">
            <span>
              Firma del fisioterapeuta: <span className="inline-block min-w-48 border-b border-text-muted">{physio}</span>
            </span>
            <span>Fecha: {fmtDate(today)}</span>
          </footer>
        </article>
      </main>
    </div>
  );
}
