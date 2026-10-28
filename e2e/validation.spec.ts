// Validación (punto 1), propuesta de marcas con IA y edición de marcas.
import { createPatient, expect, expectAccessible, markAt, scrubber, startJump, test } from "./fixtures";

test.describe("Validación y marcas", () => {
  test("V1 pares con una referencia: análisis, Bland-Altman, diferencia clínica y CSV", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Validación de las mediciones/ }).click();
    await expect(page.getByRole("heading", { name: "Validación" })).toBeVisible();
    await expect(page.getByText(/Con 2 pares o más/)).toBeVisible();
    const pairs: [string, string][] = [
      ["31,2", "30,4"],
      ["27,5", "26,8"],
      ["40,1", "39,0"],
      ["35,9", "35,3"],
      ["22,4", "21,9"],
    ];
    for (const [a, b] of pairs) {
      await page.getByLabel("OmniClin", { exact: true }).fill(a);
      await page.getByLabel("Referencia", { exact: true }).fill(b);
      await page.getByRole("button", { name: "Añadir par" }).click();
      await expect(page.getByLabel("OmniClin", { exact: true })).toHaveValue("");
    }
    await expect(page.getByRole("heading", { name: "Pares (5)" })).toBeVisible();
    // Diferencias 0,8 0,7 1,1 0,6 0,5 → sesgo 0,74; todas dentro de ±2 cm.
    await expect(page.getByText("Intercambiables")).toBeVisible();
    await expect(page.getByText(/orientativo/)).toBeVisible();
    await expect(page.getByText("0,74").first()).toBeVisible();
    await expect(page.getByText(/Bland-Altman/)).toBeVisible();
    await expectAccessible(page);

    // Con una diferencia clínica de 0,5 cm ya no son intercambiables: sesgo constante.
    await page.getByLabel("Diferencia que importa en tu clínica").fill("0,5");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Sesgo constante: se puede corregir")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/^validacion-jump_height-reference-/);

    await page.getByRole("button", { name: /^Borrar el par/ }).first().click();
    await expect(page.getByRole("heading", { name: "Pares (4)" })).toBeVisible();
  });

  test("V2 volver a marcar a ciegas guarda la fiabilidad sin cambiar el test", async ({ page }) => {
    await createPatient(page, { name: "Ciego" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    // Corregir con los botones de la lista: un fotograma después y vuelta.
    await page.getByRole("button", { name: "Aterrizaje: un fotograma después" }).click();
    await expect(scrubber(page)).toHaveAttribute("aria-valuenow", "221");
    await page.getByRole("button", { name: "Aterrizaje: un fotograma antes" }).click();
    await expect(page.locator("#h-marcas + ul").getByText(/^fotograma 221/)).toBeVisible();
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: /Marcar otra vez a ciegas/ }).click();
    await expect(page.getByText("Marcado a ciegas")).toBeVisible();
    await expect(page.locator("#h-marcas")).toHaveCount(0); // no se ven las marcas anteriores
    await expectAccessible(page);
    await markAt(page, 101, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular y comparar" }).click();
    await expect(page.getByRole("heading", { name: "Validación" })).toBeVisible();
    await expect(page.getByLabel("Qué se compara")).toHaveValue("remark");
    await expect(page.getByRole("heading", { name: "Pares (1)" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "30,66", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible(); // el test no cambió
  });

  test("V3 la IA avisa si no hay nadie en el vídeo y deja marcar a mano", async ({ page }) => {
    test.setTimeout(180_000);
    await createPatient(page, { name: "Sin persona" });
    await startJump(page);
    await page.getByRole("button", { name: "Proponer las marcas con IA" }).click();
    await expect(page.getByText(/No se detecta a ninguna persona/)).toBeVisible({ timeout: 150_000 });
    await expect(scrubber(page)).toBeVisible();
    await markAt(page, 100, "despegue");
  });

  test("V4 comprobar el sensor: pantalla y pasos", async ({ page }) => {
    await page.goto("./validacion?tipo=rom_angle");
    await page.getByRole("link", { name: "Comprobar el sensor" }).click();
    await expect(page.getByRole("heading", { name: "Comprobar el sensor" })).toBeVisible();
    await expect(page.getByText("1. Sobre una mesa")).toBeVisible();
    await expectAccessible(page);
  });
});
