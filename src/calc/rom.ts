// Movilidad (S19): catálogo de movimientos y la geometría del inclinómetro y del ángulo sobre foto.
// Funciones puras, sin dependencias: las prueba rom.test.ts.

export type RomJoint = "ankle" | "hip" | "shoulder" | "neck";
export type RomType = `rom_${RomJoint}`;
export type RomMethod = "sensor" | "photo" | "manual";

/**
 * Cómo mide el móvil:
 * - "vertical": inclinación del borde largo del móvil respecto a la vertical (lunge: la tibia).
 * - "relative": giro desde la posición de cero que se fija al empezar.
 */
export type SensorMode = "vertical" | "relative";

/**
 * Ángulo sobre foto:
 * - "vertical": dos puntos; inclinación del segmento respecto a la vertical de la foto.
 * - "three": tres puntos (brazo fijo, eje, brazo móvil). `convert` pasa el ángulo entre brazos al
 *   valor clínico: "direct" (0° con los brazos juntos), "supplement" (180° − ángulo: 0° con el
 *   segmento en línea) o "minus90" (ángulo − 90°: 0° con los brazos en escuadra).
 */
export type PhotoSpec =
  | { kind: "vertical"; points: [distal: string, proximal: string]; note: string }
  | { kind: "three"; points: [fixed: string, axis: string, moving: string]; convert: "direct" | "supplement" | "minus90"; note: string };

export type Movement = {
  id: string;
  joint: RomJoint;
  label: string;
  sided: boolean;
  sensor: SensorMode;
  /** Posición del paciente y cómo hacer el movimiento. */
  position: string;
  /** Dónde se apoya el móvil. */
  phone: string;
  /** Sin foto cuando no hay una forma fiable de medirlo en una sola imagen. */
  photo: PhotoSpec | null;
  /** Por encima de esto el valor es poco plausible y se avisa. */
  maxDeg: number;
};

export const jointLabels: Record<RomJoint, string> = {
  ankle: "Tobillo",
  hip: "Cadera",
  shoulder: "Hombro",
  neck: "Cuello",
};

export const methodLabels: Record<RomMethod, string> = {
  sensor: "Inclinómetro del móvil",
  photo: "Ángulo sobre foto",
  manual: "Goniómetro (a mano)",
};

export const movements: Movement[] = [
  {
    id: "ankle_lunge",
    joint: "ankle",
    label: "Flexión dorsal en carga (lunge)",
    sided: true,
    sensor: "vertical",
    position:
      "De pie frente a la pared, con el pie que se mide delante. Lleva la rodilla a tocar la pared sin levantar el talón. Aleja el pie poco a poco hasta la distancia máxima a la que la rodilla aún toca.",
    phone: "Apoya el borde largo del móvil a lo largo de la tibia, por delante y justo bajo la rodilla.",
    photo: { kind: "vertical", points: ["Tobillo (maléolo)", "Bajo la rodilla (tuberosidad de la tibia)"], note: "Foto de lado, con el móvil recto." },
    maxDeg: 70,
  },
  {
    id: "hip_flexion",
    joint: "hip",
    label: "Flexión",
    sided: true,
    sensor: "relative",
    position: "Boca arriba. Pon a cero con la pierna estirada sobre la camilla y lleva la rodilla, doblada, hacia el pecho sin despegar la pelvis.",
    phone: "Sobre la cara delantera del muslo, cerca de la rodilla.",
    photo: { kind: "three", points: ["Hombro", "Cadera (trocánter mayor)", "Rodilla (cara externa)"], convert: "supplement", note: "Foto de lado." },
    maxDeg: 150,
  },
  {
    id: "hip_extension",
    joint: "hip",
    label: "Extensión",
    sided: true,
    sensor: "relative",
    position: "Boca abajo. Pon a cero con la pierna apoyada y eleva la pierna estirada sin girar la pelvis.",
    phone: "Sobre la cara de atrás del muslo, cerca de la rodilla.",
    photo: { kind: "three", points: ["Hombro", "Cadera (trocánter mayor)", "Rodilla (cara externa)"], convert: "supplement", note: "Foto de lado." },
    maxDeg: 50,
  },
  {
    id: "hip_abduction",
    joint: "hip",
    label: "Abducción",
    sided: true,
    sensor: "relative",
    position: "Tumbado de lado sobre la pierna que no se mide. Pon a cero con la pierna de arriba estirada y súbela hacia el techo sin girarla.",
    phone: "Sobre la cara externa del muslo, cerca de la rodilla.",
    photo: { kind: "three", points: ["Cadera del otro lado (espina ilíaca)", "Cadera medida (espina ilíaca)", "Centro de la rótula"], convert: "minus90", note: "Boca arriba, foto desde arriba." },
    maxDeg: 60,
  },
  {
    id: "hip_internal_rotation",
    joint: "hip",
    label: "Rotación interna",
    sided: true,
    sensor: "relative",
    position: "Sentado al borde de la camilla, cadera y rodilla a 90°. Pon a cero con la tibia vertical y lleva el pie hacia fuera (la cadera gira hacia dentro).",
    phone: "A lo largo de la tibia, por delante, cerca del tobillo.",
    photo: { kind: "vertical", points: ["Entre los dos maléolos", "Centro de la rótula"], note: "Foto de frente." },
    maxDeg: 60,
  },
  {
    id: "hip_external_rotation",
    joint: "hip",
    label: "Rotación externa",
    sided: true,
    sensor: "relative",
    position: "Sentado al borde de la camilla, cadera y rodilla a 90°. Pon a cero con la tibia vertical y lleva el pie hacia dentro (la cadera gira hacia fuera).",
    phone: "A lo largo de la tibia, por delante, cerca del tobillo.",
    photo: { kind: "vertical", points: ["Entre los dos maléolos", "Centro de la rótula"], note: "Foto de frente." },
    maxDeg: 70,
  },
  {
    id: "shoulder_flexion",
    joint: "shoulder",
    label: "Flexión",
    sided: true,
    sensor: "relative",
    position: "De pie o boca arriba. Pon a cero con el brazo junto al cuerpo y súbelo por delante, estirado, lo más arriba posible sin arquear la espalda.",
    phone: "Sobre la cara externa del brazo, por encima del codo.",
    photo: { kind: "three", points: ["Cadera (trocánter mayor)", "Hombro (acromion)", "Codo (epicóndilo)"], convert: "direct", note: "Foto de lado." },
    maxDeg: 190,
  },
  {
    id: "shoulder_abduction",
    joint: "shoulder",
    label: "Abducción",
    sided: true,
    sensor: "relative",
    position: "De pie. Pon a cero con el brazo junto al cuerpo y súbelo por el lado, estirado y con la palma hacia delante, lo más arriba posible.",
    phone: "Sobre la cara de atrás del brazo, por encima del codo.",
    photo: { kind: "three", points: ["Cintura (en la línea del tronco)", "Hombro (acromion)", "Codo"], convert: "direct", note: "Foto de espaldas." },
    maxDeg: 190,
  },
  {
    id: "shoulder_external_rotation",
    joint: "shoulder",
    label: "Rotación externa",
    sided: true,
    sensor: "relative",
    position: "Boca arriba, brazo separado a 90° y codo a 90°. Pon a cero con el antebrazo vertical y llévalo hacia atrás, hacia la camilla.",
    phone: "A lo largo del antebrazo, cerca de la muñeca.",
    photo: { kind: "vertical", points: ["Muñeca", "Codo"], note: "Foto desde los pies de la camilla." },
    maxDeg: 120,
  },
  {
    id: "shoulder_internal_rotation",
    joint: "shoulder",
    label: "Rotación interna",
    sided: true,
    sensor: "relative",
    position: "Boca arriba, brazo separado a 90° y codo a 90°. Pon a cero con el antebrazo vertical y llévalo hacia delante, hacia la camilla, sin que se levante el hombro.",
    phone: "A lo largo del antebrazo, cerca de la muñeca.",
    photo: { kind: "vertical", points: ["Muñeca", "Codo"], note: "Foto desde los pies de la camilla." },
    maxDeg: 90,
  },
  {
    id: "neck_flexion",
    joint: "neck",
    label: "Flexión",
    sided: false,
    sensor: "relative",
    position: "Sentado, espalda apoyada. Pon a cero mirando al frente y lleva la barbilla hacia el pecho sin mover el tronco.",
    phone: "De canto sobre un lado de la cabeza, por encima de la oreja.",
    photo: null,
    maxDeg: 80,
  },
  {
    id: "neck_extension",
    joint: "neck",
    label: "Extensión",
    sided: false,
    sensor: "relative",
    position: "Sentado, espalda apoyada. Pon a cero mirando al frente y mira hacia el techo sin mover el tronco.",
    phone: "De canto sobre un lado de la cabeza, por encima de la oreja.",
    photo: null,
    maxDeg: 90,
  },
  {
    id: "neck_lateral_flexion",
    joint: "neck",
    label: "Inclinación lateral",
    sided: true,
    sensor: "relative",
    position: "Sentado, espalda apoyada. Pon a cero mirando al frente y acerca la oreja al hombro sin girar la cabeza ni subir el hombro.",
    phone: "Sobre la frente, con la pantalla hacia delante.",
    photo: { kind: "vertical", points: ["Base del cuello (C7)", "Centro de la nuca"], note: "Foto de espaldas." },
    maxDeg: 60,
  },
  {
    id: "neck_rotation",
    joint: "neck",
    label: "Rotación",
    sided: true,
    sensor: "relative",
    position: "Boca arriba, sin almohada. Pon a cero mirando al techo y gira la cabeza hacia un lado sin levantarla.",
    phone: "Sobre la frente, con la pantalla hacia arriba.",
    photo: null,
    maxDeg: 100,
  },
];

export function getMovement(id: string): Movement | undefined {
  return movements.find((m) => m.id === id);
}

export const romTypeFor = (joint: RomJoint): RomType => `rom_${joint}`;

export function isRomType(type: string): type is RomType {
  return type.startsWith("rom_");
}

/** "Cadera · flexión"; con lado, "Cadera · flexión izquierda". */
export function movementLabel(m: Movement, side?: "left" | "right" | null): string {
  const s = side === "left" ? " izquierda" : side === "right" ? " derecha" : "";
  return `${jointLabels[m.joint]} · ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}${s}`;
}

// ---------- Geometría ----------

export type Vec3 = [number, number, number];
const RAD = 180 / Math.PI;
const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/**
 * Dirección "arriba" en los ejes del móvil a partir de `deviceorientation` (beta, gamma en grados).
 * Ejes del móvil: x hacia la derecha de la pantalla, y hacia el borde de arriba, z saliendo de la pantalla.
 */
export function upFromOrientation(betaDeg: number, gammaDeg: number): Vec3 {
  const b = betaDeg / RAD;
  const g = gammaDeg / RAD;
  return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
}

/** Ángulo entre dos vectores, en grados (0-180). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const na = norm(a);
  const nb = norm(b);
  if (!(na > 0) || !(nb > 0)) return Number.NaN;
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RAD;
}

/**
 * Inclinación del borde largo del móvil respecto a la vertical (0° de pie, 90° tumbado).
 * Da igual hacia dónde mire la pantalla y el signo con que el navegador dé la gravedad.
 */
export function longAxisFromVertical(up: Vec3): number {
  const n = norm(up);
  if (!(n > 0)) return Number.NaN;
  return Math.acos(Math.min(1, Math.abs(up[1]) / n)) * RAD;
}

/** Media exponencial de la dirección: quita el temblor de la mano. */
export function smooth(prev: Vec3 | null, next: Vec3, alpha = 0.25): Vec3 {
  if (!prev) return next;
  return [prev[0] + alpha * (next[0] - prev[0]), prev[1] + alpha * (next[1] - prev[1]), prev[2] + alpha * (next[2] - prev[2])];
}

export type Pt = { x: number; y: number };

/** Ángulo en el vértice `axis` entre los brazos hacia `a` y hacia `b`, en grados (0-180). */
export function threePointAngle(a: Pt, axis: Pt, b: Pt): number {
  return angleBetween([a.x - axis.x, a.y - axis.y, 0], [b.x - axis.x, b.y - axis.y, 0]);
}

/** Inclinación del segmento `p`-`q` respecto a la vertical de la imagen (0-90°). */
export function segmentFromVertical(p: Pt, q: Pt): number {
  const dx = Math.abs(q.x - p.x);
  const dy = Math.abs(q.y - p.y);
  if (dx === 0 && dy === 0) return Number.NaN;
  return Math.atan2(dx, dy) * RAD;
}

/** Ángulo de la foto convertido al valor clínico del movimiento. */
export function photoAngle(spec: PhotoSpec, pts: Pt[]): number {
  if (spec.kind === "vertical") return segmentFromVertical(pts[0]!, pts[1]!);
  const raw = threePointAngle(pts[0]!, pts[1]!, pts[2]!);
  if (spec.convert === "supplement") return 180 - raw;
  if (spec.convert === "minus90") return raw - 90;
  return raw;
}

// ---------- Lecturas ----------

export type RomSummary = { mean: number; min: number; max: number; spread: number };

/** Resultado de varias lecturas: la media; la dispersión avisa si una lectura se fue. */
export function summarize(readings: number[]): RomSummary {
  if (readings.length === 0) throw new RangeError("Hace falta al menos una lectura");
  const min = Math.min(...readings);
  const max = Math.max(...readings);
  return { mean: readings.reduce((s, r) => s + r, 0) / readings.length, min, max, spread: max - min };
}

/** Diferencia entre lecturas a partir de la cual se sugiere repetir. */
export const MAX_SPREAD_DEG = 5;
