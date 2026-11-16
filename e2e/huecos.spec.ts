// Dar cita eligiendo entre huecos (docs/rediseno-sencilla.md, bloque 10): tres huecos propuestos, las horas libres de
// otro día, la hora a mano como siempre y un botón que dice lo que va a hacer.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

/** AAAA-MM-DD del próximo día de la semana `weekday` (1 lunes … 6 sábado), de pasado mañana en adelante. */
function nextWeekday(weekday: number) {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("HU1 dar cita: huecos propuestos, horas libres de otro día y el botón dice el día y la hora", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Hugo Hueco");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Hugo Hueco" })).toBeVisible();

  await page.getByRole("button", { name: "Dar cita" }).click();
  const sheet = page.getByRole("dialog", { name: "Dar cita a Hugo Hueco" });
  const free = sheet.getByRole("group", { name: "Huecos libres" });
  // Tres propuestas, cada una de un día distinto.
  await expect(free.getByRole("button", { pressed: false })).toHaveCount(3);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // Las horas libres de otro día: un miércoles, desde las 9; un sábado, ninguna.
  await free.getByLabel("Ver las horas libres de otro día").fill(nextWeekday(6));
  await expect(free.getByText("Ese día no hay horas libres.")).toBeVisible();
  await free.getByLabel("Ver las horas libres de otro día").fill(nextWeekday(3));
  const hours = free.getByRole("group", { name: "Horas libres de ese día" });
  await expect(hours.getByRole("button", { name: "09:00" })).toBeVisible();
  await hours.getByRole("button", { name: "10:30" }).click();
  await expect(hours.getByRole("button", { name: "10:30" })).toHaveAttribute("aria-pressed", "true");
  // Lo elegido pasa a «Día y hora» y el botón dice lo que va a hacer.
  await expect(sheet.getByLabel("Día y hora")).toHaveValue(`${nextWeekday(3)}T10:30`);
  await expect(sheet.getByRole("button", { name: /^Dar la cita · mié, .*10:30$/ })).toBeVisible();
  expect(await smallTargets(page)).toEqual([]);

  // Un hueco propuesto con un toque, y se da.
  await free.getByRole("button", { pressed: false }).first().click();
  await sheet.getByRole("button", { name: /^Dar la cita · / }).click();
  await expect(page.getByRole("button", { name: /^Próxima cita: / })).toBeVisible();
});
