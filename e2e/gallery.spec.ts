// Galería de tests de exploración (módulo independiente de src/gallery).
import { expect, expectAccessible, test } from "./fixtures";

test.describe("Galería de tests", () => {
  test("G1 articulación → patología → test, con figura, evidencia y favoritos", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("link", { name: "Exploración" }).click();
    await expect(page.getByRole("heading", { name: "Exploración" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: /^Rodilla/ }).click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: /Lachman/ }).first().click();
    await expect(page.getByRole("img", { name: /Lachman/ }).first()).toBeVisible();
    // Animación: fases con su texto, pausa y avance manual.
    await page.getByRole("button", { name: "3. Qué buscar" }).first().click();
    await expect(page.getByRole("button", { name: "Reproducir la animación" }).first()).toBeVisible();
    await expect(page.locator("figcaption").first()).toContainText("Positivo si");
    await page.getByRole("button", { name: "1. Colocación" }).first().click();
    await expect(page.locator("figcaption").first()).toContainText(/supino/i);
    await expect(page.getByRole("heading", { name: "Cómo se hace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidencia" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Añadir a favoritos" }).click();
    await page.getByRole("link", { name: "Volver" }).click();
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible();
  });

  test("G2 buscador sin tildes ni mayúsculas", async ({ page }) => {
    await page.goto("./exploracion");
    await page.getByLabel("Buscar un test").fill("TUNEL carpiano");
    await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link").first()).toBeVisible();
    await page.getByLabel("Buscar un test").fill("zzzz");
    await expect(page.getByText("Ningún test coincide con «zzzz».")).toBeVisible();
  });

  test("G3 calculadora de probabilidad tras el test", async ({ page }) => {
    await page.goto("./exploracion");
    await page.getByLabel("Buscar un test").fill("Lachman");
    await page.getByRole("list", { name: "Resultados" }).getByRole("link").first().click();
    const calc = page.getByText("Qué cambia el resultado");
    if (await calc.count()) {
      await expect(page.getByText("Si es positivo")).toBeVisible();
      await page.getByLabel(/Probabilidad antes del test/).fill("50");
      await expect(page.getByText(/50 %/).first()).toBeVisible();
    }
  });
});
