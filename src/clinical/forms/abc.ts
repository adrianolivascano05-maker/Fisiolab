// ABC (Activities-specific Balance Confidence): confianza en no perder el equilibrio en 16 actividades, de 0 a 100 %
// de 10 en 10; nota 0-100 % (media de los ítems contestados), más es mejor.
import { answered, round1, type Answers, type Option, type QuestionForm } from "./types";

/** 0 %, 10 %… 100 %: el número es el valor; los extremos dicen qué significan. */
const OPTIONS: Option[] = Array.from({ length: 11 }, (_, i) => {
  const value = i * 10;
  const label = value === 0 ? "0 % (ninguna confianza)" : value === 100 ? "100 % (confianza total)" : `${value} % de confianza`;
  return { value, label };
});

const TEXTS = [
  "…camina por casa?",
  "…sube o baja escaleras?",
  "…se agacha y recoge una zapatilla del suelo del armario?",
  "…coge una lata pequeña de una estantería a la altura de los ojos?",
  "…se pone de puntillas y coge algo por encima de la cabeza?",
  "…se sube a una silla para coger algo?",
  "…barre el suelo?",
  "…sale de casa y va hasta un coche aparcado en la entrada?",
  "…entra o sale de un coche?",
  "…cruza un aparcamiento para ir a un centro comercial?",
  "…sube o baja una rampa?",
  "…camina por un centro comercial lleno de gente que pasa deprisa a su lado?",
  "…le empujan sin querer mientras camina por el centro comercial?",
  "…sube o baja de una escalera mecánica agarrado/a al pasamanos?",
  "…sube o baja de una escalera mecánica con paquetes en las manos, sin poder agarrarse al pasamanos?",
  "…camina por la calle sobre aceras heladas?",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "abc",
  instructions:
    "Para cada una de las siguientes actividades, indique qué confianza tiene en poder hacerla sin perder el equilibrio ni sentirse inestable. Elija un porcentaje de la escala, de 0 % (ninguna confianza) a 100 % (confianza total). Si ahora no hace esa actividad, imagine qué confianza tendría si tuviera que hacerla. Si normalmente usa un bastón u otra ayuda, o se agarra a alguien, puntúe su confianza como si usara esa ayuda.",
  sections: [
    {
      title: "¿Qué confianza tiene en que no perderá el equilibrio ni se sentirá inestable cuando…?",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    // Media de los ítems contestados: los que se dejan en blanco no cuentan.
    if (!values.length) throw new RangeError("Faltan las 16 respuestas: la ABC necesita al menos una para calcular la media.");
    return { score: round1(values.reduce((s, v) => s + v, 0) / values.length) };
  },
  source:
    "Powell y Myers, 1995 (original), DOI 10.1093/gerona/50a.1.m28; Montilla-Ibáñez et al., 2017 (validación española, pacientes vestibulares), DOI 10.3109/09638288.2016.1161087; Lajoie y Gallagher, 2004 (puntos de corte), DOI 10.1016/s0167-4943(03)00082-7. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
