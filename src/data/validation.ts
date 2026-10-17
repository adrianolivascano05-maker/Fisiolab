// Validación de Cénit: pares de medidas (Cénit frente a una referencia, dos marcaciones del mismo
// vídeo o la propuesta de la IA frente a las marcas finales) y lo que hace falta para calcularlos.
import { computeJump, type JumpType, type MarkInput } from "../calc/results";
import { velocitiesFromMarks, type RepMark } from "../calc/strength";
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

export type ValidationKind = "jump_height" | "bar_velocity" | "nordic_torque" | "rom_angle" | "free_angle" | "sprint_time";
export type Comparison = "reference" | "remark" | "ai";

export type KindInfo = {
  id: ValidationKind;
  label: string;
  unit: string;
  digits: number;
  /** Diferencia que importa en la clínica, por defecto (editable). */
  delta: number;
  /** Métrica de los resultados de Cénit que se compara (null: solo a mano). */
  metric: string | null;
  references: string[];
  protocol: string[];
};

export const kinds: KindInfo[] = [
  {
    id: "jump_height",
    label: "Altura del salto",
    unit: "cm",
    digits: 1,
    delta: 2,
    metric: "jump_height_cm",
    references: ["Plataforma de fuerza", "My Jump Lab", "Células fotoeléctricas (alfombra o barras)"],
    protocol: [
      "Cada salto se mide a la vez con las dos herramientas: graba con Cénit mientras la persona salta sobre la plataforma (o la otra app graba el mismo salto).",
      "20-30 saltos o más, de varias personas y alturas distintas (unos flojos y otros a tope): así se ve si el error cambia con la altura.",
      "Móvil fijo en un trípode, de lado y a la altura de los pies, a 120-240 fps.",
      "Marca sin mirar el valor de la referencia, para no influirte.",
    ],
  },
  {
    id: "bar_velocity",
    label: "Velocidad media de la barra",
    unit: "m/s",
    digits: 2,
    delta: 0.05,
    metric: "bar_velocity_m_s",
    references: ["Encoder lineal", "Plataforma de fuerza", "Otra app"],
    protocol: [
      "Cada repetición se mide a la vez con Cénit y con el encoder: compara la repetición más rápida de cada serie.",
      "Varias cargas, de ligeras (rápidas) a pesadas (lentas), y 20 series o más.",
      "Mide bien el recorrido de la barra: Cénit divide ese recorrido entre el tiempo de subida.",
    ],
  },
  {
    id: "nordic_torque",
    label: "Fuerza del nórdico (momento)",
    unit: "N·m",
    digits: 0,
    delta: 10,
    metric: "torque_nm",
    references: ["Dinamómetro de isquios", "Dinamómetro isocinético"],
    protocol: [
      "Cada nórdico sobre el dinamómetro y grabado con Cénit a la vez; anota el momento por pierna del dinamómetro.",
      "El cálculo de Cénit es un modelo propio (sin validar): este es el paso que dice si sirve.",
    ],
  },
  {
    id: "rom_angle",
    label: "Ángulo de movilidad",
    unit: "°",
    digits: 0,
    delta: 5,
    metric: "angle_deg",
    references: ["Goniómetro", "Inclinómetro digital", "Otra app"],
    protocol: [
      "Misma posición, misma persona: mide con Cénit y, sin moverla, con el goniómetro o el inclinómetro.",
      "Antes, comprueba el sensor del móvil (abajo) en una mesa y en un marco de puerta.",
      "20 medidas o más, de varios movimientos y rangos.",
    ],
  },
  {
    id: "free_angle",
    label: "Medición libre (ángulo)",
    unit: "°",
    digits: 0,
    delta: 5,
    metric: null,
    references: ["Goniómetro", "Análisis 2D en vídeo", "Captura de movimiento"],
    protocol: [
      "Pide a la persona que se quede quieta en la posición; mide con el goniómetro y graba a la vez.",
      "Compara el ángulo de Cénit en ese mismo fotograma (anótalo a mano).",
      "Prueba de frente y en diagonal: así se ve cuánto corrige el plano anatómico.",
    ],
  },
  {
    id: "sprint_time",
    label: "Tiempo de sprint",
    unit: "s",
    digits: 2,
    delta: 0.05,
    metric: "time_s",
    references: ["Células fotoeléctricas", "Cronómetro manual", "Otra app"],
    protocol: ["Cada sprint con las células y grabado a la vez con Cénit, con el móvil de lado y quieto.", "20 sprints o más."],
  },
];

export const getKind = (id: string) => kinds.find((k) => k.id === id);

export const comparisonLabels: Record<Comparison, string> = {
  reference: "Cénit frente a una referencia",
  remark: "Fiabilidad: dos marcaciones del mismo vídeo",
  ai: "IA frente a tus marcas finales",
};

export type ValidationPair = {
  id: string;
  kind: ValidationKind;
  comparison: Comparison;
  referenceLabel: string;
  impulsoValue: number;
  referenceValue: number;
  patientId: string | null;
  testId: string | null;
  patientName: string | null;
  notes: string;
  createdAt: string;
};

export type NewPair = Omit<ValidationPair, "id" | "createdAt" | "patientName">;

export async function addPair(db: Db, p: NewPair): Promise<string> {
  const id = crypto.randomUUID();
  if (!Number.isFinite(p.impulsoValue) || !Number.isFinite(p.referenceValue)) throw new Error("Faltan los dos valores.");
  await db.transaction([
    {
      sql: `insert into validation_pairs (id, kind, comparison, reference_label, impulso_value, reference_value, patient_id, test_id, notes, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, p.kind, p.comparison, p.referenceLabel.trim(), p.impulsoValue, p.referenceValue, p.patientId, p.testId, p.notes.trim(), new Date().toISOString()],
    },
  ]);
  return id;
}

/** Una sola comparación IA por test: la última sustituye a la anterior. */
export async function replaceAiPair(db: Db, p: NewPair & { testId: string }): Promise<void> {
  await db.transaction([{ sql: "delete from validation_pairs where comparison = 'ai' and test_id = ?", bind: [p.testId] }]);
  await addPair(db, p);
}

export async function listPairs(db: Db, kind: ValidationKind, comparison?: Comparison): Promise<ValidationPair[]> {
  return db.query<ValidationPair>(
    `select v.id, v.kind, v.comparison, v.reference_label as referenceLabel, v.impulso_value as impulsoValue,
            v.reference_value as referenceValue, v.patient_id as patientId, v.test_id as testId, p.name as patientName,
            v.notes, v.created_at as createdAt
       from validation_pairs v left join patients p on p.id = v.patient_id
      where v.kind = ? and (? is null or v.comparison = ?)
      order by v.created_at desc, v.rowid desc`,
    [kind, comparison ?? null, comparison ?? null],
  );
}

export async function countPairs(db: Db): Promise<Record<string, number>> {
  const rows = await db.query<{ key: string; n: number }>("select kind || ':' || comparison as key, count(*) as n from validation_pairs group by kind, comparison");
  return Object.fromEntries(rows.map((r) => [r.key, r.n]));
}

export async function deletePair(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from validation_pairs where id = ?", bind: [id] }]);
}

/** Resultados de Cénit que se pueden comparar (los últimos 100), para no copiarlos a mano. */
export async function candidates(db: Db, kind: ValidationKind) {
  const k = getKind(kind);
  if (!k?.metric) return [];
  return db.query<{ testId: string; patientId: string; patientName: string; type: string; performedAt: string; value: number }>(
    `select t.id as testId, p.id as patientId, p.name as patientName, t.type, t.performed_at as performedAt, r.value
       from results r join tests t on t.id = r.test_id join patients p on p.id = t.patient_id
      where r.metric = ? and r.series_index = 0
      order by t.performed_at desc limit 100`,
    [k.metric],
  );
}

export async function getDelta(db: Db, kind: ValidationKind): Promise<number> {
  return (await getSetting<number>(db, `validation.delta.${kind}`)) ?? getKind(kind)!.delta;
}

export async function setDelta(db: Db, kind: ValidationKind, value: number): Promise<void> {
  if (!(value > 0)) throw new Error("La diferencia tiene que ser mayor que cero.");
  await setSetting(db, `validation.delta.${kind}`, value);
}

/**
 * Valor principal de un test calculado con unas marcas, sin guardar nada: altura en saltos simples,
 * velocidad de la repetición más rápida en fuerza. Para comparar marcaciones.
 */
export function primaryValue(type: string, marks: MarkInput[], captureFps: number, details: Record<string, unknown>, dropHeightCm: number | null) {
  if (type === "vbt") {
    const romCm = Number(details.romCm);
    if (!(romCm > 0)) return null;
    const reps = marks.filter((m): m is RepMark => m.event === "bar_start" || m.event === "bar_end");
    const v = velocitiesFromMarks(reps, romCm / 100, captureFps);
    return v.length ? { kind: "bar_velocity" as const, value: Math.max(...v) } : null;
  }
  if (type === "rj_10_5" || type === "horizontal") return null;
  const out = computeJump({ type: type as JumpType, captureFps, marks, bodyMassKg: null, extraLoadKg: 0, pushOffDistanceCm: null, dropHeightCm });
  const h = out.results.find((r) => r.metric === "jump_height_cm");
  return h ? { kind: "jump_height" as const, value: h.value } : null;
}

/** Pares en CSV para Excel (punto y coma, coma decimal). */
export function pairsCsv(pairs: ValidationPair[], unit: string): string {
  const num = (n: number) => String(Number(n.toFixed(4))).replace(".", ",");
  const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["fecha", "comparacion", "referencia", "paciente", `impulso_${unit}`, `referencia_${unit}`, `diferencia_${unit}`, "notas"];
  const rows = pairs.map((p) =>
    [p.createdAt.slice(0, 10), p.comparison, cell(p.referenceLabel), cell(p.patientName ?? ""), num(p.impulsoValue), num(p.referenceValue), num(p.impulsoValue - p.referenceValue), cell(p.notes)].join(";"),
  );
  return "﻿" + [header.join(";"), ...rows].join("\r\n") + "\r\n";
}
