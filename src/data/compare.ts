// Comparar pacientes (S23): un ranking por medida, con la mejor marca o la última de cada paciente.
import type { Db } from "./db";

export type CompareMetric = {
  id: string;
  group: string;
  label: string;
  unit: string;
  digits: number;
  /** "high": cuanto más, mejor (altura); "low": cuanto menos, mejor (tiempo). */
  better: "high" | "low";
  sql: string;
  bind: (string | number)[];
};

type Row = { patientId: string; name: string; testId: string | null; performedAt: string; value: number };

const byResult = (type: string, metric: string, extra = "") =>
  `select p.id as patientId, p.name, t.id as testId, t.performed_at as performedAt, r.value
     from tests t join patients p on p.id = t.patient_id
     join results r on r.test_id = t.id and r.metric = '${metric}' and r.series_index = 0
    where t.type = '${type}' ${extra}`;

const sprintSplit = `select p.id as patientId, p.name, t.id as testId, t.performed_at as performedAt, r.value
     from tests t join patients p on p.id = t.patient_id
     join results r on r.test_id = t.id and r.metric = 'split_time_s' and r.series_index > 0
    where t.type = 'sprint_linear' and json_extract(t.details, '$.gates[' || (r.series_index - 1) || ']') = ?`;

const m = (id: string, group: string, label: string, unit: string, digits: number, better: "high" | "low", sql: string, bind: (string | number)[] = []): CompareMetric => ({
  id,
  group,
  label,
  unit,
  digits,
  better,
  sql,
  bind,
});

export const compareMetrics: CompareMetric[] = [
  m("cmj", "Saltos", "CMJ · altura", "cm", 1, "high", byResult("cmj", "jump_height_cm")),
  m("sj", "Saltos", "SJ · altura (sin carga)", "cm", 1, "high", byResult("sj", "jump_height_cm", "and t.extra_load_kg = 0")),
  m("cmj_power", "Saltos", "CMJ · potencia relativa", "W/kg", 1, "high", byResult("cmj", "relative_power_w_kg", "and t.extra_load_kg = 0")),
  m("dj_rsi", "Saltos", "Drop jump · RSI", "", 2, "high", byResult("dj", "rsi")),
  m("rj_rsi", "Saltos", "10/5 · RSI", "", 2, "high", byResult("rj_10_5", "rsi")),
  m("horizontal", "Saltos", "Salto horizontal", "cm", 0, "high", byResult("horizontal", "jump_distance_cm")),
  m("sprint10", "Sprint", "Sprint · 10 m", "s", 2, "low", sprintSplit, [10]),
  m("sprint20", "Sprint", "Sprint · 20 m", "s", 2, "low", sprintSplit, [20]),
  m("sprint30", "Sprint", "Sprint · 30 m", "s", 2, "low", sprintSplit, [30]),
  m("sprint_vmax", "Sprint", "Sprint · velocidad máxima", "m/s", 2, "high", byResult("sprint_linear", "max_velocity_m_s")),
  m("sprint_f0", "Sprint", "Sprint · F0", "N/kg", 1, "high", byResult("sprint_linear", "f0_n_kg")),
  m("sprint_pmax", "Sprint", "Sprint · Pmáx", "W/kg", 1, "high", byResult("sprint_linear", "pmax_w_kg")),
  m("cod_505", "Cambio de dirección", "5-0-5 (mejor giro)", "s", 2, "low", byResult("cod_505", "time_s")),
  m("cod_5plus5", "Cambio de dirección", "5+5 (mejor giro)", "s", 2, "low", byResult("cod_5plus5", "time_s")),
  m("cod_vcut", "Cambio de dirección", "V-Cut", "s", 2, "low", byResult("cod_vcut", "time_s")),
  m("cod_illinois", "Cambio de dirección", "Illinois", "s", 2, "low", byResult("cod_illinois", "time_s")),
  m(
    "squat_1rm",
    "Fuerza",
    "Sentadilla · 1RM estimado",
    "kg",
    1,
    "high",
    `select p.id as patientId, p.name, null as testId, pr.performed_at as performedAt, pr.one_rm_kg as value
       from profiles pr join patients p on p.id = pr.patient_id
      where pr.kind = 'load_velocity' and pr.exercise = 'squat'`,
  ),
  m("nordic", "Isquios", "Nórdico · ángulo de rotura", "°", 0, "high", byResult("nordic", "angle_deg")),
  m("nordic_torque", "Isquios", "Nórdico · momento por pierna", "N·m", 0, "high", byResult("nordic", "torque_nm")),
  m("lunge", "Movilidad", "Lunge · mejor lado", "°", 0, "high", byResult("rom_ankle", "angle_deg", "and json_extract(t.details, '$.movement') = 'ankle_lunge'")),
  m("running_contact", "Carrera", "Carrera · tiempo de contacto", "ms", 0, "low", byResult("running", "contact_time_ms")),
];

export type RankingRow = Row & { rank: number; count: number };
export type CompareMode = "best" | "latest";

/** Una fila por paciente con su mejor marca (o la última), ordenadas de mejor a peor. */
export async function ranking(db: Db, metricId: string, mode: CompareMode): Promise<RankingRow[]> {
  const metric = compareMetrics.find((x) => x.id === metricId);
  if (!metric) throw new Error("Medida desconocida.");
  const rows = await db.query<Row>(metric.sql, metric.bind);
  const better = (a: number, b: number) => (metric.better === "high" ? a > b : a < b);
  const byPatient = new Map<string, { row: Row; count: number }>();
  for (const r of rows) {
    const cur = byPatient.get(r.patientId);
    if (!cur) byPatient.set(r.patientId, { row: r, count: 1 });
    else {
      cur.count++;
      const replace = mode === "latest" ? r.performedAt > cur.row.performedAt : better(r.value, cur.row.value);
      if (replace) cur.row = r;
    }
  }
  const list = [...byPatient.values()].sort((a, b) => (metric.better === "high" ? b.row.value - a.row.value : a.row.value - b.row.value));
  let rank = 0;
  return list.map((x, i) => {
    // Empates: misma posición.
    if (i === 0 || x.row.value !== list[i - 1]!.row.value) rank = i + 1;
    return { ...x.row, rank, count: x.count };
  });
}
