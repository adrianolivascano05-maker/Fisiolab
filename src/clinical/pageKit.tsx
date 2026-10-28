// Piezas comunes de las pantallas de la ficha clínica (anamnesis, exploración, mediciones, sesiones).
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → valor de un <input type="datetime-local"> en la hora del dispositivo. */
export const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// «Hoy» y sumar días: los de src/app/dates.ts (hora de Madrid), reexportados porque media ficha los importa de aquí.
export { addDays, todayDay } from "../app/dates";
export const dayText = (day: string) => fmtDate(`${day}T12:00:00`);

export const sexLabels = { female: "Mujer", male: "Hombre", other: "Otro" } as const;

/** Datos de una pestaña de la ficha: se recargan al cambiar de paciente. */
export function useLoad<T>(id: string, load: () => Promise<T>) {
  return useAsync(load, [id]);
}

export function Guard({ state, title, back }: { state: { error: Error | null; data: unknown }; title: string; back: string }) {
  if (state.error) return <Page title={title} backTo={back}><LoadError error={state.error} /></Page>;
  return <Page title={title} backTo={back}><Loading /></Page>;
}

export const primaryLink = "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover";
