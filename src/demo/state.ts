// Si la clínica tiene cargados los datos de prueba (src/demo/generate.ts) y qué se creó, para borrarlo entero. Aparte
// del generador para que Ajustes lo sepa sin cargar los casos ni la galería de tests.
import type { Db } from "../data/db";

export type DemoMode = "normal" | "stress";
export const DEMO_PATIENTS: Record<DemoMode, number> = { normal: 100, stress: 500 };
/** Lo que se creó, para borrarlo entero (y nada más). */
export const DEMO_KEY = "demo_data";
export type DemoMarker = {
  v: 1;
  mode: DemoMode;
  createdAt: string;
  patients: string[];
  /** Fisios inventados que se añadieron al horario (no quien lo cargó). */
  staff: string[];
  shifts: string[];
  closures: string[];
  /** Los ajustes que se tocaron, con lo que valían antes (el JSON guardado, o null si no estaban). */
  previous: Record<string, string | null>;
};

export async function demoState(db: Db): Promise<{ marker: DemoMarker | null; patients: number }> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [DEMO_KEY]);
  const [{ n }] = (await db.query<{ n: number }>("select count(*) as n from patients")) as [{ n: number }];
  return { marker: row ? (JSON.parse(row.value) as DemoMarker) : null, patients: n };
}

