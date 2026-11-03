/**
 * VÍDEO · «Tu tendón cambia 2 días después del partido (y vuelve al 4)» (Cook 2016 · reel 7).
 * Hilo: caso (ecografía distinta el martes) → quién lo dice → la evolución en días (0, 2, 4) → quiz →
 * el mecanismo probable (proteoglicanos que atrapan agua, 2-3 días) → el colágeno no es → lo que no se sabe →
 * qué hacer mañana → CTA.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Tendon",
  titulo: "Tu tendón cambia 2 días después del partido (y vuelve al 4)",
  pilar: "El dato que nadie te contó",
  fuente: "Fuente: Cook et al., Br J Sports Med 2016 (Rosengarten 2015 · Docking 2012)",
  portada: { linea1: "Día 2 cambia,", dato: "día 4 vuelve", sub: "TU TENDÓN TRAS UN PARTIDO" },
  coldOpen: { big: "DÍA 2", small: "tu tendón no es el mismo que el día 0" },
};

export type SceneId = "gancho" | "prueba" | "datos" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/tendon/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Partido el domingo.", keys: ["Partido", "domingo"] },
      { text: "El martes, su Aquiles sale distinto en la ecografía.", chunks: ["El martes, su Aquiles", "sale distinto en la ecografía."], keys: ["martes", "distinto"] },
      { text: "¿Se está lesionando?", keys: ["lesionando"] },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Lo recoge una revisión de dos mil dieciséis de los creadores del modelo continuo.",
        chunks: ["Lo recoge una revisión de dos mil dieciséis", "de los creadores del modelo continuo."],
        keys: ["2016", "continuo"],
        display: { "dos mil dieciséis": "2016" },
      },
      { text: "Con jugadores de fútbol australiano, y con caballos de carreras.", chunks: ["Con jugadores de fútbol australiano,", "y con caballos de carreras."], keys: ["fútbol", "caballos"] },
    ],
  },
  {
    id: "datos",
    sentences: [
      { text: "Día cero: carga alta.", keys: ["0", "carga"], display: { cero: "0" } },
      { text: "Día dos: un cambio claro, pero sutil, en la imagen.", chunks: ["Día dos: un cambio claro,", "pero sutil, en la imagen."], keys: ["2", "sutil"], display: { dos: "2" } },
      { text: "Día cuatro: vuelve a la normalidad.", keys: ["4", "normalidad"], display: { cuatro: "4" } },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "¿Qué ha cambiado en esos dos días?", keys: ["Qué", "2"], display: { dos: "2" } }],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "Probablemente, el relleno: los proteoglicanos, moléculas que atrapan agua.",
        chunks: ["Probablemente, el relleno:", "los proteoglicanos,", "moléculas que atrapan agua."],
        keys: ["relleno", "proteoglicanos", "agua"],
      },
      {
        text: "Y tardan dos o tres días en fabricarse y romperse: el mismo ritmo.",
        chunks: ["Y tardan dos o tres días", "en fabricarse y romperse:", "el mismo ritmo."],
        keys: ["2", "3", "ritmo"],
        display: { dos: "2", tres: "3" },
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      { text: "El colágeno, en cambio, apenas se renueva en el adulto.", chunks: ["El colágeno, en cambio,", "apenas se renueva en el adulto."], keys: ["colágeno", "apenas"] },
      { text: "Lo rápido no parecen ser las fibras.", keys: ["rápido", "fibras"] },
    ],
  },
  {
    id: "matiz",
    sentences: [
      { text: "Ojo: no se sabe si es adaptación o el comienzo de un problema.", chunks: ["Ojo: no se sabe", "si es adaptación", "o el comienzo de un problema."], keys: ["adaptación", "problema"] },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: "Mañana: antes de mirar una ecografía, pregunta cuándo fue la última carga alta.",
        chunks: ["Mañana: antes de mirar una ecografía,", "pregunta cuándo fue", "la última carga alta."],
        keys: ["pregunta", "cuándo", "carga"],
      },
      {
        text: "El día dos y el día cuatro no muestran el mismo tendón.",
        chunks: ["El día dos y el día cuatro", "no muestran el mismo tendón."],
        keys: ["2", "4", "mismo"],
        display: { dos: "2", cuatro: "4" },
      },
    ],
  },
  {
    id: "cta",
    sentences: [
      {
        text: 'Comenta "día dos" si haces ecografías después de los partidos.',
        chunks: ['Comenta "día dos"', "si haces ecografías", "después de los partidos."],
        keys: ["Comenta", "día", "2"],
        display: { dos: "2" },
      },
    ],
  },
];

/** Datos verificados en Cook 2016 (BJSM 50:1187-91), apartado «Is a response to load part of an adaptive or pathological
 *  process?»: respuesta en imagen a los 2 días tras cargas altas que vuelve a la normalidad hacia el día 4 (refs. 62 y 63:
 *  Aquiles de futbolistas australianos y flexor digital superficial del caballo); proteoglicanos grandes (agrecano) en 2-3 días;
 *  recambio de colágeno mínimo tras la madurez esquelética; no se sabe si es adaptativo o patológico. */
export const DATA = {
  dias: [0, 2, 4],
  pg: "2-3 días",
  quiz: ["SE HA ROTO", "INFLAMACIÓN", "OTRA COSA"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
