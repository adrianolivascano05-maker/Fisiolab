// Perfil fuerza-velocidad (S09) y asimetría entre piernas (S10).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { type FvProfile, fvProfile, type Point } from "../calc/profile";
import type { Db } from "./db";
import { newId, now } from "./ids";
import { getPatient } from "./patients";
import type { Side } from "./tests";

export type FvCandidate = {
  testId: string;
  type: "cmj" | "sj";
  performedAt: string;
  extraLoadKg: number;
  heightCm: number;
  /** Fuerza media por kg de masa corporal (N/kg) y velocidad media (m/s) del empuje. */
  force: number;
  velocity: number;
};

/** Saltos con fuerza y velocidad calculadas (hace falta masa y distancia de empuje). */
export async function fvCandidates(db: Db, patientId: string): Promise<FvCandidate[]> {
  const patient = await getPatient(db, patientId);
  if (!patient?.bodyMassKg) return [];
  const rows = await db.query<{ testId: string; type: "cmj" | "sj"; performedAt: string; extraLoadKg: number; heightCm: number; forceN: number; velocity: number }>(
    `select t.id as testId, t.type, t.performed_at as performedAt, t.extra_load_kg as extraLoadKg,
            h.value as heightCm, f.value as forceN, v.value as velocity
       from tests t
       join results h on h.test_id = t.id and h.metric = 'jump_height_cm' and h.series_index = 0
       join results f on f.test_id = t.id and f.metric = 'force_n' and f.series_index = 0
       join results v on v.test_id = t.id and v.metric = 'velocity_m_s' and v.series_index = 0
      where t.patient_id = ? and t.type in ('cmj', 'sj')
      order by t.performed_at desc`,
    [patientId],
  );
  return rows.map((r) => ({ ...r, force: r.forceN / patient.bodyMassKg! }));
}

export type SavedProfile = FvProfile & { id: string; type: "cmj" | "sj"; performedAt: string; testIds: string[] };

export async function saveFvProfile(db: Db, patientId: string, type: "cmj" | "sj", tests: FvCandidate[]): Promise<string> {
  const patient = await getPatient(db, patientId);
  const points: Point[] = tests.map((c) => ({ velocity: c.velocity, force: c.force }));
  const p = fvProfile(points, patient?.pushOffDistanceCm ? patient.pushOffDistanceCm / 100 : null);
  const id = newId();
  const t = now();
  const performedAt = tests.map((c) => c.performedAt).sort().at(-1)!;
  await db.transaction([
    {
      sql: `insert into profiles (id, patient_id, kind, performed_at, exercise, f0_n_kg, v0_m_s, pmax_w_kg, slope, optimal_slope,
                                  imbalance_pct, r_squared, created_at, updated_at)
            values (?, ?, 'force_velocity', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, performedAt, type, p.f0, p.v0, p.pmax, p.slope, p.optimalSlope, p.imbalancePct, Math.min(1, Math.max(0, p.r2)), t, t],
    },
    ...tests.map((c) => ({ sql: "insert into profile_tests (profile_id, test_id) values (?, ?)", bind: [id, c.testId] })),
  ]);
  return id;
}

export async function listFvProfiles(db: Db, patientId: string): Promise<SavedProfile[]> {
  const rows = await db.query<{
    id: string;
    exercise: "cmj" | "sj";
    performed_at: string;
    f0_n_kg: number;
    v0_m_s: number;
    pmax_w_kg: number;
    slope: number;
    optimal_slope: number | null;
    imbalance_pct: number | null;
    r_squared: number;
    test_ids: string;
  }>(
    `select p.*, (select group_concat(test_id) from profile_tests pt where pt.profile_id = p.id) as test_ids
       from profiles p where p.patient_id = ? and p.kind = 'force_velocity' order by p.performed_at desc, p.created_at desc`,
    [patientId],
  );
  return rows.map((r) => {
    const ratio = r.optimal_slope ? r.slope / r.optimal_slope : null;
    return {
      id: r.id,
      type: r.exercise,
      performedAt: r.performed_at,
      testIds: (r.test_ids ?? "").split(",").filter(Boolean),
      f0: r.f0_n_kg,
      v0: r.v0_m_s,
      pmax: r.pmax_w_kg,
      slope: r.slope,
      r2: r.r_squared,
      optimalSlope: r.optimal_slope,
      ratioPct: ratio === null ? null : ratio * 100,
      imbalancePct: r.imbalance_pct,
      orientation: r.imbalance_pct === null ? null : r.imbalance_pct < 10 ? "balanced" : ratio! < 1 ? "force_deficit" : "velocity_deficit",
    };
  });
}

export async function deleteFvProfile(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from profiles where id = ?", bind: [id] }]);
}

// ---------- Asimetría (S10) ----------

export type SideJump = { testId: string; side: Side; performedAt: string; heightCm: number };

/** Saltos unipodales con altura, del más reciente al más antiguo. */
export async function singleLegJumps(db: Db, patientId: string): Promise<SideJump[]> {
  return db.query<SideJump>(
    `select t.id as testId, t.side, t.performed_at as performedAt, r.value as heightCm
       from tests t join results r on r.test_id = t.id and r.metric = 'jump_height_cm' and r.series_index = 0
      where t.patient_id = ? and t.type = 'single_leg' and t.side is not null
      order by t.performed_at desc`,
    [patientId],
  );
}
