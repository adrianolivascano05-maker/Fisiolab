// El único sitio donde se decide qué día es: todo lo que la app entiende por «hoy» y por «el día de un instante» sale de
// aquí, en la hora de Madrid, que es la de las clínicas y la que usan las consultas de la agenda. Antes había tres
// definiciones distintas (la hora del dispositivo, Madrid y UTC) que cerca de medianoche daban días diferentes.
// Los formatos para enseñar fechas («24/10/2026», «martes 4 de noviembre») están en format.ts; aquí solo AAAA-MM-DD.

/** La zona horaria de la app. */
export const TZ = "Europe/Madrid";

/** El día AAAA-MM-DD de un instante (ISO o Date) en la hora de Madrid. */
export const dayOf = (at: string | Date) => new Date(at).toLocaleDateString("sv-SE", { timeZone: TZ });

/** Hoy, AAAA-MM-DD, en la hora de Madrid. */
export const todayDay = () => dayOf(new Date());

/** El día AAAA-MM-DD `n` días después de `day` (negativo: antes). Sin horas por medio: los cambios de hora no lo mueven. */
export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** AAAA-MM del día o del instante dado (o de hoy), en la hora de Madrid. */
export const monthOf = (at: string | Date = new Date()) => (typeof at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : dayOf(at)).slice(0, 7);
