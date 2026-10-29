// Sprint, cambio de dirección (S15-S16) y carrera (S18): tiempos y marcas.
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import type { JumpOutput, MarkEvent, MarkInput } from "../calc/results";
import { segments, sprintProfile, validSplits } from "../calc/sprint";
import { type CodType, isCodType } from "../calc/cod";
import { summarizeRunning } from "../calc/running";
import type { Db } from "./db";
import { newId, now } from "./ids";
import { resultStatements } from "./strengthTests";
import { getTest, type Side, type Test } from "./tests";

export type TimedMethod = "video" | "manual";
export type NewTimedTest = { patientId: string; type: "sprint_linear" | CodType; side?: Side | null; gates?: number[]; method: TimedMethod };

export async function createTimedTest(db: Db, input: NewTimedTest): Promise<string> {
  if (input.type === "sprint_linear" && !input.gates?.length) throw new Error("Indica las distancias de los pasos.");
  const id = newId();
  const t = now();
  const details = input.type === "sprint_linear" ? { gates: input.gates, method: input.method } : { method: input.method };
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, side, performed_at, details, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, input.type === "sprint_linear" ? "sprint" : "cod", input.type, input.side ?? null, t, JSON.stringify(details), t, t],
    },
  ]);
  return id;
}

export async function createRunningTest(db: Db, patientId: string, firstSide: Side, speedKmh: number | null): Promise<string> {
  if (speedKmh !== null && !(speedKmh > 0 && speedKmh <= 40)) throw new RangeError("La velocidad debe estar entre 1 y 40 km/h.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, details, created_at, updated_at)
            values (?, ?, 'running', 'running', ?, ?, ?, ?)`,
      bind: [id, patientId, t, JSON.stringify({ firstSide, speedKmh, method: "video" }), t, t],
    },
  ]);
  return id;
}

type Row = { metric: string; value: number; unit: string; seriesIndex: number };

function sprintRows(gates: number[], times: number[]): Row[] {
  const splits = gates.map((d, i) => ({ distanceM: d, timeS: times[i]! }));
  if (!validSplits(splits)) throw new RangeError("Cada paso debe llegar después del anterior.");
  const rows: Row[] = times.map((t, i) => ({ metric: "split_time_s", value: t, unit: "s", seriesIndex: i + 1 }));
  rows.push({ metric: "time_s", value: times.at(-1)!, unit: "s", seriesIndex: 0 });
  rows.push({ metric: "max_velocity_m_s", value: Math.max(...segments(splits).map((s) => s.velocity)), unit: "m/s", seriesIndex: 0 });
  if (splits.length >= 3) {
    try {
      const p = sprintProfile(splits);
      rows.push(
        { metric: "f0_n_kg", value: p.f0, unit: "N/kg", seriesIndex: 0 },
        { metric: "v0_m_s", value: p.v0, unit: "m/s", seriesIndex: 0 },
        { metric: "pmax_w_kg", value: p.pmax, unit: "W/kg", seriesIndex: 0 },
        { metric: "tau_s", value: p.tau, unit: "s", seriesIndex: 0 },
      );
    } catch {
      // Tiempos que no encajan con el modelo: se guardan los pasos sin perfil.
    }
  }
  return rows;
}

function runningRows(contacts: number[], takeoffs: number[], details: Record<string, unknown>): Row[] {
  const speed = typeof details.speedKmh === "number" ? details.speedKmh : null;
  const r = summarizeRunning(contacts, takeoffs, details.firstSide === "right" ? "right" : "left", speed);
  const rows: Row[] = [];
  r.steps.forEach((s, i) => {
    rows.push({ metric: "contact_time_ms", value: s.contactS * 1000, unit: "ms", seriesIndex: i + 1 });
    if (s.flightS !== null) rows.push({ metric: "flight_time_ms", value: s.flightS * 1000, unit: "ms", seriesIndex: i + 1 });
  });
  rows.push({ metric: "contact_time_ms", value: r.contactS * 1000, unit: "ms", seriesIndex: 0 });
  if (r.flightS !== null) rows.push({ metric: "flight_time_ms", value: r.flightS * 1000, unit: "ms", seriesIndex: 0 });
  if (r.frequencySpm !== null) rows.push({ metric: "step_frequency_spm", value: r.frequencySpm, unit: "pasos/min", seriesIndex: 0 });
  if (r.dutyFactor !== null) rows.push({ metric: "duty_factor", value: r.dutyFactor, unit: "", seriesIndex: 0 });
  if (r.stepLengthM !== null) rows.push({ metric: "step_length_m", value: r.stepLengthM, unit: "m", seriesIndex: 0 });
  if (r.asymmetryPct !== null) rows.push({ metric: "asymmetry_pct", value: r.asymmetryPct, unit: "%", seriesIndex: 0 });
  return rows;
}

/** Marcas de sprint (salida y pasos), cambio de dirección (salida y llegada) o carrera (contactos y despegues). */
export async function saveTimedMarks(db: Db, test: Test, marks: MarkInput[]): Promise<JumpOutput> {
  const fps = test.video!.captureFps;
  const sec = (f: number) => f / fps;
  const frames = (e: MarkEvent) => marks.filter((m) => m.event === e).sort((a, b) => a.seriesIndex - b.seriesIndex).map((m) => m.frame);
  let rows: Row[];
  if (test.type === "running") {
    rows = runningRows(frames("contact").map(sec), frames("takeoff").map(sec), test.details);
  } else {
    const start = frames("start")[0];
    if (start === undefined) return { results: [], warnings: [], missing: ["start"] };
    if (test.type === "sprint_linear") {
      const gates = (test.details.gates as number[]) ?? [];
      const splits = frames("split");
      if (splits.length < gates.length) return { results: [], warnings: [], missing: ["split"] };
      rows = sprintRows(gates, splits.map((f) => sec(f - start)));
    } else {
      const finish = frames("finish")[0];
      if (finish === undefined || finish <= start) return { results: [], warnings: [], missing: ["finish"] };
      rows = [{ metric: "time_s", value: sec(finish - start), unit: "s", seriesIndex: 0 }];
    }
  }
  const t = now();
  await db.transaction([
    { sql: "delete from marks where test_id = ?", bind: [test.id] },
    ...marks.map((m) => ({
      sql: "insert into marks (id, test_id, event, series_index, time_s, frame_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), test.id, m.event, m.seriesIndex, sec(m.frame), m.frame, t],
    })),
    ...resultStatements(test.id, rows),
  ]);
  return { results: [], warnings: [], missing: [] };
}

/** Sin vídeo: tiempos de fotocélulas o cronómetro. Sprint: uno por paso, acumulados desde la salida. */
export async function saveTimes(db: Db, testId: string, times: number[]): Promise<void> {
  const test = await getTest(db, testId);
  if (!test) throw new Error("El test no existe.");
  if (times.some((t) => !(t > 0 && t < 120))) throw new RangeError("Cada tiempo debe estar entre 0 y 120 s.");
  let rows: Row[];
  if (test.type === "sprint_linear") {
    const gates = (test.details.gates as number[]) ?? [];
    if (times.length !== gates.length) throw new RangeError("Falta algún tiempo de paso.");
    rows = sprintRows(gates, times);
  } else if (isCodType(test.type)) {
    if (times.length !== 1) throw new RangeError("Escribe un tiempo.");
    rows = [{ metric: "time_s", value: times[0]!, unit: "s", seriesIndex: 0 }];
  } else throw new Error("Este test no se mide con tiempos.");
  await db.transaction(resultStatements(testId, rows));
}

export type TimedEntry = { testId: string; type: string; side: Side | null; performedAt: string; timeS: number };

/** Tiempos totales de un tipo de test (sprint o cambio de dirección), el más reciente primero. */
export async function timedEntries(db: Db, patientId: string, type: string): Promise<TimedEntry[]> {
  return db.query<TimedEntry>(
    `select t.id as testId, t.type, t.side, t.performed_at as performedAt, r.value as timeS
       from tests t join results r on r.test_id = t.id and r.metric = 'time_s' and r.series_index = 0
      where t.patient_id = ? and t.type = ?
      order by t.performed_at desc`,
    [patientId, type],
  );
}

/** Mejor tiempo en un paso de una distancia (p. ej. 10 m) en los sprints del paciente, con su fecha. */
export async function bestSprintSplit(db: Db, patientId: string, distanceM: number): Promise<{ timeS: number; performedAt: string } | null> {
  const [row] = await db.query<{ timeS: number; performedAt: string }>(
    `select r.value as timeS, t.performed_at as performedAt
       from tests t join results r on r.test_id = t.id and r.metric = 'split_time_s' and r.series_index > 0
      where t.patient_id = ? and t.type = 'sprint_linear'
        and json_extract(t.details, '$.gates[' || (r.series_index - 1) || ']') = ?
      order by r.value limit 1`,
    [patientId, distanceM],
  );
  return row ?? null;
}
