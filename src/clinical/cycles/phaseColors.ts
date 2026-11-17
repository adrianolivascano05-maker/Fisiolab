// El color de cada fase de un plan por ciclos, por su posición (1, 2, 3…): el mismo en el plan, en la sesión, en el
// calendario del paciente y en la página que recibe él. El color dice qué fase es, nunca si algo va bien o mal: siempre
// va con su número y su nombre, y ninguna fase es roja (para que no se lea como un aviso). Los tonos, en
// src/styles/tokens.json («phase-1»… con contraste comprobado en claro y en oscuro).
// Las clases van escritas enteras para que Tailwind las encuentre.
const SOFT = [
  "bg-phase-1-soft text-phase-1 border-phase-1",
  "bg-phase-2-soft text-phase-2 border-phase-2",
  "bg-phase-3-soft text-phase-3 border-phase-3",
  "bg-phase-4-soft text-phase-4 border-phase-4",
  "bg-phase-5-soft text-phase-5 border-phase-5",
  "bg-phase-6-soft text-phase-6 border-phase-6",
  "bg-phase-7-soft text-phase-7 border-phase-7",
  "bg-phase-8-soft text-phase-8 border-phase-8",
] as const;
const SOLID = ["bg-phase-1", "bg-phase-2", "bg-phase-3", "bg-phase-4", "bg-phase-5", "bg-phase-6", "bg-phase-7", "bg-phase-8"] as const;
const LIGHT = ["bg-phase-1-soft", "bg-phase-2-soft", "bg-phase-3-soft", "bg-phase-4-soft", "bg-phase-5-soft", "bg-phase-6-soft", "bg-phase-7-soft", "bg-phase-8-soft"] as const;

const at = <T>(list: readonly T[], i: number) => list[((i % list.length) + list.length) % list.length]!;

/** Etiqueta de la fase: fondo suave, texto y borde de su color. */
export const phaseChip = (i: number) => at(SOFT, i);
/** Relleno fuerte (la barra de fases, la franja del calendario). */
export const phaseSolid = (i: number) => at(SOLID, i);
const BORDER = ["border-phase-1", "border-phase-2", "border-phase-3", "border-phase-4", "border-phase-5", "border-phase-6", "border-phase-7", "border-phase-8"] as const;
/** Solo el borde. */
export const phaseBorder = (i: number) => at(BORDER, i);
/** Solo el fondo suave. */
export const phaseSoft = (i: number) => at(LIGHT, i);
