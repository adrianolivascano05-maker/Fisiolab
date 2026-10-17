// Borrador de marcas sin calcular: si el navegador se cierra o recarga la página a mitad del marcado
// (Android lo hace al ir a la cámara o a la galería), las marcas no se pierden.
import type { MarkInput } from "../calc/results";

const key = (testId: string) => `impulso.marcas.${testId}`;

export const markDraft = {
  get(testId: string): MarkInput[] | null {
    try {
      const raw = localStorage.getItem(key(testId));
      const v: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(v) && v.every((m) => typeof m?.event === "string" && Number.isInteger(m?.frame) && Number.isInteger(m?.seriesIndex)) ? (v as MarkInput[]) : null;
    } catch {
      return null;
    }
  },
  set(testId: string, marks: MarkInput[]) {
    try {
      localStorage.setItem(key(testId), JSON.stringify(marks));
    } catch {
      // Sin almacenamiento (modo privado): se sigue sin borrador.
    }
  },
  clear(testId: string) {
    try {
      localStorage.removeItem(key(testId));
    } catch {
      // Igual que arriba.
    }
  },
};
