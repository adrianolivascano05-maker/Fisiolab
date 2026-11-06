// Biblioteca de OmniClin de cuestionarios propios (docs/cuestionarios-propios.md): ya hechos, redacción propia de
// OmniClin, sin derechos de terceros. Se añaden con un toque desde Ajustes › Cuestionarios propios: entonces pasan a
// ser de la clínica (una copia «own:<uuid>» con `from`), que los cambia a su gusto. Llevan la etiqueta fija
// «Cuestionario propio de la clínica · no validado» y ninguno interpreta nada. «[Clínica]» se cambia por el nombre de
// la clínica al enseñarlo.
import type { OwnFormSpec, OwnItem } from "../clinical/forms/own";

export type LibraryForm = { lib: string; v: number; spec: Omit<OwnFormSpec, "id" | "hash" | "from"> };

/** Los ids de las preguntas: estables dentro de cada cuestionario (q_00000001, q_00000002…). */
const q = (n: number) => `q_${String(n).padStart(8, "0")}`;
const scale = (n: number, text: string, ends: [string, string], extra: Partial<OwnItem> = {}): OwnItem => ({ id: q(n), type: "scale", text, from: 0, to: 10, ends, ...extra }) as OwnItem;
const yesno = (n: number, text: string, extra: Partial<OwnItem> = {}): OwnItem => ({ id: q(n), type: "yesno", text, yes: 1, no: 0, ...extra }) as OwnItem;

export const OWN_FORMS_LIBRARY: LibraryForm[] = [
  {
    lib: "lib_satisfaccion",
    v: 1,
    spec: {
      v: 1,
      name: "Satisfacción con el tratamiento",
      instructions: "Nos ayuda a mejorar. Responde pensando en el tratamiento que has recibido en [Clínica]. Lo leerán tu fisioterapeuta y el equipo de la clínica que te atiende.",
      note: "Encuesta de satisfacción. Se recomienda pasarla al alta o tras 4-6 sesiones.",
      sections: [
        {
          items: [
            scale(1, "¿Cómo valoras la atención que has recibido?", ["Muy mala", "Excelente"]),
            scale(2, "¿Te han explicado bien qué te pasa y qué vamos a hacer?", ["Nada", "Perfectamente"]),
            scale(3, "¿Has notado mejoría en lo que te preocupaba?", ["Ninguna", "Mucha"]),
            scale(4, "¿Te has sentido escuchado y con confianza para preguntar?", ["Nada", "Totalmente"]),
            scale(5, "¿Recomendarías esta clínica a un familiar o amigo?", ["Nunca", "Sin duda"]),
          ],
        },
      ],
      scoring: { method: "mean", better: "higher", na: "skip", minAnswered: 3 },
    },
  },
  {
    lib: "lib_adherencia",
    v: 1,
    spec: {
      v: 1,
      name: "Adherencia a los ejercicios",
      instructions: "Piensa en los ejercicios que te hemos mandado para casa durante la última semana. No hay respuestas buenas ni malas: nos sirve para ajustarlos a tu vida.",
      note: "Útil cada 1-2 semanas mientras haya ejercicios para casa. Las respuestas de «qué te lo puso difícil» sirven para ajustar el plan.",
      sections: [
        {
          items: [
            {
              id: q(1),
              type: "options",
              text: "¿Cuántos días de la última semana hiciste los ejercicios?",
              options: [
                { label: "Ninguno", points: 0 },
                { label: "1-2 días", points: 1 },
                { label: "3-4 días", points: 2 },
                { label: "5-6 días", points: 3 },
                { label: "Todos", points: 4 },
              ],
            },
            {
              id: q(2),
              type: "options",
              text: "Los días que los hiciste, ¿cuánto del plan completaste?",
              options: [
                { label: "Casi nada", points: 0 },
                { label: "Menos de la mitad", points: 1 },
                { label: "Más de la mitad", points: 2 },
                { label: "Todo", points: 3 },
              ],
            },
            {
              id: q(3),
              type: "options",
              text: "¿Qué te lo puso difícil?",
              multiple: true,
              uncounted: true,
              options: [
                { label: "Falta de tiempo" },
                { label: "Dolor al hacerlos" },
                { label: "No me acordaba" },
                { label: "No sabía si los hacía bien" },
                { label: "No veo que sirvan" },
                { label: "Nada, los hice sin problema" },
              ],
            },
            scale(4, "¿Cómo de seguro te sientes haciéndolos solo en casa?", ["Nada seguro", "Totalmente seguro"], { uncounted: true, track: { better: "higher" } }),
            {
              id: q(5),
              type: "options",
              text: "¿Te parecen demasiados, pocos o adecuados?",
              uncounted: true,
              options: [{ label: "Demasiados" }, { label: "Adecuados" }, { label: "Pocos" }],
            },
          ],
        },
      ],
      scoring: { method: "sum", better: "higher", na: "block" },
    },
  },
  {
    lib: "lib_control_semanal",
    v: 1,
    spec: {
      v: 1,
      name: "Control semanal",
      instructions: "Un minuto cada semana para ver cómo vas. Responde pensando en los últimos 7 días.",
      note: "Pensado para enviarlo cada semana por enlace desde la bandeja de envíos. Sin nota global a propósito: cada escala se sigue por separado.",
      sections: [
        {
          items: [
            scale(1, "Dolor medio esta semana", ["Sin dolor", "El peor imaginable"], { track: { better: "lower" } }),
            scale(2, "Peor momento de dolor esta semana", ["Sin dolor", "El peor imaginable"], { track: { better: "lower" } }),
            scale(3, "¿Cómo has dormido?", ["Muy mal", "Muy bien"], { track: { better: "higher" } }),
            scale(4, "¿Cuánto has podido hacer de tu actividad normal (trabajo, casa, deporte)?", ["Nada", "Todo"], { track: { better: "higher" } }),
            scale(5, "¿Cómo ha estado tu ánimo?", ["Muy bajo", "Muy bien"], { sensitive: true, track: { better: "higher" } }),
            yesno(6, "¿Has tenido algún episodio nuevo o distinto esta semana?", { detail: "Cuéntanos qué", track: {} }),
          ],
        },
      ],
      scoring: null,
    },
  },
  {
    lib: "lib_vuelta_deporte",
    v: 1,
    spec: {
      v: 1,
      name: "Vuelta al deporte: lista de comprobación",
      instructions:
        "Responde con sinceridad pensando en cómo estás HOY. Esta lista ayuda a tu fisioterapeuta a planificar contigo la vuelta; la decisión es suya y tuya, no de una puntuación.",
      note: "Lista de comprobación, no un criterio de alta. Combínala con las mediciones de la app (saltos, cambio de dirección, nórdico, fuerza) y con I-PRRS, Tegner o la escala específica de la zona.",
      sections: [
        {
          items: [
            yesno(1, "¿Puedes hacer tu actividad diaria normal sin dolor ni hinchazón?", { na: true }),
            yesno(2, "¿Puedes correr en línea recta 10 minutos sin molestias?", { na: true }),
            yesno(3, "¿Puedes saltar y caer sobre la pierna afectada sin dolor ni miedo?", { na: true }),
            yesno(4, "¿Puedes cambiar de dirección y frenar en seco con normalidad?", { na: true }),
            yesno(5, "¿Notas la zona lesionada tan fuerte como la otra?", { na: true }),
            yesno(6, "¿Has completado entrenamientos adaptados con tu equipo o grupo sin problemas después?", { na: true }),
            yesno(7, "¿Te sientes mentalmente preparado para volver a competir o a tu práctica habitual?", { na: true }),
            yesno(8, "¿Duermes y te recuperas bien entre entrenamientos?", { na: true }),
          ],
        },
      ],
      scoring: { method: "sum", better: "higher", na: "skip", minAnswered: 6 },
    },
  },
];

export const libraryForm = (lib: string) => OWN_FORMS_LIBRARY.find((f) => f.lib === lib);
