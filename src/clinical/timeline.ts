// Historia del paciente: sesiones, tests de exploración, mediciones, cuestionarios, bienestar y anamnesis en una
// sola línea de tiempo, la más reciente primero. Lo que pasa el mismo día se puede agrupar con la sesión de ese día.
import { testLabel } from "../app/format";
import { wellnessTotal } from "../calc/wellness";
import type { Anamnesis, Finding, Questionnaire, Session } from "../data/clinical";
import type { TestSummary, WellnessEntry } from "../data/repo";
import { resultLabels, sideShort } from "./parts";
import { displayName, kindOf, scoreText, type QDetails } from "./questionnaires";

export type EventKind = "session" | "finding" | "test" | "questionnaire" | "wellness" | "anamnesis";
export type TimelineEvent = { kind: EventKind; at: string; title: string; detail: string; to: string; finding?: Finding };

export const madridDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

export function buildTimeline(
  patientId: string,
  d: { sessions: Session[]; findings: Finding[]; tests: TestSummary[]; questionnaires: Questionnaire[]; wellness: WellnessEntry[]; anamnesis: Anamnesis | null },
): TimelineEvent[] {
  const base = `/pacientes/${patientId}`;
  const ev: TimelineEvent[] = [];
  for (const s of d.sessions)
    ev.push({
      kind: "session",
      at: s.performedAt,
      title: "Sesión",
      detail: [s.pain !== null ? `dolor ${s.pain}/10` : "", s.treatment || s.subjective].filter(Boolean).join(" · "),
      to: `${base}/sesiones/${s.id}`,
    });
  for (const f of d.findings)
    ev.push({
      kind: "finding",
      at: f.performedAt,
      title: f.testName,
      detail: `${resultLabels[f.result]}${f.side ? ` · ${sideShort[f.side]}` : ""}`,
      to: `${base}/exploracion/${f.id}`,
      finding: f,
    });
  // Las mediciones de un mismo día, juntas: un día de pruebas no tapa el resto de la historia (los valores
  // están en las tarjetas del resumen y en Mediciones).
  const days = new Map<string, TestSummary[]>();
  for (const t of d.tests) days.set(madridDay(t.performedAt), [...(days.get(madridDay(t.performedAt)) ?? []), t]);
  for (const list of days.values())
    ev.push({
      kind: "test",
      at: list[0]!.performedAt,
      title: list.length === 1 ? "1 medición" : `${list.length} mediciones`,
      detail: [...new Set(list.map((t) => testLabel(t.type)))].join(", "),
      to: `${base}/mediciones`,
    });
  for (const q of d.questionnaires) {
    const details = q.details as QDetails;
    ev.push({ kind: "questionnaire", at: q.performedAt, title: displayName(q.kind, details), detail: scoreText(kindOf(q.kind, details), q.score), to: `${base}/cuestionarios/${q.id}` });
  }
  for (const w of d.wellness)
    ev.push({ kind: "wellness", at: w.performedAt, title: "Bienestar", detail: `${wellnessTotal(w)}/25${w.pain !== null ? ` · dolor ${w.pain}/10` : ""}`, to: `${base}/bienestar` });
  if (d.anamnesis) ev.push({ kind: "anamnesis", at: d.anamnesis.createdAt, title: "Anamnesis", detail: "primera visita", to: `${base}/anamnesis` });
  return ev.sort((a, b) => b.at.localeCompare(a.at));
}

/** Dolor en el tiempo: el de cada sesión, el del bienestar y el de la anamnesis (si no hay sesión ese día). */
export function painSeries(d: { sessions: Session[]; wellness: WellnessEntry[]; anamnesis: Anamnesis | null }): { at: string; pain: number }[] {
  const byDay = new Map<string, { at: string; pain: number }>();
  const put = (at: string, pain: number | null | undefined, strong: boolean) => {
    if (pain === null || pain === undefined) return;
    const k = madridDay(at);
    if (strong || !byDay.has(k)) byDay.set(k, { at, pain });
  };
  const first = d.anamnesis?.answers.eva;
  const valued = d.anamnesis?.answers.fecha_valoracion;
  const at = typeof valued === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valued) ? `${valued}T12:00:00.000Z` : d.anamnesis?.createdAt;
  if (at && typeof first === "number") put(at, first, false);
  for (const w of d.wellness) put(w.performedAt, w.pain, false);
  for (const s of d.sessions) put(s.performedAt, s.pain, true);
  return [...byDay.values()].sort((a, b) => a.at.localeCompare(b.at));
}
