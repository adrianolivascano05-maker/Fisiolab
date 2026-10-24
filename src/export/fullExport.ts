// Exportación completa: todo lo que la clínica tiene en Cénit, en un .zip que se puede abrir sin la app y llevar a
// otro programa. Es lo que se entrega al darse de baja (y lo que la clínica puede descargar cuando quiera):
// - «Historias clinicas/»: la historia clínica de cada paciente en una página (HTML) que se abre con cualquier
//   navegador y se imprime o se guarda en PDF: datos, motivos de consulta con su anamnesis, sesiones, exploración,
//   mediciones, cuestionarios, bienestar, consentimientos (con sus firmas), citas, bonos y cobros.
// - «Indice de pacientes.html»: la lista, con un enlace a cada historia.
// - «Todos los datos.xlsx»: una pestaña por tipo de dato, en columnas legibles (para Excel o para otro programa).
// - «Datos para otro programa (JSON).json»: las tablas tal cual, para quien programe una migración.
// - «Copia de Cenit.sqlite3»: la copia de seguridad que se restaura en Cénit.
// - «LEEME.txt»: qué es cada cosa.
// Los vídeos de las mediciones no van: se quedan en el dispositivo donde se grabaron.
import { getExercise } from "../calc/strength";
import { getMovement, movementLabel } from "../calc/rom";
import { wellnessItems } from "../calc/wellness";
import { metricLabels, sideLabels, testTitle } from "../app/format";
import { ANAMNESIS, answerText, orphanAnswers, orphanText, regionLabel, withCustom, type Section } from "../clinical/anamnesis";
import { marksText } from "../clinical/bodyMap";
import { getCustomFields } from "../data/customFields";
import { displayName, kindOf, scoreText, type QDetails } from "../clinical/questionnaires";
import type { AnswerValue, Answers } from "../data/clinical";
import type { Db } from "../data/db";
import { STATUS_LABELS, type AppointmentStatus } from "../data/appointments";
import { getClinic, type ClinicInfo } from "../data/privacy";
import { euros, methodLabel } from "../data/billing";
import { SYNC_TABLES } from "../data/syncMerge";
import { escapeXml, writeXlsx, zip, type Cell, type Sheet, type ZipFile } from "./files";

type R = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const json = <T>(v: unknown, fallback: T): T => {
  try {
    return typeof v === "string" ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

const SEX: Record<string, string> = { female: "Mujer", male: "Hombre", other: "Otro" };
const RESULT: Record<string, string> = { positive: "Positivo", negative: "Negativo", inconclusive: "Dudoso" };
const SIDE: Record<string, string> = { left: "Izquierdo", right: "Derecho", both: "Ambos" };

/** «12/03/2026 10:30» (hora de Madrid); un día suelto (AAAA-MM-DD), «12/03/2026». */
export function when(iso: unknown): string {
  const v = s(iso);
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).replace(",", "");
}
const day = (iso: unknown) => when(iso).slice(0, 10);
/** Céntimos a euros, como número para la hoja de cálculo. */
const cents = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v) / 100);

/** Todo lo de la base, de una vez. */
export type Collected = {
  clinic: ClinicInfo;
  schema: number;
  tables: Record<string, R[]>;
  /** La ficha de anamnesis de la clínica, con sus campos propios. */
  template?: Section[];
};

/** Las tablas que se exportan (las de la clínica; no los ajustes del dispositivo ni los de cada persona). */
const EXPORT_TABLES = SYNC_TABLES.map((t) => t.name).filter((t) => !["settings", "devices", "validation_pairs"].includes(t));

export async function collect(db: Db): Promise<Collected> {
  const tables: Record<string, R[]> = {};
  for (const t of EXPORT_TABLES) tables[t] = await db.query<R>(`select * from ${t}`);
  // La clave de cada enlace de formulario no sale de la app: lo que contestó el paciente, sí.
  tables.patient_forms = (tables.patient_forms ?? []).map(({ form_key: _, ...r }) => r);
  return { clinic: await getClinic(db), schema: (await db.info()).schemaVersion, tables, template: withCustom(await getCustomFields(db)) };
}

// ---------- Lo de cada paciente ----------

type Episode = { id: string | null; title: string; startedAt: string; closedAt: string | null; answers: Answers };

/** Sus motivos de consulta: el primero con la anamnesis de la tabla anamnesis, los demás con la suya. */
function episodesOf(c: Collected, pid: string): Episode[] {
  const first = c.tables.anamnesis!.find((a) => a.patient_id === pid);
  const rows = c.tables.episodes!.filter((e) => e.patient_id === pid).sort((a, b) => s(a.started_at).localeCompare(s(b.started_at)));
  const list: Episode[] = [];
  const firstAnswers = json<Answers>(first?.answers, {});
  // El primero no tiene fila en episodes (sus registros llevan episode_id nulo) y su anamnesis va en la tabla anamnesis.
  list.push({ id: null, title: s((firstAnswers as R).motivo) || "Primer motivo de consulta", startedAt: s(first?.created_at), closedAt: null, answers: firstAnswers });
  for (const e of rows) {
    const answers = json<Answers>(e.answers, {});
    list.push({ id: s(e.id), title: s(e.title) || s((answers as R).motivo) || "Motivo de consulta", startedAt: s(e.started_at), closedAt: e.closed_at ? s(e.closed_at) : null, answers });
  }
  return list;
}

const episodeName = (eps: Episode[], id: unknown) => {
  if (eps.length < 2) return "";
  const e = eps.find((x) => x.id === (id ? s(id) : null)) ?? eps[0]!;
  return e.title;
};

/** Las respuestas de una anamnesis, por apartados y con sus nombres: [apartado, campo, respuesta]. */
export function anamnesisRows(a: Answers, template: Section[] = ANAMNESIS): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const section of template)
    for (const f of section.fields) {
      const text = answerText(f, a[f.id] as AnswerValue);
      if (text) out.push([section.title, f.label, text]);
    }
  for (const [k, v] of orphanAnswers(a, template)) {
    const o = orphanText(k, v as AnswerValue);
    out.push(["Otros datos guardados", o.label, o.text]);
  }
  return out;
}

function testName(t: R): string {
  const d = json<R>(t.details, {});
  const movement = d.movement ? s(d.movement) : null;
  const m = movement ? getMovement(movement) : undefined;
  if (m) return movementLabel(m, (t.side as "left" | "right" | null) ?? null);
  const exercise = d.exercise ? s(d.exercise) : null;
  return testTitle({ type: s(t.type), side: (t.side as "left" | "right" | null) ?? null, exercise: exercise && getExercise(exercise as never) ? exercise : null, extraLoadKg: Number(t.extra_load_kg ?? 0) });
}

const metricName = (m: unknown) => metricLabels[s(m)]?.label ?? s(m);
const fmtNum = (v: unknown) => {
  const x = n(v);
  return x === null ? "" : String(Math.round(x * 100) / 100).replace(".", ",");
};

// ---------- Excel ----------

export function buildSheets(c: Collected): Sheet[] {
  const T = c.tables;
  const name = new Map(T.patients!.map((p) => [s(p.id), s(p.name)]));
  const staff = new Map(T.staff!.map((p) => [s(p.email), s(p.name)]));
  const pn = (r: R) => name.get(s(r.patient_id)) ?? "";
  const byDate = (k: string) => (a: R, b: R) => pn(a).localeCompare(pn(b), "es") || s(a[k]).localeCompare(s(b[k]));
  const eps = new Map<string, Episode[]>();
  const epsOf = (pid: string) => eps.get(pid) ?? eps.set(pid, episodesOf(c, pid)).get(pid)!;
  const testsById = new Map(T.tests!.map((t) => [s(t.id), t]));

  const sheets: Sheet[] = [
    {
      name: "Pacientes",
      header: ["Código", "Nombre", "Fecha de nacimiento", "Sexo", "Teléfono", "Correo", "Dirección", "DNI o NIE", "Peso (kg)", "Altura (cm)", "Notas", "Alta en Cénit", "Última modificación"],
      rows: [...T.patients!]
        .sort((a, b) => s(a.name).localeCompare(s(b.name), "es"))
        .map((p) => [s(p.id), s(p.name), day(p.birth_date), SEX[s(p.sex)] ?? "", s(p.phone), s(p.email), s(p.address), s(p.dni), n(p.body_mass_kg), n(p.height_cm), s(p.notes), when(p.created_at), when(p.updated_at)]),
    },
    {
      name: "Motivos de consulta",
      header: ["Paciente", "Motivo", "Desde", "Terminado"],
      rows: T.patients!.flatMap((p) => epsOf(s(p.id)).map((e) => [s(p.name), e.title, when(e.startedAt), e.closedAt ? when(e.closedAt) : ""])),
    },
    {
      name: "Anamnesis",
      header: ["Paciente", "Motivo de consulta", "Apartado", "Pregunta", "Respuesta"],
      rows: T.patients!.flatMap((p) => epsOf(s(p.id)).flatMap((e) => anamnesisRows(e.answers, c.template).map(([sec, label, text]) => [s(p.name), e.title, sec, label, text]))),
    },
    {
      name: "Sesiones",
      header: ["Paciente", "Fecha", "Motivo de consulta", "Dolor (0-10)", "Subjetivo (refiere)", "Objetivo (encuentra)", "Tratamiento", "Plan y ejercicios", "Reevaluar el"],
      rows: [...T.sessions!]
        .sort(byDate("performed_at"))
        .map((r) => [pn(r), when(r.performed_at), episodeName(epsOf(s(r.patient_id)), r.episode_id), n(r.pain), s(r.subjective), s(r.objective), s(r.treatment), s(r.plan), day(r.review_on)]),
    },
    {
      name: "Exploración",
      header: ["Paciente", "Fecha", "Test", "Región", "Lado", "Resultado", "Notas"],
      rows: [...T.findings!].sort(byDate("performed_at")).map((r) => [pn(r), when(r.performed_at), s(r.test_name), s(r.region), SIDE[s(r.side)] ?? "", RESULT[s(r.result)] ?? s(r.result), s(r.notes)]),
    },
    {
      name: "Mediciones",
      header: ["Paciente", "Fecha", "Medición", "Lado", "Carga (kg)", "Intento", "Resultado", "Valor", "Unidad", "Notas"],
      rows: [...T.results!]
        .map((r) => ({ r, t: testsById.get(s(r.test_id)) }))
        .filter((x): x is { r: R; t: R } => !!x.t)
        .sort((a, b) => byDate("performed_at")(a.t, b.t) || Number(a.r.series_index) - Number(b.r.series_index))
        .map(({ r, t }) => [
          pn(t),
          when(t.performed_at),
          testName(t),
          t.side ? sideLabels[t.side as "left" | "right"] : "",
          n(t.extra_load_kg) || null,
          Number(r.series_index) + 1,
          metricName(r.metric),
          n(r.value),
          s(r.unit),
          s(t.notes),
        ]),
    },
    {
      name: "Cuestionarios",
      header: ["Paciente", "Fecha", "Cuestionario", "Puntuación", "Interpretación", "Notas", "Detalle"],
      rows: [...T.questionnaires!].sort(byDate("performed_at")).map((r) => {
        const d = json<QDetails>(r.details, {} as QDetails);
        const k = kindOf(s(r.kind), d);
        return [pn(r), when(r.performed_at), displayName(s(r.kind), d), n(r.score), scoreText(k, Number(r.score)), s(r.notes), questionnaireDetail(d)];
      }),
    },
    {
      name: "Bienestar",
      header: ["Paciente", "Fecha", ...wellnessItems.map((w) => `${w.label} (1-5)`), "Dolor (0-10)", "Notas"],
      rows: [...T.wellness!].sort(byDate("performed_at")).map((r) => [pn(r), when(r.performed_at), ...wellnessItems.map((w) => n(r[w.id])), n(r.pain), s(r.notes)]),
    },
    {
      name: "Consentimientos",
      header: ["Paciente", "Documento", "Versión", "Firmado el", "Cómo", "Retirado el", "Nota de retirada"],
      rows: [...T.consents!]
        .sort(byDate("signed_at"))
        .map((r) => [pn(r), s(r.title), s(r.version), when(r.signed_at), r.method === "screen" ? "En pantalla" : "En papel", when(r.revoked_at), s(r.revoke_note)]),
    },
    {
      name: "Citas",
      header: ["Paciente", "Fecha y hora", "Minutos", "Estado", "Con quién"],
      rows: [...T.appointments!]
        .sort((a, b) => s(a.starts_at).localeCompare(s(b.starts_at)))
        .map((r) => [pn(r), when(r.starts_at), n(r.minutes), STATUS_LABELS[r.status as AppointmentStatus] ?? s(r.status), r.assigned_to ? (staff.get(s(r.assigned_to)) ?? s(r.assigned_to)) : ""]),
    },
  ];
  if (T.packs!.length)
    sheets.push({
      name: "Bonos",
      header: ["Paciente", "Bono", "Sesiones", "Precio (€)", "Comprado el", "Caduca el", "Nota"],
      rows: [...T.packs!].sort(byDate("bought_on")).map((r) => [pn(r), s(r.title), n(r.sessions), cents(r.price_cents), day(r.bought_on), day(r.expires_on), s(r.note)]),
    });
  if (T.payments!.length)
    sheets.push({
      name: "Cobros",
      header: ["Paciente", "Día", "Cantidad (€)", "Forma de pago", "Concepto"],
      rows: [...T.payments!].sort(byDate("paid_on")).map((r) => [pn(r), day(r.paid_on), cents(r.amount_cents), methodLabel(s(r.method)), s(r.concept)]),
    });
  if (T.invoices?.length)
    sheets.push({
      name: "Facturas",
      header: ["Número", "Tipo", "Fecha", "Destinatario", "NIF del destinatario", "Base imponible (€)", "IVA (%)", "Cuota de IVA (€)", "Retención IRPF (€)", "Total (€)", "Exención o motivo"],
      rows: [...T.invoices]
        .sort((a, b) => s(a.issued_on).localeCompare(s(b.issued_on)) || s(a.code).localeCompare(s(b.code)))
        .map((r) => {
          const to = json<{ name?: string; taxId?: string }>(r.recipient, {});
          return [s(r.code), s(r.kind), day(r.issued_on), s(to.name), s(to.taxId), cents(r.base_cents), n(r.vat_rate), cents(r.vat_cents), cents(r.irpf_cents), cents(r.total_cents), [s(r.exemption), s(r.reason)].filter(Boolean).join(" · ")];
        }),
    });
  if (T.exercise_plans!.length)
    sheets.push({
      name: "Ejercicios para casa",
      header: ["Paciente", "Hoja del", "Ejercicio", "Dosis", "Cómo se hace", "Indicaciones"],
      rows: [...T.exercise_plans!]
        .sort(byDate("created_at"))
        .flatMap((r) => json<{ title: string; dose: string; instructions: string }[]>(r.items, []).map((i) => [pn(r), when(r.updated_at), s(i.title), s(i.dose), s(i.instructions), s(r.note)])),
    });
  if (T.waitlist!.length)
    sheets.push({
      name: "Lista de espera",
      header: ["Paciente", "Desde", "Le viene bien", "Con quién"],
      rows: [...T.waitlist!].sort((a, b) => s(a.created_at).localeCompare(s(b.created_at))).map((r) => [pn(r), when(r.created_at), s(r.note), r.assigned_to ? (staff.get(s(r.assigned_to)) ?? s(r.assigned_to)) : ""]),
    });
  if (T.exercises!.length)
    sheets.push({
      name: "Biblioteca de ejercicios",
      header: ["Ejercicio", "Zona", "Dosis", "Cómo se hace"],
      rows: [...T.exercises!].sort((a, b) => s(a.title).localeCompare(s(b.title), "es")).map((r) => [s(r.title), r.region ? regionLabel(s(r.region)) : "", s(r.dose), s(r.instructions)]),
    });
  if (T.shifts!.length)
    sheets.push({
      name: "Turnos del equipo",
      header: ["Persona", "Desde", "Hasta", "Nota"],
      rows: [...T.shifts!].sort((a, b) => s(a.starts_at).localeCompare(s(b.starts_at))).map((r) => [staff.get(s(r.staff_email)) ?? s(r.staff_email), when(r.starts_at), when(r.ends_at), s(r.note)]),
    });
  return sheets;
}

function questionnaireDetail(d: QDetails): string {
  const parts: string[] = [];
  const any = d as unknown as R;
  if (Array.isArray(any.marks)) parts.push(marksText(any.marks));
  if (Array.isArray(any.activities)) parts.push((any.activities as { name: string; score: number }[]).map((a) => `${a.name}: ${a.score}/10`).join("; "));
  if (any.answers && typeof any.answers === "object") parts.push(`Respuestas: ${Object.entries(any.answers as R).map(([k, v]) => `${k}=${s(v)}`).join(", ")}`);
  return parts.join(" · ");
}

// ---------- Historia clínica de un paciente (HTML) ----------

const h = (v: unknown) => escapeXml(s(v)).replace(/\n/g, "<br>");

const CSS = `body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1b1b1d;max-width:900px;margin:0 auto;padding:24px;line-height:1.5}
h1{color:#0e3b2e;margin:0 0 4px;font-size:26px}h2{color:#0e3b2e;border-bottom:2px solid #e9ddc8;padding-bottom:4px;margin-top:32px;font-size:20px}
h3{margin:18px 0 6px;font-size:16px}.muted{color:#57514a;font-size:14px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}
th,td{border:1px solid #e4d9c6;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4efe4}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:8px 0}
dt{font-weight:600}dd{margin:0}.card{border:1px solid #e4d9c6;border-radius:8px;padding:12px 14px;margin:10px 0;break-inside:avoid}
.sig{display:flex;gap:24px;flex-wrap:wrap}.sig div{min-width:220px}.sig img{max-height:90px;display:block;border-bottom:1px solid #1b1b1d}
footer{margin-top:40px;font-size:12px;color:#57514a}@media print{body{padding:0}a{color:inherit}}`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

const table = (header: string[], rows: Cell[][]) =>
  rows.length ? `<table><thead><tr>${header.map((x) => `<th>${h(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${h(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";

export function patientHtml(c: Collected, p: R, exportedAt = new Date()): string {
  const T = c.tables;
  const pid = s(p.id);
  const mine = (t: string) => T[t]!.filter((r) => r.patient_id === pid);
  const eps = episodesOf(c, pid);
  const staff = new Map(T.staff!.map((x) => [s(x.email), s(x.name)]));
  const parts: string[] = [];
  const clinicLine = [c.clinic.name, c.clinic.taxId && `NIF ${c.clinic.taxId}`, c.clinic.address].filter(Boolean).join(" · ");
  parts.push(`<p class="muted">${h(clinicLine || "Historia clínica")}</p><h1>${h(p.name)}</h1><p class="muted">Historia clínica exportada de Cénit el ${h(when(exportedAt.toISOString()))}. Cénit registra y organiza; las decisiones clínicas son del profesional.</p>`);

  const datos: [string, string][] = [
    ["Fecha de nacimiento", day(p.birth_date)],
    ["Sexo", SEX[s(p.sex)] ?? ""],
    ["Teléfono", s(p.phone)],
    ["Correo", s(p.email)],
    ["Dirección", s(p.address)],
    ["DNI o NIE", s(p.dni)],
    ["Peso", p.body_mass_kg ? `${fmtNum(p.body_mass_kg)} kg` : ""],
    ["Altura", p.height_cm ? `${fmtNum(p.height_cm)} cm` : ""],
    ["Notas", s(p.notes)],
    ["En Cénit desde", when(p.created_at)],
    ["Código", pid],
  ];
  parts.push(`<h2>Datos del paciente</h2><dl>${datos
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`)
    .join("")}</dl>`);

  for (const e of eps) {
    const rows = anamnesisRows(e.answers, c.template);
    const closed = e.closedAt ? ` · terminado el ${day(e.closedAt)}` : "";
    parts.push(`<h2>${eps.length > 1 ? `Motivo de consulta: ${h(e.title)}` : "Anamnesis"}</h2>${e.startedAt ? `<p class="muted">Desde el ${h(day(e.startedAt))}${h(closed)}</p>` : ""}`);
    if (!rows.length) parts.push(`<p class="muted">Sin anamnesis registrada.</p>`);
    let section = "";
    for (const [sec, label, text] of rows) {
      if (sec !== section) {
        if (section) parts.push("</dl>");
        parts.push(`<h3>${h(sec)}</h3><dl>`);
        section = sec;
      }
      parts.push(`<dt>${h(label)}</dt><dd>${h(text)}</dd>`);
    }
    if (section) parts.push("</dl>");
  }

  const sessions = mine("sessions").sort((a, b) => s(a.performed_at).localeCompare(s(b.performed_at)));
  if (sessions.length) {
    parts.push(`<h2>Sesiones (${sessions.length})</h2>`);
    for (const r of sessions) {
      const fields: [string, string][] = [
        ["Motivo de consulta", episodeName(eps, r.episode_id)],
        ["Dolor al llegar", r.pain === null || r.pain === undefined ? "" : `${s(r.pain)}/10`],
        ["Refiere (subjetivo)", s(r.subjective)],
        ["Encuentra (objetivo)", s(r.objective)],
        ["Tratamiento", s(r.treatment)],
        ["Plan y ejercicios", s(r.plan)],
        ["Reevaluar el", day(r.review_on)],
      ];
      parts.push(`<div class="card"><h3>${h(when(r.performed_at))}</h3><dl>${fields
        .filter(([, v]) => v)
        .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`)
        .join("")}</dl></div>`);
    }
  }

  const findings = mine("findings").sort((a, b) => s(a.performed_at).localeCompare(s(b.performed_at)));
  if (findings.length)
    parts.push(
      `<h2>Exploración</h2>${table(
        ["Fecha", "Test", "Región", "Lado", "Resultado", "Notas"],
        findings.map((r) => [when(r.performed_at), s(r.test_name), s(r.region), SIDE[s(r.side)] ?? "", RESULT[s(r.result)] ?? s(r.result), s(r.notes)]),
      )}`,
    );

  const tests = mine("tests").sort((a, b) => s(a.performed_at).localeCompare(s(b.performed_at)));
  if (tests.length) {
    const results = new Map<string, R[]>();
    for (const r of T.results!) if (tests.some((t) => t.id === r.test_id)) results.set(s(r.test_id), [...(results.get(s(r.test_id)) ?? []), r]);
    parts.push(
      `<h2>Mediciones</h2>${table(
        ["Fecha", "Medición", "Resultados", "Notas"],
        tests.map((t) => {
          const rs = (results.get(s(t.id)) ?? []).sort((a, b) => Number(a.series_index) - Number(b.series_index));
          const multi = new Set(rs.map((r) => r.series_index)).size > 1;
          return [
            when(t.performed_at),
            testName(t),
            rs.map((r) => `${multi ? `Intento ${Number(r.series_index) + 1} · ` : ""}${metricName(r.metric)}: ${fmtNum(r.value)} ${s(r.unit)}`).join("\n"),
            s(t.notes),
          ];
        }),
      )}`,
    );
  }

  const qs = mine("questionnaires").sort((a, b) => s(a.performed_at).localeCompare(s(b.performed_at)));
  if (qs.length)
    parts.push(
      `<h2>Cuestionarios</h2>${table(
        ["Fecha", "Cuestionario", "Resultado", "Notas"],
        qs.map((r) => {
          const d = json<QDetails>(r.details, {} as QDetails);
          return [when(r.performed_at), displayName(s(r.kind), d), [scoreText(kindOf(s(r.kind), d), Number(r.score)), questionnaireDetail(d)].filter(Boolean).join("\n"), s(r.notes)];
        }),
      )}`,
    );

  const wellness = mine("wellness").sort((a, b) => s(a.performed_at).localeCompare(s(b.performed_at)));
  if (wellness.length)
    parts.push(
      `<h2>Bienestar</h2>${table(
        ["Fecha", ...wellnessItems.map((w) => w.short), "Dolor", "Notas"],
        wellness.map((r) => [when(r.performed_at), ...wellnessItems.map((w) => s(r[w.id])), r.pain === null || r.pain === undefined ? "" : `${s(r.pain)}/10`, s(r.notes)]),
      )}`,
    );

  const consents = mine("consents").sort((a, b) => s(a.signed_at).localeCompare(s(b.signed_at)));
  if (consents.length) {
    parts.push(`<h2>Consentimientos informados</h2>`);
    for (const r of consents) parts.push(consentHtml(r));
  }

  const appts = mine("appointments").sort((a, b) => s(a.starts_at).localeCompare(s(b.starts_at)));
  if (appts.length)
    parts.push(
      `<h2>Citas</h2>${table(
        ["Fecha y hora", "Minutos", "Estado", "Con quién"],
        appts.map((r) => [when(r.starts_at), s(r.minutes), STATUS_LABELS[r.status as AppointmentStatus] ?? s(r.status), r.assigned_to ? (staff.get(s(r.assigned_to)) ?? s(r.assigned_to)) : ""]),
      )}`,
    );

  const plans = mine("exercise_plans").sort((a, b) => s(a.created_at).localeCompare(s(b.created_at)));
  if (plans.length) {
    parts.push(`<h2>Ejercicios para casa</h2>`);
    for (const r of plans)
      parts.push(
        `<div class="card"><h3>Hoja del ${h(when(r.updated_at))}</h3><ol>${json<{ title: string; dose: string; instructions: string }[]>(r.items, [])
          .map((i) => `<li><strong>${h(i.title)}</strong>${i.dose ? ` — ${h(i.dose)}` : ""}${i.instructions ? `<br>${h(i.instructions)}` : ""}</li>`)
          .join("")}</ol>${r.note ? `<p class="muted">${h(r.note)}</p>` : ""}</div>`,
      );
  }

  const packs = mine("packs").sort((a, b) => s(a.bought_on).localeCompare(s(b.bought_on)));
  const payments = mine("payments").sort((a, b) => s(a.paid_on).localeCompare(s(b.paid_on)));
  if (packs.length)
    parts.push(
      `<h2>Bonos</h2>${table(
        ["Bono", "Sesiones", "Precio", "Comprado el", "Caduca el"],
        packs.map((r) => [s(r.title), s(r.sessions), r.price_cents === null ? "" : euros(Number(r.price_cents)), day(r.bought_on), day(r.expires_on)]),
      )}`,
    );
  if (payments.length)
    parts.push(
      `<h2>Cobros</h2>${table(
        ["Día", "Cantidad", "Forma de pago", "Concepto"],
        payments.map((r) => [day(r.paid_on), euros(Number(r.amount_cents)), methodLabel(s(r.method)), s(r.concept)]),
      )}`,
    );

  parts.push(`<footer>${h(clinicLine)} · Exportado de Cénit · ${h(when(exportedAt.toISOString()))}</footer>`);
  return page(`Historia clínica · ${s(p.name)}`, parts.join(""));
}

/** Un consentimiento tal como se firmó: el documento entero, las firmas y, si se retiró, cuándo. */
function consentHtml(r: R): string {
  const doc = json<{
    title?: string;
    version?: string;
    clinic?: { name?: string };
    professional?: { name?: string; license?: string };
    patient?: { name?: string; idDoc?: string };
    representative?: { name: string; relation: string } | null;
    techniques?: string[];
    sections?: { title: string; items: string[] }[];
    date?: string;
    place?: string;
  }>(r.document, {});
  const sig = json<{ patient?: string; professional?: string; revocation?: string }>(r.signatures, {});
  const img = (src: string | undefined, label: string) =>
    `<div><strong>${h(label)}</strong>${src && src.startsWith("data:image/") ? `<img src="${escapeXml(src)}" alt="${h(label)}">` : `<p class="muted">${r.method === "paper" ? "Firmado en papel" : "Sin firma en pantalla"}</p>`}</div>`;
  return `<div class="card"><h3>${h(doc.title ?? r.title)}</h3><p class="muted">Versión ${h(doc.version ?? r.version)} · firmado el ${h(when(r.signed_at))} ${r.method === "paper" ? "(en papel)" : "(en pantalla)"}${
    doc.professional?.name ? ` · informa ${h(doc.professional.name)}${doc.professional.license ? ` (nº col. ${h(doc.professional.license)})` : ""}` : ""
  }</p>${doc.representative ? `<p>Representante: ${h(doc.representative.name)} (${h(doc.representative.relation)})</p>` : ""}${doc.techniques?.length ? `<p><strong>Técnicas:</strong> ${h(doc.techniques.join(", "))}</p>` : ""}${(doc.sections ?? [])
    .map((x) => `<h3>${h(x.title)}</h3>${x.items.length === 1 ? `<p>${h(x.items[0])}</p>` : `<ul>${x.items.map((i) => `<li>${h(i)}</li>`).join("")}</ul>`}`)
    .join("")}<p>${doc.place ? `En ${h(doc.place)}, ` : ""}${doc.date ? `a ${h(day(doc.date))}` : ""}</p><div class="sig">${img(sig.patient, doc.representative ? "Firma del representante" : "Firma del paciente")}${img(sig.professional, "Firma del fisioterapeuta")}</div>${
    r.revoked_at ? `<p><strong>Retirado el ${h(when(r.revoked_at))}</strong>${r.revoke_note ? `: ${h(r.revoke_note)}` : ""}</p>${sig.revocation ? `<div class="sig">${img(sig.revocation, "Firma de la retirada")}</div>` : ""}` : ""
  }</div>`;
}

// ---------- El paquete ----------

const safeName = (t: string) => t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Paciente";

const README = (c: Collected, count: number, at: Date) => `EXPORTACIÓN COMPLETA DE CÉNIT
${c.clinic.name ? `${c.clinic.name}\n` : ""}Exportada el ${when(at.toISOString())} · ${count} pacientes

Qué hay en esta carpeta:

1. «Indice de pacientes.html»: ábrelo con cualquier navegador (doble clic). Lleva a la historia
   clínica de cada paciente.

2. «Historias clinicas»: una página por paciente con todo lo registrado: datos, motivos de consulta
   con su anamnesis, sesiones, exploración, mediciones, cuestionarios, bienestar, consentimientos
   (con las firmas), citas, bonos y cobros. Se lee en cualquier navegador y se imprime o se guarda en PDF desde él
   (Imprimir > Guardar como PDF).

3. «Todos los datos.xlsx»: una pestaña por tipo de dato (pacientes, sesiones, anamnesis, citas…),
   en columnas, para Excel o para importarlo en otro programa. La columna «Código» de Pacientes
   identifica a cada paciente.

4. «Datos para otro programa (JSON).json»: las mismas tablas tal como las guarda Cénit (con sus
   códigos y fechas en formato ISO), para quien programe una migración.

5. «Copia de Cenit.sqlite3»: la copia de seguridad completa. Se restaura en Cénit desde
   Ajustes > Copias y exportar > Restaurar una copia.

Los vídeos de las mediciones no se incluyen: se quedan en el dispositivo donde se grabaron.

Son datos de salud: guárdalos cifrados y con acceso restringido, y consérvalos el tiempo que marca
la ley (como mínimo cinco años desde el alta de cada proceso, Ley 41/2002).
`;

export type PackageResult = { bytes: Uint8Array; patients: number };

/**
 * El .zip completo. `progress` recibe cuántos pacientes van (generar 1.500 historias tarda unos segundos).
 */
export async function buildPackage(db: Db, { progress, now = new Date() }: { progress?: (done: number, total: number) => void; now?: Date } = {}): Promise<PackageResult> {
  const c = await collect(db);
  const patients = [...c.tables.patients!].sort((a, b) => s(a.name).localeCompare(s(b.name), "es"));
  const files: ZipFile[] = [];
  const index: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < patients.length; i++) {
    const p = patients[i]!;
    let file = `${safeName(s(p.name))}.html`;
    if (used.has(file.toLowerCase())) file = `${safeName(s(p.name))} (${s(p.id).slice(0, 8)}).html`;
    used.add(file.toLowerCase());
    files.push({ name: `Historias clinicas/${file}`, data: patientHtml(c, p, now) });
    index.push(`<tr><td><a href="Historias%20clinicas/${encodeURIComponent(file)}">${h(p.name)}</a></td><td>${h(day(p.birth_date))}</td><td>${h(s(p.phone))}</td></tr>`);
    if (i % 50 === 0) {
      progress?.(i, patients.length);
      await new Promise((r) => setTimeout(r, 0)); // que la pantalla respire
    }
  }
  progress?.(patients.length, patients.length);
  files.unshift({
    name: "Indice de pacientes.html",
    data: page(
      "Pacientes",
      `<p class="muted">${h(c.clinic.name)}</p><h1>Pacientes (${patients.length})</h1><p class="muted">Exportado de Cénit el ${h(when(now.toISOString()))}. Toca un nombre para abrir su historia clínica.</p><table><thead><tr><th>Paciente</th><th>Nacimiento</th><th>Teléfono</th></tr></thead><tbody>${index.join("")}</tbody></table>`,
    ),
  });
  files.unshift({ name: "LEEME.txt", data: README(c, patients.length, now).replace(/\n/g, "\r\n") });
  files.push({ name: "Todos los datos.xlsx", data: await writeXlsx(buildSheets(c)) });
  files.push({
    name: "Datos para otro programa (JSON).json",
    data: JSON.stringify({ formato: "cenit-exportacion", version: 1, esquema: c.schema, exportado: now.toISOString(), clinica: c.clinic, tablas: c.tables }, null, 1),
  });
  files.push({ name: "Copia de Cenit.sqlite3", data: await db.exportBytes() });
  return { bytes: await zip(files, now), patients: patients.length };
}
