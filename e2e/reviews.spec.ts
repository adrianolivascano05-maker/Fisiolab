// Mejoras sacadas de lo que piden los usuarios de apps de salto en sus reseñas.
import { createPatient, expect, expectAccessible, markAt, scrubber, startJump, test, video } from "./fixtures";

test.describe("Mejoras por las reseñas", () => {
  test("R1 las marcas sin calcular sobreviven a una recarga y el resultado enseña su cálculo", async ({ page }) => {
    await createPatient(page, { name: "Borrador" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    // Android recarga la página al volver de la cámara o de la galería.
    await page.reload();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await expect(page.getByText("Marcas recuperadas")).toBeVisible();
    await expect(scrubber(page)).toHaveAttribute("aria-valuenow", "100");
    await expectAccessible(page);
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();

    await page.getByText("Cómo se ha calculado").click();
    await expect(page.getByText("120 fotogramas ÷ 240 fps = 500 ms")).toBeVisible();
    await expect(page.getByText("9,81 × 0,500² ÷ 8 = 30,7 cm")).toBeVisible();
    await expectAccessible(page);

    // Calculado: el borrador ya no está.
    await page.getByRole("link", { name: /Revisar marcas/ }).click();
    await expect(scrubber(page)).toBeVisible();
    await expect(page.getByText("Marcas recuperadas")).toHaveCount(0);
  });

  test("R2 medición rápida sin rellenar ficha, siempre en la misma ficha", async ({ page }) => {
    // Desde la Guía de tests: «Medir ahora, sin ficha».
    await page.goto("./exploracion");
    await page.getByRole("button", { name: /^Medir ahora, sin ficha/ }).click();
    await expect(page.getByRole("heading", { name: "Nueva medición" })).toBeVisible();
    await page.goto("./exploracion");
    await page.getByRole("button", { name: /^Medir ahora, sin ficha/ }).click();
    await expect(page.getByRole("heading", { name: "Nueva medición" })).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /^Medición rápida/ })).toHaveCount(1);
    await expectAccessible(page);
  });
});
