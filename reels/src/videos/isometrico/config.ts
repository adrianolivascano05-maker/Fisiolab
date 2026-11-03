/**
 * VÍDEO · «Isométrico de cuádriceps: el ángulo que lo frena» (Rice 2010 · reel 7).
 * Hilo: caso (rodilla recién operada, isométrico con la pierna estirada) → quién lo dice (revisión narrativa, freno reflejo) →
 * la curva en U de la presión y el freno → quiz del ángulo → más del doble de freno en extensión tras meniscectomía →
 * la recomendación 30-50° → los estudios son antiguos → qué hacer mañana → CTA.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Isometrico",
  titulo: "Isométrico de cuádriceps: el ángulo que lo frena",
  pilar: "Aplicación clínica en 1 minuto",
  fuente: "Fuente: Rice y McNair, Semin Arthritis Rheum 2010 (revisión narrativa)",
  portada: { linea1: "Isométrico de cuádriceps:", dato: "30-50°", sub: "NO CON LA PIERNA ESTIRADA" },
  coldOpen: { big: "×2", small: "más freno con la pierna estirada" },
};

export type SceneId = "gancho" | "prueba" | "datos" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/isometrico/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Rodilla recién operada.", keys: ["Rodilla", "operada"] },
      { text: "Isométrico de cuádriceps, con la pierna estirada.", chunks: ["Isométrico de cuádriceps,", "con la pierna estirada."], keys: ["Isométrico", "estirada"] },
      { text: "¿Y si es el ángulo que más lo frena?", keys: ["ángulo", "frena"] },
    ],
  },
  {
    id: "prueba",
    sentences: [
      { text: "Lo explica una revisión narrativa de dos mil diez.", keys: ["narrativa", "2010"], display: { "dos mil diez": "2010" } },
      { text: "Tras una lesión, la rodilla frena el cuádriceps por reflejo.", chunks: ["Tras una lesión, la rodilla", "frena el cuádriceps por reflejo."], keys: ["frena", "reflejo"] },
    ],
  },
  {
    id: "datos",
    sentences: [
      { text: "Con derrame, la presión en la rodilla dibuja una U.", chunks: ["Con derrame, la presión", "en la rodilla dibuja una U."], keys: ["derrame", "presión", "U"] },
      { text: "Máxima en los extremos, mínima en el rango medio.", chunks: ["Máxima en los extremos,", "mínima en el rango medio."], keys: ["Máxima", "mínima"] },
      { text: "Y el freno sigue el mismo patrón.", keys: ["freno", "patrón"] },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "¿A qué ángulo lo harías?", keys: ["ángulo", "harías"] }],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "Tras una meniscectomía, incluso sin derrame detectable, el freno con la pierna estirada puede ser más del doble que a treinta o cuarenta grados.",
        chunks: ["Tras una meniscectomía,", "incluso sin derrame detectable,", "el freno con la pierna estirada", "puede ser más del doble", "que a treinta o cuarenta grados."],
        keys: ["meniscectomía", "detectable", "estirada", "doble", "30", "40"],
        display: { treinta: "30", cuarenta: "40" },
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Por eso recomiendan, en fase aguda, isométricos entre treinta y cincuenta grados.",
        chunks: ["Por eso recomiendan, en fase aguda,", "isométricos entre treinta y cincuenta grados."],
        keys: ["recomiendan", "aguda", "30", "50"],
        display: { treinta: "30", cincuenta: "50" },
      },
      { text: "Ahí la presión es mínima.", keys: ["presión", "mínima"] },
    ],
  },
  {
    id: "matiz",
    sentences: [{ text: "Ojo: muchos de esos estudios son de los ochenta y noventa.", chunks: ["Ojo: muchos de esos estudios", "son de los ochenta y noventa."], keys: ["estudios", "ochenta", "noventa"] }],
  },
  {
    id: "quehacer",
    sentences: [
      { text: "Mañana en consulta: isométrico con la rodilla doblada.", chunks: ["Mañana en consulta:", "isométrico con la rodilla doblada."], keys: ["isométrico", "doblada"] },
      { text: "Y vigila el derrame: con más líquido, el ángulo probablemente pesa aún más.", chunks: ["Y vigila el derrame:", "con más líquido, el ángulo", "probablemente pesa aún más."], keys: ["derrame", "líquido", "pesa"] },
    ],
  },
  {
    id: "cta",
    sentences: [
      {
        text: 'Comenta "treinta" si ya lo hacías con la rodilla doblada.',
        chunks: ['Comenta "treinta"', "si ya lo hacías", "con la rodilla doblada."],
        keys: ["Comenta", "30", "doblada"],
        display: { treinta: "30" },
      },
    ],
  },
];

/** Datos verificados en Rice y McNair 2010 (Semin Arthritis Rheum 40:250-266), «Changes in Afferent Discharge Due to Joint
 *  Damage» → «Swelling», pp. 253-254: con derrame, la presión intraarticular dibuja una U con picos en extensión completa y en
 *  flexión al final del rango y mínimo en rango medio (refs. 74, 78, 80, 81); más inhibición hacia los extremos (refs. 74, 77,
 *  84-87); «even in the absence of a clinically detectable effusion, patients may exhibit more than double the amount of AMI in
 *  full extension when compared with 30 to 40° of knee flexion in the first few days following menisectomy» (refs. 85-86, 1983);
 *  «in the acute stages after injury or surgery, isometric quadriceps exercises should be performed in 30 to 50° of knee flexion,
 *  where IAP is lowest» y «likely to maximize activation»; «the greater the level of effusion, the stronger the relationship
 *  between joint angle and inhibition is likely to be». Años de las refs. citadas: 1964-1996. */
export const DATA = {
  quiz: ["0° · ESTIRADA", "30-50°", "90°"],
  years: ["1983", "1988", "1993", "1996"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
