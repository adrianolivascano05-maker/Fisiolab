// El calendario de cada paciente (Ficha › Calendario, src/clinical/CalendarPage.tsx): sus citas y lo suyo fuera de la
// clínica (una operación, sus entrenamientos cada semana, un viaje), el aviso al darle cita ese día y lo que sale en el
// Resumen. En el móvil (360 px), sin desbordes y con zonas táctiles de 44 px.
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";
import type { Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });
const fits = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
/** Hoy en Madrid (AAAA-MM-DD) y sumar días: los días del calendario van en hora de Madrid. */
const madridDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const plus = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
/** El botón de un día en el mes: «jueves, 22 de octubre: 1 evento». */
const dayButton = (page: Page, day: string, what: string) => page.getByRole("button", { name: new RegExp(`\\b${Number(day.slice(8))} de [a-z]+(, hoy)?: ${what}$`) });

test.describe("Calendario del paciente", () => {
  test("CA1 una operación y entrenamientos cada semana: en el mes, en el día, con filtros, al dar cita y en el Resumen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const record = await createPatient(page, { name: "Carla Calendario" });
    const today = madridDay();
    // Las cinco pestañas caben a 360 px.
    await expect(page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link")).toHaveCount(5);
    await tab(page, "Calendario").click();
    await expect(page.getByRole("heading", { name: "Calendario", exact: true })).toBeVisible();
    await expect(page.getByText(/^Nada este mes\./)).toBeVisible();
    await expect(dayButton(page, today, "nada")).toHaveAttribute("aria-current", "date");
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    // Una operación hace tres semanas, con su nombre.
    const op = plus(today, -21);
    await page.getByRole("button", { name: "Apuntar evento" }).click();
    let sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(sheet.getByText("Elige qué es.")).toBeVisible();
    await sheet.getByText("Operación", { exact: true }).click();
    await sheet.getByLabel("Nombre (si quieres)").fill("Ligamento cruzado anterior");
    await sheet.getByLabel("Día", { exact: true }).fill(op);
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByText("Evento apuntado")).toBeVisible();
    if (op.slice(0, 7) !== today.slice(0, 7)) await page.getByRole("button", { name: "Mes anterior" }).click();
    await expect(page.getByRole("button", { name: /Ligamento cruzado anterior/ })).toBeVisible();
    await expect(dayButton(page, op, "1 evento")).toBeVisible();

    // En el Resumen: hace cuánto, con un enlace a ese día del calendario.
    await tab(page, "Resumen").click();
    await page.getByRole("link", { name: /^Ligamento cruzado anterior: hace 3 semanas \(/ }).click();
    await expect(page).toHaveURL(new RegExp(`/calendario\\?mes=${op.slice(0, 7)}&dia=${op}$`));
    await expect(dayButton(page, op, "1 evento")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Ligamento cruzado anterior" })).toContainText("Operación · Todo el día");

    // Entrenamientos cada semana: de entrada, el día de la semana de hoy; uno más, a las 19:00 y 90 minutos.
    await tab(page, "Calendario").click();
    await expect(page).toHaveURL(/\/calendario$/);
    // Sin día elegido: la lista del mes.
    await expect(page.getByRole("heading", { name: /^En [a-z]+$/ })).toBeVisible();
    await page.getByRole("button", { name: "Apuntar evento" }).click();
    sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    await sheet.getByText("Entrenamiento", { exact: true }).click();
    await sheet.getByLabel("Nombre (si quieres)").fill("Fútbol con su equipo");
    await sheet.getByText("Cada semana", { exact: true }).click();
    const days = sheet.getByRole("group", { name: "Qué días" });
    await expect(days.getByRole("checkbox", { name: WEEK[weekday(today)]! })).toBeChecked();
    const other = WEEK[(weekday(today) + 3) % 7]!;
    await days.getByText(other, { exact: true }).click();
    await sheet.getByLabel("Hora (si la tiene)").fill("19:00");
    await sheet.getByText("90 min", { exact: true }).click();
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByText("Evento apuntado")).toBeVisible();
    // En la lista del mes, una vez, arriba («Cada semana»), y no día a día.
    await expect(page.getByRole("heading", { name: "Cada semana" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toContainText(/Cada .* y .* desde el .*, sin fecha de fin · 19:00 · 90 min/);

    // Los filtros: solo sus citas (ninguna aún) o solo sus eventos.
    const filter = page.getByRole("group", { name: "Qué se ve" });
    await filter.getByRole("button", { name: "Citas" }).click();
    await expect(page.getByText(/^Ninguna cita este mes\./)).toBeVisible();
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toHaveCount(0);
    await expect(page).toHaveURL(/ver=citas/);
    await filter.getByRole("button", { name: "Eventos" }).click();
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toBeVisible();
    await filter.getByRole("button", { name: "Todo" }).click();

    // Hoy: el entrenamiento a su hora. Darle cita a las 19:30 avisa de que se pisa; se da igualmente.
    await page.getByRole("button", { name: "Hoy", exact: true }).click();
    await expect(dayButton(page, today, "1 evento")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Fútbol con su equipo" })).toContainText("19:00 · 90 min");
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Dar cita" }).last().click();
    const visit = page.getByRole("dialog", { name: "Dar cita a Carla Calendario" });
    await visit.getByLabel("Día y hora").fill(`${today}T19:30`);
    await visit.getByRole("button", { name: "Dar la cita" }).click();
    await expect(visit.getByText("Ese día tiene algo en su calendario")).toBeVisible();
    await expect(visit.getByText(/Fútbol con su equipo \(.*, 19:00 · 90 min\)/)).toBeVisible();
    await visit.getByRole("button", { name: "Darla igualmente" }).click();
    await expect(page.getByText("Cita dada")).toBeVisible();
    await expect(dayButton(page, today, "1 cita y 1 evento")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cita a las 19:30/ })).toContainText("45 min · Pendiente");
    // Con «Citas», solo la cita.
    await filter.getByRole("button", { name: "Citas" }).click();
    await expect(page.getByRole("button", { name: /^Cita a las 19:30/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toHaveCount(0);
    await filter.getByRole("button", { name: "Todo" }).click();

    // Borrar la serie: se pregunta antes y se van todas las semanas.
    await page.getByRole("button", { name: /Fútbol con su equipo/ }).click();
    sheet = page.getByRole("dialog", { name: "Cambiar evento" });
    await expect(sheet.getByLabel("Hora (si la tiene)")).toHaveValue("19:00");
    await sheet.getByRole("button", { name: "Borrar el evento" }).click();
    await expect(sheet.getByText(/Se borran todas las semanas/)).toBeVisible();
    await sheet.getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(page.getByText("Evento borrado")).toBeVisible();
    await expect(page.getByRole("button", { name: /Fútbol con su equipo/ })).toHaveCount(0);
    await expect(dayButton(page, today, "1 cita")).toBeVisible();
    // Al volver a entrar, todo sigue donde estaba.
    await page.goto(`${record}/calendario?mes=${op.slice(0, 7)}`);
    await expect(page.getByRole("button", { name: /Ligamento cruzado anterior/ })).toBeVisible();
  });

  test("CA2 un viaje de varios días: «Día 2 de 5», el aviso al dar cita desde la cabecera y lo próximo en el Resumen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const record = await createPatient(page, { name: "Víctor Viaje" });
    const today = madridDay();
    const from = plus(today, 30);
    const to = plus(today, 34);
    await tab(page, "Calendario").click();
    await page.getByRole("button", { name: "Apuntar evento" }).click();
    const sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    await sheet.getByText("Viaje o vacaciones", { exact: true }).click();
    await sheet.getByText("Varios días", { exact: true }).click();
    await sheet.getByLabel("Primer día").fill(from);
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(sheet.getByText("Pon el último día.")).toBeVisible();
    await sheet.getByLabel("Último día").fill(plus(today, 20));
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(sheet.getByText("El último día no puede ser antes del primero.")).toBeVisible();
    await sheet.getByLabel("Último día").fill(to);
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByText("Evento apuntado")).toBeVisible();

    // El segundo día del viaje.
    const second = plus(from, 1);
    await page.goto(`${record}/calendario?mes=${second.slice(0, 7)}&dia=${second}`);
    await expect(page.getByRole("listitem").filter({ hasText: "Viaje o vacaciones" })).toContainText("Todo el día · Día 2 de 5");
    await fits(page);
    await expectAccessible(page);

    // Darle cita desde la cabecera en mitad del viaje: avisa; se cambia el día y se da sin aviso.
    await page.getByRole("button", { name: "Dar cita" }).first().click();
    const visit = page.getByRole("dialog", { name: "Dar cita a Víctor Viaje" });
    await visit.getByLabel("Día y hora").fill(`${plus(from, 2)}T10:00`);
    await visit.getByRole("button", { name: "Dar la cita" }).click();
    await expect(visit.getByText("Ese día tiene algo en su calendario")).toBeVisible();
    await expect(visit.getByText(/Viaje o vacaciones \(.*, todo el día\)/)).toBeVisible();
    await visit.getByLabel("Día y hora").fill(`${plus(to, 1)}T10:00`);
    await expect(visit.getByText("Ese día tiene algo en su calendario")).toHaveCount(0);
    await visit.getByRole("button", { name: "Dar la cita" }).click();
    await expect(page.getByText("Cita dada")).toBeVisible();

    // En el Resumen: lo próximo, con los días que faltan.
    await tab(page, "Resumen").click();
    await expect(page.getByRole("link", { name: /^Viaje o vacaciones: en 30 días \(/ })).toBeVisible();
  });

  test("CA3 lo de cada semana: valores del tipo, «este día no», «volver a poner», «desde este día ya no»; deslizar de mes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const record = await createPatient(page, { name: "Sergio Serie" });
    const today = madridDay();
    await tab(page, "Calendario").click();
    await page.getByRole("button", { name: "Apuntar evento" }).click();
    let sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    // Entrenamiento: «Cada semana», con el día de hoy, sin tocar «Cuándo».
    await sheet.getByText("Entrenamiento", { exact: true }).click();
    await expect(sheet.getByRole("radio", { name: "Cada semana" })).toBeChecked();
    await expect(sheet.getByRole("group", { name: "Qué días" }).getByRole("checkbox", { name: WEEK[weekday(today)]! })).toBeChecked();
    // Un viaje: «Varios días».
    await sheet.getByText("Viaje o vacaciones", { exact: true }).click();
    await expect(sheet.getByRole("radio", { name: "Varios días" })).toBeChecked();
    await sheet.getByText("Entrenamiento", { exact: true }).click();
    await sheet.getByLabel("Nombre (si quieres)").fill("Pádel");
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByText("Evento apuntado")).toBeVisible();
    // En el mes, lo de cada semana lleva su leyenda (punto hueco).
    await expect(page.getByRole("list", { name: "Leyenda" })).toContainText("Cada semana");

    // Hoy no: se toca en el día y «Este día no».
    await page.getByRole("button", { name: "Hoy", exact: true }).click();
    await page.getByRole("button", { name: /Pádel/ }).click();
    sheet = page.getByRole("dialog", { name: "Cambiar evento" });
    await expect(sheet.getByRole("group", { name: /^Solo el / })).toBeVisible();
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await sheet.getByRole("button", { name: "Este día no" }).click();
    await expect(page.getByText(/ya no sale$/)).toBeVisible();
    await expect(dayButton(page, today, "nada")).toBeVisible();
    // Vuelve con «volver a poner», desde la serie.
    await page.getByRole("button", { name: /^Ver todo / }).click();
    await page.getByRole("button", { name: /Pádel/ }).click();
    sheet = page.getByRole("dialog", { name: "Cambiar evento" });
    await sheet.getByRole("button", { name: /^Volver a poner el / }).click();
    await expect(page.getByText(/vuelve a salir$/)).toBeVisible();
    await expect(dayButton(page, today, "1 evento")).toBeVisible();

    // Dentro de una semana: «Desde este día ya no».
    const next = plus(today, 7);
    await page.goto(`${record}/calendario?mes=${next.slice(0, 7)}&dia=${next}`);
    await page.getByRole("button", { name: /Pádel/ }).click();
    await page.getByRole("dialog", { name: "Cambiar evento" }).getByRole("button", { name: "Desde este día ya no" }).click();
    await expect(page.getByText(/^Hasta el /)).toBeVisible();
    await expect(dayButton(page, next, "nada")).toBeVisible();
    await page.goto(`${record}/calendario?mes=${today.slice(0, 7)}&dia=${today}`);
    await expect(dayButton(page, today, "1 evento")).toBeVisible();

    // Deslizar el dedo a la izquierda sobre el mes: el siguiente.
    const [y, m] = today.slice(0, 7).split("-").map(Number) as [number, number];
    const following = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    await page.locator("table").evaluate((el) => {
      const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(300)], changedTouches: [touch(300)] }));
      el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(120)] }));
    });
    await expect(page).toHaveURL(new RegExp(`mes=${following}`));
    await expectAccessible(page);
  });

  test("CA4 apuntar desde la sesión y la anamnesis; las semanas tras la operación en cada sesión; la línea en Agenda › Hoy", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const record = await createPatient(page, { name: "Olga Operada" });
    const today = madridDay();
    // Desde la anamnesis, junto a «Cirugías previas»: la hoja ya viene con «Operación».
    await tab(page, "Anamnesis").click();
    await page.getByRole("button", { name: "Apuntar una operación en su calendario" }).click();
    let sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    await expect(sheet.getByRole("radio", { name: "Operación" })).toBeChecked();
    await sheet.getByLabel("Nombre (si quieres)").fill("Ligamento cruzado");
    await sheet.getByLabel("Día", { exact: true }).fill(plus(today, -30));
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByText("Evento apuntado")).toBeVisible();
    // La anamnesis sigue abierta para escribir.
    await expect(page.getByRole("button", { name: "Guardar anamnesis" })).toBeVisible();

    // En la sesión: cuánto hace, y apuntar sin salir.
    await page.goto(`${record}/sesiones/nueva`);
    await expect(page.getByRole("link", { name: "Ligamento cruzado: hace 4 semanas y 2 días" })).toBeVisible();
    await page.getByRole("button", { name: "Apuntar en su calendario" }).click();
    sheet = page.getByRole("dialog", { name: "Apuntar evento" });
    await sheet.getByText("Competición", { exact: true }).click();
    await sheet.getByLabel("Nombre (si quieres)").fill("Partido");
    await sheet.getByLabel("Día", { exact: true }).fill(plus(today, 3));
    await sheet.getByRole("button", { name: "Apuntar" }).click();
    await expect(page.getByRole("link", { name: "Ligamento cruzado: hace 4 semanas y 2 días · Partido: en 3 días" })).toBeVisible();
    await fits(page);
    await page.getByLabel("Tratamiento", { exact: true }).fill("Movilidad y fuerza");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" })).toContainText("4 semanas y 2 días tras la operación");

    // Agenda › Hoy: bajo su nombre, lo de su calendario.
    await page.goto(`${record}/calendario?dia=${today}`);
    await page.getByRole("button", { name: /^Dar cita a las / }).click();
    const visit = page.getByRole("dialog", { name: "Dar cita a Olga Operada" });
    await visit.getByRole("button", { name: "Dar la cita" }).click();
    await expect(page.getByText("Cita dada")).toBeVisible();
    await page.goto("./agenda?vista=hoy");
    await expect(page.getByRole("region", { name: "Citas de hoy" }).getByRole("listitem").filter({ hasText: "Olga Operada" })).toContainText("Ligamento cruzado: hace 4 semanas y 2 días · Partido: en 3 días");
  });
});
