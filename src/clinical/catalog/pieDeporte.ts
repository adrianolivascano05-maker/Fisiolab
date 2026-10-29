// Cuestionarios de este grupo (docs/cuestionarios.md): su ficha en el catálogo.
import type { QuestionnaireKind } from "../questionnaires";

export const KINDS: QuestionnaireKind[] = [
  {
    id: "cait",
    name: "CAIT (inestabilidad crónica de tobillo)",
    min: 0,
    max: 30,
    better: "higher",
    subscales: ["Tobillo izquierdo", "Tobillo derecho"],
    regions: ["tobillo_pie"],
    hint: "Presencia y gravedad de la inestabilidad crónica de tobillo, para el cribado tras esguinces de repetición y el seguimiento; se contesta para cada tobillo por separado.",
    reading:
      "25 o menos indica inestabilidad crónica de tobillo (punto de corte recalibrado y recomendado, Wright et al. 2014); el punto de corte original era 27,5 (27 o menos, Hiller et al. 2006).",
    refs: "Hiller et al., 2006 (original), DOI 10.1016/j.apmr.2006.05.022; Cruz-Díaz et al., 2013 (validación española), DOI 10.1007/s10067-012-2095-0; Rodríguez-Fernández et al., 2015 (validación española), DOI 10.3109/09638288.2014.984879; Wright et al., 2014 (punto de corte), DOI 10.1016/j.apmr.2014.04.017",
  },
  {
    id: "faam_deporte",
    name: "FAAM Deporte (tobillo y pie)",
    min: 0,
    max: 100,
    better: "higher",
    unit: "%",
    regions: ["tobillo_pie"],
    hint: "Función en actividades deportivas o de alta demanda en lesiones de pierna, tobillo y pie; complementa la FAAM AVD y se suele pasar a continuación de ella.",
    reading: "Cambio mínimo importante: 9 puntos; cambio mínimo detectable: ±12,3 puntos (Martin et al. 2005).",
    refs: "Martin et al., 2005 (original), DOI 10.1177/107110070502601113; Cervera-Garvi et al., 2017 (validación española, FAAM-Sp), DOI 10.1186/s13047-017-0221-6",
  },
  {
    id: "alr_rsi",
    name: "ALR-RSI (preparación psicológica, tobillo)",
    min: 0,
    max: 100,
    better: "higher",
    regions: ["tobillo_pie"],
    hint: "Preparación psicológica (emociones, confianza en el rendimiento, valoración del riesgo) para volver al deporte tras una cirugía ligamentosa del tobillo o, por extensión, una inestabilidad lateral.",
    reading:
      "Sin punto de corte ni cambio mínimo importante verificados; como referencia, media de 61,9 en quienes volvieron al deporte frente a 43,4 en quienes no lo hicieron (Pioger et al. 2022).",
    refs: "Sigonney et al., 2020 (original), DOI 10.1007/s00167-020-06020-6; Pioger et al., 2022 (validación tras Broström-Gould), DOI 10.1007/s00167-022-06895-7; Pérez-de la Cruz, 2023 (validación española), DOI 10.3390/jpm13040606",
    scoreOnly: true,
    link: {
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7669765/",
      label: "Artículo original, en abierto, con la escala",
    },
  },
  {
    id: "iprrs",
    name: "I-PRRS (preparación psicológica para volver al deporte)",
    min: 0,
    max: 60,
    better: "higher",
    topic: "Vuelta al deporte",
    hint: "Confianza del deportista lesionado para volver a entrenar y competir, sea cual sea la lesión; se pasa antes de volver a entrenar y antes de volver a competir.",
    refs: "Glazer, 2009 (original), DOI 10.4085/1062-6050-44.2.185; sin validación española en PubMed",
  },
  {
    id: "ostrc_h2",
    name: "OSTRC-H2 (problemas de salud en deportistas)",
    min: 0,
    max: 100,
    better: "lower",
    topic: "Vuelta al deporte",
    hint: "Registro semanal de lesiones y enfermedades en deportistas (participación, cantidad de entrenamiento, rendimiento y síntomas), para seguir a un equipo o a un deportista a lo largo de la temporada.",
    reading:
      "Sin cambio mínimo importante: se informa la prevalencia semanal de problemas totales e importantes (importante: en la pregunta 2 o la 3, «en moderada medida», «en gran medida» o «no he podido participar»).",
    refs: "Clarsen et al., 2013 (original, OSTRC-O), DOI 10.1136/bjsports-2012-091524; Clarsen et al., 2020 (versión 2, H2 y O2), DOI 10.1136/bjsports-2019-101337; Bailón-Cerezo et al., 2020 (validación española, deportistas de 12 a 17 años), DOI 10.1177/2325967120968552; Martínez-Cal et al., 2023 (validación española del OSTRC-O de primera versión, balonmano), DOI 10.3390/healthcare11060912",
    scoreOnly: true,
    link: {
      url: "https://doi.org/10.1177/2325967120968552",
      label: "Artículo de la validación, en abierto, con el cuestionario",
    },
  },
];
