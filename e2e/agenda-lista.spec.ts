// La Agenda en el móvil (docs/rediseno-sencilla.md, bloque 3): la tira de la semana y el día en lista, con sus huecos
// libres y lo cerrado. A 360 px, sin desbordes y con zonas táctiles de 44 px.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

const madridDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const plus = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test("AL1 el día en lista: tira de la semana con sus números, citas, hueco libre a un toque, lo cerrado y volver a la rejilla", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const day = plus(madridDay(), 1);
  const give = async (name: string, time: string) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.getByRole("button", { name: "Dar cita" }).click();
    const sheet = page.getByRole("dialog", { name: `Dar cita a ${name}` });
    await sheet.getByLabel("Día y hora").fill(`${day}T${time}`);
    await sheet.getByRole("button", { name: "Dar la cita" }).click();
    await expect(sheet).toBeHidden();
  };
  await give("Lola Lista", "10:00");
  await give("Tomás Tira", "12:30");

  await page.goto(`./agenda?dia=${day}`);
  await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
  // La tira: el día elegido, con sus dos citas.
  const strip = page.getByRole("group", { name: "Días de la semana" });
  await expect(strip.getByRole("button", { pressed: true })).toHaveAccessibleName(/: 2 citas$/);
  // La lista: las dos citas con el mismo nombre que en la rejilla y, entre ellas, el hueco (10:45–12:30).
  const list = page.getByRole("list", { name: /^Citas del / });
  await expect(list.getByRole("button", { name: /^Lola Lista, 10:00–10:45, Pendiente/ })).toBeVisible();
  await expect(list.getByRole("button", { name: /^Tomás Tira, 12:30–13:15, Pendiente/ })).toBeVisible();
  const free = list.getByRole("button", { name: /^Hueco libre de 10:45 a 12:30: Libre 1 h 45 min/ });
  await expect(free).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // Un rato cerrado dentro del hueco: sale en la lista y el hueco se parte.
  await page.getByRole("button", { name: "Bloquear horas o días" }).click();
  const block = page.getByRole("dialog", { name: "Bloquear horas o días" });
  await block.getByLabel("Cuánto").selectOption("hours");
  await block.getByLabel("Día", { exact: true }).fill(day);
  await block.getByLabel("Desde", { exact: true }).fill("11:30");
  await block.getByLabel("Hasta", { exact: true }).fill("12:30");
  await block.getByLabel("Motivo").fill("Formación");
  await block.getByRole("button", { name: "Bloquear sin citas" }).click();
  await expect(block).toBeHidden();
  await expect(list.getByRole("button", { name: /Agenda cerrada: Formación · 11:30–12:30/ })).toBeVisible();
  await expect(list.getByRole("button", { name: /^Hueco libre de 10:45 a 11:30: Libre 45 min/ })).toBeVisible();

  // Tocar el hueco: la cita nueva viene con esa hora.
  await list.getByRole("button", { name: /^Hueco libre de 10:45 a 11:30/ }).click();
  const fresh = page.getByRole("dialog", { name: "Nueva cita" });
  await expect(fresh.getByLabel("Día y hora")).toHaveValue(`${day}T10:45`);
  await page.keyboard.press("Escape");
  await expect(fresh).toBeHidden();

  // Tocar una cita abre su hoja de siempre.
  await list.getByRole("button", { name: /^Lola Lista, 10:00–10:45/ }).click();
  await expect(page.getByRole("dialog", { name: "Cita de Lola Lista" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Otro día desde la tira; y la rejilla sigue a un toque (y se recuerda).
  await strip.getByRole("button").first().click();
  await expect(strip.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ver el día en rejilla" }).click();
  await expect(page.getByRole("button", { name: "Ver el día en lista" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver el día en lista" })).toBeVisible();
});
