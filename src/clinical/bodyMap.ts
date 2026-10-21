// Mapa corporal de la anamnesis: las zonas del cuerpo, de frente y de espaldas, y cómo se guarda lo marcado. En la
// vista de frente, el lado derecho del paciente queda a la izquierda de quien mira (como al tenerlo delante); de
// espaldas, a la derecha. Lo marcado se guarda en la respuesta del campo como «zona:síntoma:intensidad» (la
// intensidad, de 0 a 10, puede faltar), una entrada por zona.

/** Hormigueo incluye el adormecimiento (parestesias). */
export type Symptom = "dolor" | "hormigueo" | "rigidez";
export const SYMPTOMS: { id: Symptom; label: string; short: string }[] = [
  { id: "dolor", label: "Dolor", short: "dolor" },
  { id: "hormigueo", label: "Hormigueo", short: "hormigueo" },
  { id: "rigidez", label: "Rigidez", short: "rigidez" },
];
const symptomIds = new Set<string>(SYMPTOMS.map((s) => s.id));

export type Shape = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number } | { kind: "rect"; x: number; y: number; w: number; h: number; r?: number };
/** `region`: la articulación de la galería de tests (src/clinical/anamnesis.ts, BODY_REGIONS) que le corresponde. */
export type Zone = { id: string; label: string; region?: string; side?: "d" | "i"; front?: Shape; back?: Shape };

const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: "ellipse", cx, cy, rx, ry });
const rect = (x: number, y: number, w: number, h: number, r = 6): Shape => ({ kind: "rect", x, y, w, h, r });

/** Una zona de los dos lados. Las formas se dan en la mitad izquierda del dibujo (x < 100) y se reflejan. `{l}` en
 * el nombre es «derecho/izquierdo» (o «derecha/izquierda» si `f`). */
function pair(id: string, name: string, region: string | undefined, f: boolean, front: Shape | null, back: Shape | null): Zone[] {
  const mirror = (s: Shape): Shape => (s.kind === "ellipse" ? { ...s, cx: 200 - s.cx } : { ...s, x: 200 - s.x - s.w });
  const label = (side: "d" | "i") => name.replace("{l}", side === "d" ? (f ? "derecha" : "derecho") : f ? "izquierda" : "izquierdo");
  // De frente, el derecho del paciente a la izquierda del dibujo; de espaldas, a la derecha.
  return [
    { id: `${id}_d`, label: label("d"), region, side: "d", front: front ?? undefined, back: back ? mirror(back) : undefined },
    { id: `${id}_i`, label: label("i"), region, side: "i", front: front ? mirror(front) : undefined, back: back ?? undefined },
  ];
}

const shoulder = ellipse(60, 83, 12, 10);
const arm = rect(48, 95, 14, 42);
const elbow = ellipse(54, 145, 7.5, 7);
const forearm = rect(42, 154, 14, 40);
const hand = ellipse(47, 208, 9, 12);
const knee = ellipse(86.5, 255, 10, 10);
const foot = rect(76, 331, 19, 22);

/** Alto del dibujo (el ancho es 200). */
export const MAP_HEIGHT = 358;

export const ZONES: Zone[] = [
  { id: "cabeza", label: "Cabeza", front: ellipse(100, 32, 20, 25), back: ellipse(100, 32, 20, 25) },
  { id: "cuello", label: "Cuello, por delante", region: "cervical", front: rect(90, 59, 20, 14, 4) },
  { id: "cervical", label: "Cervical", region: "cervical", back: rect(90, 59, 20, 14, 4) },
  ...pair("hombro", "Hombro {l}", "hombro", false, shoulder, shoulder),
  ...pair("pecho", "Pecho, lado {l}", undefined, false, rect(74, 76, 25, 36), null),
  ...pair("escapula", "Escápula {l}", "dorsal", true, null, rect(74, 76, 15, 38)),
  { id: "dorsal", label: "Dorsal (entre las escápulas)", region: "dorsal", back: rect(91, 76, 18, 38, 5) },
  { id: "abdomen", label: "Abdomen", front: rect(74, 114, 52, 42) },
  { id: "lumbar", label: "Lumbar", region: "lumbar", back: rect(74, 116, 52, 26) },
  { id: "sacro", label: "Sacro", region: "sacroiliaca", back: rect(88, 144, 24, 12, 5) },
  ...pair("brazo", "Brazo {l}", "hombro", false, arm, arm),
  ...pair("codo", "Codo {l}", "codo", false, elbow, elbow),
  ...pair("antebrazo", "Antebrazo {l}", "muneca_mano", false, forearm, forearm),
  ...pair("mano", "Muñeca y mano {l}", "muneca_mano", true, hand, hand),
  ...pair("ingle", "Cadera e ingle {l}", "cadera", true, rect(74, 158, 25, 22), null),
  ...pair("gluteo", "Glúteo {l}", "sacroiliaca", false, null, rect(74, 158, 25, 26, 8)),
  ...pair("muslo", "Muslo {l}, por delante", undefined, false, rect(75, 182, 23, 62, 8), null),
  ...pair("isquios", "Muslo {l}, por detrás", undefined, false, null, rect(75, 186, 23, 58, 8)),
  ...pair("rodilla", "Rodilla {l}", "rodilla", true, knee, knee),
  ...pair("pierna", "Pierna {l}, por delante", "tobillo_pie", true, rect(79, 267, 15, 62, 7), null),
  ...pair("gemelo", "Gemelo {l}", "tobillo_pie", false, null, rect(79, 267, 15, 62, 7)),
  ...pair("pie", "Tobillo y pie {l}", "tobillo_pie", false, foot, foot),
];
const zoneById = new Map(ZONES.map((z) => [z.id, z]));
export const zoneLabel = (id: string) => zoneById.get(id)?.label ?? id;

export type Mark = { zone: string; symptom: Symptom; intensity: number | null };

/** Lee lo guardado; lo que no se entiende se ignora. */
export function parseMarks(value: unknown): Mark[] {
  if (!Array.isArray(value)) return [];
  const out: Mark[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const [zone = "", symptom = "", n = ""] = raw.split(":");
    if (!zoneById.has(zone) || !symptomIds.has(symptom) || out.some((m) => m.zone === zone)) continue;
    const intensity = n === "" ? null : Number(n);
    out.push({ zone, symptom: symptom as Symptom, intensity: intensity !== null && Number.isInteger(intensity) && intensity >= 0 && intensity <= 10 ? intensity : null });
  }
  return out;
}

export const formatMarks = (marks: Mark[]): string[] => marks.map((m) => `${m.zone}:${m.symptom}:${m.intensity ?? ""}`);

/** En orden de la cabeza a los pies (el de la lista de zonas). */
export const sortMarks = (marks: Mark[]) => [...marks].sort((a, b) => ZONES.findIndex((z) => z.id === a.zone) - ZONES.findIndex((z) => z.id === b.zone));

/** Para leer: «Hombro derecho: dolor 6/10; Lumbar: rigidez». */
export function marksText(value: unknown): string {
  return sortMarks(parseMarks(value))
    .map((m) => `${zoneLabel(m.zone)}: ${SYMPTOMS.find((s) => s.id === m.symptom)!.short}${m.intensity !== null ? ` ${m.intensity}/10` : ""}`)
    .join("; ");
}

/** Las articulaciones de la galería de tests y el lado que salen de lo marcado (para proponer los tests). */
export function regionsOf(marks: Mark[]): { regions: string[]; side: "Derecho" | "Izquierdo" | "Los dos" | null; maxIntensity: number | null } {
  const regions: string[] = [];
  const sides = new Set<"d" | "i">();
  for (const m of marks) {
    const z = zoneById.get(m.zone);
    if (z?.region && !regions.includes(z.region)) regions.push(z.region);
    if (z?.side) sides.add(z.side);
  }
  // Con zonas de los dos lados no se propone lado: cada zona ya lleva el suyo en el mapa (salvo que sea la misma de los dos).
  const both = sides.size === 2 && new Set(marks.map((m) => zoneById.get(m.zone)?.region).filter(Boolean)).size === 1;
  const side = sides.size === 2 ? (both ? "Los dos" : null) : sides.has("d") ? "Derecho" : sides.has("i") ? "Izquierdo" : null;
  const top = Math.max(-1, ...marks.map((m) => m.intensity ?? -1));
  return { regions, side, maxIntensity: top >= 0 ? top : null };
}
