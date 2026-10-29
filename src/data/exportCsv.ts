// Exportación de todo en CSV.
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { getMovement, methodLabels, movementLabel, type RomMethod } from "../calc/rom";
import { isCodType } from "../calc/cod";
import { getExercise } from "../calc/strength";
import type { Db } from "./db";

/**
 * Todos los resultados en CSV "largo" (una fila por métrica), pensado para Excel en español:
 * separador punto y coma, coma decimal y BOM para que respete las tildes.
 */
export async function exportCsv(db: Db): Promise<string> {
  const rows = await db.query<{
    patient: string;
    performed_at: string;
    type: string;
    extra_load_kg: number;
    drop_height_cm: number | null;
    capture_fps: number | null;
    metric: string;
    value: number;
    unit: string;
    side: string | null;
    series_index: number;
    movement: string | null;
    method: string | null;
    exercise: string | null;
    gates: string | null;
  }>(
    `select p.name as patient, t.performed_at, t.type, t.side, t.extra_load_kg, t.drop_height_cm, v.fps as capture_fps,
            json_extract(t.details, '$.movement') as movement, json_extract(t.details, '$.method') as method,
            json_extract(t.details, '$.exercise') as exercise, json_extract(t.details, '$.gates') as gates,
            r.metric, r.value, r.unit, r.series_index
       from results r
       join tests t on t.id = r.test_id
       join patients p on p.id = t.patient_id
       left join videos v on v.test_id = t.id
      order by p.name collate nocase, t.performed_at, r.series_index, r.rowid`,
  );
  const num = (n: number | null, digits = 4) =>
    n === null ? "" : String(Number(n.toFixed(digits))).replace(".", ",");
  const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["paciente", "fecha", "test", "movimiento", "lado", "metodo", "carga_kg", "altura_caida_cm", "fps_grabacion", "intento", "metrica", "valor", "unidad"];
  const lines = rows.map((r) => {
    const movement = r.movement ? getMovement(r.movement) : undefined;
    const exercise = r.exercise ? getExercise(r.exercise) : undefined;
    const method = !r.method
      ? ""
      : r.type.startsWith("rom_")
        ? methodLabels[r.method as RomMethod]
        : r.method === "video"
          ? "Vídeo"
          : r.type === "vbt"
            ? "Encoder (a mano)"
            : r.type === "sprint_linear" || isCodType(r.type)
              ? "Fotocélulas o cronómetro"
              : "A mano";
    return [
      cell(r.patient),
      r.performed_at,
      r.type,
      movement
        ? cell(movementLabel(movement))
        : exercise
          ? cell(exercise.label)
          : r.gates
            ? `pasos ${(JSON.parse(r.gates) as number[]).join("-")} m`
            : "",
      r.side === "left" ? "izquierda" : r.side === "right" ? "derecha" : "",
      method ? cell(method) : "",
      num(r.extra_load_kg),
      num(r.drop_height_cm),
      num(r.capture_fps),
      r.series_index ? String(r.series_index) : "",
      r.metric,
      num(r.value),
      r.unit,
    ].join(";");
  });
  // Bienestar: una fila por respuesta, con el test «bienestar».
  const wellness = await db.query<{ patient: string; performed_at: string } & Record<"sleep" | "fatigue" | "stress" | "soreness" | "mood" | "pain", number | null>>(
    `select p.name as patient, w.performed_at, w.fatigue, w.sleep, w.soreness, w.stress, w.mood, w.pain
       from wellness w join patients p on p.id = w.patient_id
      order by p.name collate nocase, w.performed_at`,
  );
  const wellnessMetrics = [
    ["fatigue", "fatiga"],
    ["sleep", "sueno"],
    ["soreness", "dolor_muscular"],
    ["stress", "estres"],
    ["mood", "animo"],
    ["pain", "dolor_eva"],
  ] as const;
  for (const w of wellness) {
    for (const [col, metric] of wellnessMetrics) {
      if (w[col] === null) continue;
      lines.push([cell(w.patient), w.performed_at, "bienestar", "", "", "", "", "", "", "", metric, num(w[col]), col === "pain" ? "0-10" : "1-5"].join(";"));
    }
  }
  // Ficha clínica: el dolor de cada sesión y el resultado de cada test de exploración (1 positivo, 0 negativo).
  const sessions = await db.query<{ patient: string; performed_at: string; pain: number }>(
    `select p.name as patient, s.performed_at, s.pain from sessions s join patients p on p.id = s.patient_id
      where s.pain is not null order by p.name collate nocase, s.performed_at`,
  );
  for (const s of sessions) lines.push([cell(s.patient), s.performed_at, "sesion", "", "", "", "", "", "", "", "dolor_eva", num(s.pain), "0-10"].join(";"));
  const findings = await db.query<{ patient: string; performed_at: string; test_name: string; side: string | null; result: string }>(
    `select p.name as patient, f.performed_at, f.test_name, f.side, f.result from findings f join patients p on p.id = f.patient_id
      order by p.name collate nocase, f.performed_at`,
  );
  const sideText: Record<string, string> = { left: "izquierda", right: "derecha", both: "ambos" };
  const resultText: Record<string, [string, string]> = { positive: ["1", "positivo"], negative: ["0", "negativo"], inconclusive: ["", "dudoso"] };
  for (const f of findings) {
    const [value, word] = resultText[f.result]!;
    lines.push([cell(f.patient), f.performed_at, "exploracion", cell(f.test_name), f.side ? sideText[f.side] : "", "", "", "", "", "", "resultado", value, word].join(";"));
  }
  const questionnaires = await db.query<{ patient: string; performed_at: string; kind: string; score: number; details: string }>(
    `select p.name as patient, q.performed_at, q.kind, q.score, q.details from questionnaires q join patients p on p.id = q.patient_id
      order by p.name collate nocase, q.performed_at`,
  );
  for (const q of questionnaires) {
    const d = JSON.parse(q.details) as { subscale?: string; name?: string };
    const name = `${q.kind === "otro" ? (d.name ?? "otro") : q.kind}${d.subscale ? ` · ${d.subscale}` : ""}`;
    lines.push([cell(q.patient), q.performed_at, "cuestionario", cell(name), "", "", "", "", "", "", "puntuacion", num(q.score), ""].join(";"));
  }
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}
