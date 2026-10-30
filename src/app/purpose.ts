// Lo que OmniClin es y lo que no es, en un solo sitio (revisión de producto sanitario, 30-10-2026): la ayuda, el pie
// de los documentos, la exportación, Ajustes › Protección de datos y la línea de cada medición lo leen de aquí. El
// manifiesto (vite.config.ts), index.html, la política de privacidad y el contrato de encargado llevan el mismo texto
// copiado. Son textos de trabajo: no están validados por un abogado ni por una autoridad sanitaria.

/** La app, en dos frases (ayuda, Ajustes › Protección de datos). */
export const PURPOSE_SHORT =
  "OmniClin es un programa de registro y organización de la actividad de fisioterapia y de medición del rendimiento físico. No es un producto sanitario: no diagnostica, no hace triaje, no predice, no vigila al paciente ni propone tratamientos. Cada valoración y cada decisión clínica es del profesional.";

/** El pie de los documentos que salen de la clínica (informes, alta, derivación, justificantes, recibos, ejercicios). */
export const DOC_FOOTER = "Documento redactado por el profesional que lo firma. OmniClin es un programa de registro: no diagnostica ni propone tratamientos.";

/** La línea que acompaña a cada medición (salto, fuerza, velocidad, carrera, ángulos). */
export const MEASURE_NOTE = "Medida de rendimiento físico calculada por la app. Su precisión aún no se ha comprobado frente a un sistema de referencia.";

/** La finalidad prevista, entera (Ayuda › Acerca de). */
export const PURPOSE_LONG: { title: string; paragraphs: string[] } = {
  title: "Finalidad prevista de OmniClin",
  paragraphs: [
    "OmniClin es un programa para que los fisioterapeutas y las clínicas de fisioterapia registren y organicen su actividad: ficha e historia clínica, anamnesis, sesiones, consentimientos y documentos, agenda, mensajes y cobros. También permite registrar mediciones del rendimiento físico y de la movilidad (saltos, fuerza, velocidad, carrera y ángulos) con el vídeo o los sensores del móvil, y consultar una biblioteca con información publicada sobre tests de exploración y cuestionarios.",
    "Lo que OmniClin no hace. No diagnostica, no hace triaje ni clasifica la urgencia, no predice ni pronostica, no vigila al paciente, no interpreta los resultados de un paciente y no propone ni desaconseja tratamientos. Las listas que enseña (síntomas, precauciones), los cálculos y las referencias publicadas son información para que el profesional la consulte: la app no saca conclusiones sobre ningún paciente.",
    "Quién la usa. Fisioterapeutas colegiados y su personal, en su práctica profesional. Los pacientes solo rellenan los formularios y firman los documentos que les manda su clínica; no reciben resultados ni consejos de la app.",
    "Mediciones. Son estimaciones del rendimiento físico. Su precisión aún no se ha comprobado frente a un sistema de referencia, así que no deben ser la única base de una decisión.",
    "OmniClin no está destinado a ninguno de los fines médicos del artículo 2.1 del Reglamento (UE) 2017/745 y no es un producto sanitario. Cada valoración, cada diagnóstico fisioterapéutico y cada decisión clínica son del profesional que atiende al paciente.",
  ],
};
