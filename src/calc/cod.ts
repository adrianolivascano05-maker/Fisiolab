// Cambio de dirección (S16): tiempos de 5-0-5, 5+5, V-Cut e Illinois, déficit de cambio de
// dirección y asimetría entre giros. Funciones puras; las prueba cod.test.ts.

export type CodType = "cod_505" | "cod_5plus5" | "cod_vcut" | "cod_illinois";

export const codTests: { type: CodType; label: string; detail: string; sided: boolean; range: [number, number] }[] = [
  { type: "cod_505", label: "5-0-5", detail: "10 m lanzados, giro de 180° en la línea de 15 m y 5 m de vuelta. Se cronometra desde la línea de 10 m: 5 m de ida y 5 de vuelta.", sided: true, range: [1.8, 4] },
  { type: "cod_5plus5", label: "5+5", detail: "5 m, giro de 180° y 5 m de vuelta, desde parado.", sided: true, range: [1.8, 4.5] },
  { type: "cod_vcut", label: "V-Cut", detail: "25 m en zigzag con 4 cambios de dirección de 45° cada 5 m.", sided: false, range: [5, 12] },
  { type: "cod_illinois", label: "Illinois", detail: "Circuito de 10 × 5 m con slalom entre 4 conos; desde tumbado boca abajo.", sided: false, range: [12, 25] },
];

export function getCodTest(type: string) {
  return codTests.find((t) => t.type === type);
}

export function isCodType(type: string): type is CodType {
  return type.startsWith("cod_");
}

/**
 * Déficit de cambio de dirección (Nimphius et al., 2013): tiempo del 5-0-5 menos el tiempo en
 * 10 m de un sprint lineal. Aísla lo que cuesta girar de lo rápido que se corre.
 */
export function codDeficit(time505S: number, sprint10mS: number): number {
  return time505S - sprint10mS;
}

/** Asimetría entre giros: (más lento − más rápido) / más rápido · 100 y con qué pierna se gira peor. */
export function turnAsymmetry(leftS: number, rightS: number): { pct: number; slower: "left" | "right" | "equal" } {
  if (!(leftS > 0) || !(rightS > 0)) throw new RangeError("Hacen falta los dos giros");
  const fast = Math.min(leftS, rightS);
  return { pct: ((Math.max(leftS, rightS) - fast) / fast) * 100, slower: leftS === rightS ? "equal" : leftS > rightS ? "left" : "right" };
}
