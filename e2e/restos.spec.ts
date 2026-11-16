// Restos del rediseño (docs/rediseno-sencilla.md): la anamnesis guardada dice cada apartado en una línea.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("RE1 anamnesis guardada: cada apartado plegado dice lo respondido en una línea", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Ada Apartado");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Ada Apartado" })).toBeVisible();
  await page.goto(`${page.url()}/anamnesis`);
  await page.getByLabel("Alergias").fill("Al látex");
  await page.getByRole("button", { name: "Guardar anamnesis" }).click();
  await expect(page.locator("[data-summary]").filter({ has: page.locator("xpath=self::*[contains(@data-summary,'Al látex')]") })).toHaveCount(1);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
});
