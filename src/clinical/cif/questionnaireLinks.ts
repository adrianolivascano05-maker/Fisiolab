// Qué categorías de la CIF informa cada cuestionario (o cada subescala, «id:Subescala»): con su nota se propone el
// calificador de esas categorías (src/clinical/cif/suggest.ts) y salen juntos en la carta de derivación. Es una
// relación orientativa hecha para la app, por el contenido de cada cuestionario; no es un «linking» publicado.
// Solo los que miden la gravedad de un problema: los de cribado (DN4, S-LANSS, painDETECT, STarT Back, 5PQ…), los de
// nivel de actividad (Tegner, Marx, IPAQ) y los de preparación para volver al deporte no proponen calificador.
export const QUESTIONNAIRE_CIF: Record<string, string[]> = {
  // Dolor
  mapa_dolor: ["b280"],
  csi: ["b280"],
  peg: ["b280", "d920"],
  "bpi_sf:Intensidad": ["b280"],
  "bpi_sf:Interferencia": ["d230"],
  // Rodilla y cadera
  "koos:Dolor": ["b28015"],
  "koos:Síntomas": ["b710", "b780"],
  "koos:AVD": ["d410", "d450", "d455"],
  "koos:Deporte y ocio": ["d9201"],
  "hoos:Dolor": ["b28015"],
  "hoos:Síntomas": ["b710", "b780"],
  "hoos:AVD": ["d410", "d450", "d455"],
  "hoos:Deporte y ocio": ["d9201"],
  "koos12:Dolor": ["b28015"],
  "koos12:Función": ["d410", "d450", "d455"],
  "hoos12:Dolor": ["b28015"],
  "hoos12:Función": ["d410", "d450", "d455"],
  lefs: ["d410", "d450", "d455"],
  kujala: ["b28015", "d410", "d450", "d455"],
  lysholm: ["b715", "b28015", "d450", "d455"],
  ikdc: ["b715", "b28015", "d455"],
  ihot12: ["b28015", "d455", "d9201"],
  "hagos:Dolor": ["b28015"],
  "hagos:Síntomas": ["b710", "b780"],
  "hagos:Función en la vida diaria": ["d410", "d450"],
  "hagos:Función en deporte y ocio": ["d455", "d9201"],
  visa_g: ["b28015", "d450"],
  visa_p: ["b28015", "d9201"],
  oks: ["b28015", "d410", "d450"],
  ohs: ["b28015", "d410", "d450"],
  "womac:Dolor": ["b28016"],
  "womac:Rigidez": ["b710", "b780"],
  "womac:Función física": ["d410", "d450"],
  // Tobillo y pie
  faam: ["d450", "d455"],
  faam_deporte: ["d455", "d9201"],
  "faos:Dolor": ["b28015"],
  "faos:Síntomas": ["b710", "b780"],
  "faos:AVD": ["d450", "d455"],
  "faos:Deporte y ocio": ["d9201"],
  "cait:Tobillo izquierdo": ["b715"],
  "cait:Tobillo derecho": ["b715"],
  "ffi:Dolor": ["b28015"],
  "ffi:Discapacidad": ["d450", "d455"],
  visa_a: ["b28015", "d9201"],
  ostrc_h2: ["d9201"],
  // Columna, ATM y pelvis
  ndi: ["b28010", "d415", "d430"],
  odi: ["b28013", "d410", "d415", "d430", "d450"],
  rmdq: ["b28013", "d410", "d415", "d450", "d540"],
  bq_lumbar: ["b28013", "d230"],
  bq_cuello: ["b28010", "d230"],
  wdq: ["b28010", "d230"],
  pgq: ["d410", "d415", "d450"],
  "zcq:Función física": ["d450"],
  jfls8: ["b5102", "d550", "d330"],
  tmd_pain_screener: ["b28010"],
  hit6: ["b28010"],
  midas: ["d230", "d850"],
  // Miembro superior
  quickdash: ["d430", "d440", "d445"],
  "dash:Cuerpo principal": ["d430", "d440", "d445"],
  "dash:Módulo de trabajo": ["d850"],
  "dash:Módulo de deporte/artes escénicas": ["d9201"],
  uefi: ["d430", "d440", "d445"],
  spadi: ["b28014", "d445"],
  prwe: ["b28014", "d440", "d445"],
  prtee: ["b28014", "d430", "d445"],
  "bctq:Gravedad de síntomas (SSS)": ["b265", "b28014"],
  "bctq:Estado funcional (FSS)": ["d440"],
  ases: ["b28014", "d445"],
  sst: ["d430", "d445"],
  wosi: ["b715", "d445"],
  worc: ["b28014", "d445"],
  oss: ["b28014", "d445"],
  "oes:Función del codo": ["d445"],
  "oes:Dolor": ["b28014"],
  // Miedo, ánimo, estrés y sueño
  tsk11: ["b152"],
  pcs: ["b152"],
  fabq: ["b152"],
  phq9: ["b152"],
  gad7: ["b152"],
  phq4: ["b152"],
  "dass21:Depresión": ["b152"],
  "dass21:Ansiedad": ["b152"],
  "dass21:Estrés": ["d240"],
  pseq: ["d240"],
  pss10: ["d240"],
  isi: ["b134"],
  short_fes_i: ["b152"],
  "rand36:Función física": ["d410", "d430", "d450"],
  "rand36:Dolor corporal": ["b280"],
  "rand36:Vitalidad": ["b130"],
  "rand36:Salud mental": ["b152"],
  "rand36:Función social": ["d920"],
  // Equilibrio, suelo pélvico, respiratorio, neurológico
  abc: ["d450", "d455"],
  dhi: ["b240", "b235"],
  frail: ["b455", "b730"],
  iciq_ui_sf: ["b6202"],
  pfdi_20: ["b620", "b525"],
  pfiq_7: ["d230", "d920"],
  nijmegen: ["b440", "b460"],
  mmrc: ["b460", "b455"],
  cat: ["b440", "b455"],
  fss: ["b130", "b455"],
  msws_12: ["b770", "d450"],
};

/**
 * Los códigos que informa un registro de cuestionario. Si el cuestionario tiene vínculos por subescala, cada subescala
 * informa solo los suyos (la de dolor no propone el calificador de andar).
 */
export function cifLinks(kind: string, subscale?: string): string[] {
  const bySubscale = Object.keys(QUESTIONNAIRE_CIF).some((key) => key.startsWith(`${kind}:`));
  if (bySubscale) return subscale ? (QUESTIONNAIRE_CIF[`${kind}:${subscale}`] ?? []) : [];
  return QUESTIONNAIRE_CIF[kind] ?? [];
}

/** ¿Informa el cuestionario esta categoría? La misma o una más general («b280» informa «b28013»). */
export const informs = (links: string[], code: string) => links.some((l) => code === l || code.startsWith(l));
