// Enlace de la ficha clínica con la galería de tests (src/gallery): buscar tests, proponer los de la zona y
// leer lo que significa un resultado con sus razones de verosimilitud. Si se quita la galería, solo hay que
// quitar este archivo y las pantallas que lo usan (los hallazgos guardados llevan su nombre y su región).
import { tests } from "../gallery/data";
import { likelihoodRatios, lrMeaning } from "../gallery/evidence";
import { regionOf } from "../gallery/regions";
import type { SpecialTest } from "../gallery/types";
import type { FindingResult } from "../data/clinical";

export type { SpecialTest };
export const galleryTests = tests;
export const findTest = (id: string) => tests.find((t) => t.id === id);
export const galleryUrl = (t: SpecialTest) => `/biblioteca/${regionOf(t.region).slug}/${t.id}`;
export const galleryRegionLabel = (t: SpecialTest) => regionOf(t.region).label;

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Tests cuyo nombre, otros nombres o patología contienen el texto. */
export function searchTests(q: string, limit = 30): SpecialTest[] {
  const n = norm(q.trim());
  if (!n) return [];
  return tests.filter((t) => norm([t.name, ...(t.aka ?? []), t.group].join(" ")).includes(n)).slice(0, limit);
}

const rank = { alta: 0, moderada: 1, baja: 2, desconocida: 3 } as const;
const hasData = (t: SpecialTest) => t.accuracy.some((a) => a.sens !== undefined || a.spec !== undefined || a.lrPos !== undefined || a.lrNeg !== undefined);

/** Todos los tests de esas zonas (también los grupos de tests y las reglas de decisión), primero los de más utilidad contrastada. */
export function testsForRegions(regionIds: string[]): SpecialTest[] {
  return tests
    .filter((t) => regionIds.includes(t.region))
    .sort((a, b) => Number(hasData(b)) - Number(hasData(a)) || rank[a.utility] - rank[b.utility]);
}

/** Los tests de cada zona por separado (en el orden de las zonas): ninguna zona se queda sin los suyos. */
export function testsByRegion(regionIds: string[]): { region: string; tests: SpecialTest[] }[] {
  return regionIds.map((region) => ({ region, tests: testsForRegions([region]) })).filter((g) => g.tests.length);
}

/** La fila de evidencia más completa del test. */
function bestRow(t: SpecialTest) {
  const rows = t.accuracy.map((a) => ({ a, lr: likelihoodRatios(a) }));
  const score = (r: (typeof rows)[number]) => [r.a.sens, r.a.spec, r.lr.pos ?? undefined, r.lr.neg ?? undefined].filter((v) => v !== undefined).length;
  return rows.filter((r) => score(r) > 0).sort((x, y) => score(y) - score(x))[0];
}

/** Qué aporta este resultado: «LR+ 8,5: cambio moderado, ayuda a confirmar (Benjaminse et al., 2006)». */
export function resultMeaning(t: SpecialTest | undefined, result: FindingResult): { lr: number; text: string; source: string } | null {
  if (!t || result === "inconclusive") return null;
  const row = bestRow(t);
  const lr = result === "positive" ? row?.lr.pos : row?.lr.neg;
  if (!row || lr === null || lr === undefined) return null;
  return { lr, text: lrMeaning(lr, result === "positive"), source: row.a.source };
}
