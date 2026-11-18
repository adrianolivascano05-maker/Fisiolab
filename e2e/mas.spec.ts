// El botón «＋» del centro de la barra (docs/rediseno-sencilla.md, bloque 4): lo que más se hace desde cualquier
// pantalla, lo del paciente de la ficha primero, los últimos pacientes y un buscador de pacientes y de pantallas.
import { expect, expectAccessible, test } from "./fixtures";

test("MS1 «＋»: paciente nuevo, lo de su ficha primero, cita sin salir, buscar un paciente o una pantalla y los últimos pacientes", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  const nav = page.getByRole("navigation", { name: "Principal" });
  // Las cuatro pestañas de siempre y, en el centro, el «＋».
  await expect(nav.getByRole("link")).toHaveCount(4);
  await nav.getByRole("button", { name: "Añadir o buscar" }).click();
  const sheet = page.getByRole("dialog", { name: "Añadir o buscar" });
  await expect(sheet.getByRole("button", { name: "Cita nueva" })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  await expectAccessible(page);
  await sheet.getByRole("link", { name: "Paciente nuevo" }).click();
  await expect(page).toHaveURL(/\/pacientes\/nuevo$/);
  await page.getByLabel("Nombre").fill("Quique Rápido Ruiz");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Quique Rápido Ruiz" })).toBeVisible();

  // En su ficha, primero lo suyo.
  await nav.getByRole("button", { name: "Añadir o buscar" }).click();
  const his = sheet.getByRole("region", { name: "Con Quique Rápido Ruiz" });
  await expect(his.getByRole("link", { name: "Nueva sesión" })).toHaveAttribute("href", /\/sesiones\/nueva$/);
  await expect(his.getByRole("link", { name: "Cobros de Quique" })).toBeVisible();
  await expect(his.getByRole("link", { name: "Su calendario" })).toBeVisible();
  await expectAccessible(page);
  // Darle cita sin salir de donde se está.
  await his.getByRole("button", { name: "Cita para Quique" }).click();
  const give = page.getByRole("dialog", { name: "Dar cita a Quique Rápido Ruiz" });
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  await give.getByLabel("Día y hora").fill(`${tomorrow}T10:00`);
  await give.getByRole("button", { name: "Dar la cita" }).click();
  await expect(give).toBeHidden();
  await expect(page.getByRole("button", { name: /^Próxima cita: / })).toBeVisible();

  // Buscar: una pantalla por otra palabra («contraseña» → el PIN) y un paciente por un trozo del nombre.
  await page.goto("./agenda");
  // Con la Agenda ya cargada: si la hoja se abre mientras aún carga, la carga la cierra.
  await expect(page.getByRole("group", { name: "Vista" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Hoy en cifras" }).or(page.getByRole("button", { name: /anterior$/ })).first()).toBeVisible();
  await nav.getByRole("button", { name: "Añadir o buscar" }).click();
  const search = sheet.getByRole("searchbox", { name: "Buscar un paciente o una pantalla" });
  await expect(search).toBeVisible();
  await search.fill("contraseña");
  await expect(sheet.getByRole("link", { name: "Bloqueo con PIN" })).toBeVisible();
  await search.fill("rápido");
  await sheet.getByRole("link", { name: "Quique Rápido Ruiz" }).click();
  await expect(page.getByRole("heading", { name: "Quique Rápido Ruiz" })).toBeVisible();

  // Fuera de su ficha, sale entre los últimos pacientes.
  await page.goto("./biblioteca");
  await nav.getByRole("button", { name: "Añadir o buscar" }).click();
  await expect(sheet.getByRole("region", { name: "Últimos pacientes" }).getByRole("link", { name: "Quique Rápido Ruiz" })).toBeVisible();
  await sheet.getByRole("button", { name: "Cita nueva" }).click();
  await expect(page.getByRole("dialog", { name: "Nueva cita" })).toBeVisible();
});
