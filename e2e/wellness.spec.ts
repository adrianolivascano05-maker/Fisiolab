import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, loadSeed, test } from "./fixtures";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });

async function answer(page: Page, values: Record<string, number>) {
  for (const [item, v] of Object.entries(values)) {
    const group = page.getByRole("group", { name: item, exact: true });
    // Se pulsa el número visible, como haría una persona (el radio está oculto).
    await group.getByText(String(v), { exact: true }).click();
    await expect(group.getByRole("radio", { name: String(v), exact: true })).toBeChecked();
  }
}

test.describe("F13 Bienestar", () => {
  test("F13-H1 cuestionario: incompleto, guardar, resumen y corregir el mismo día", async ({ page }) => {
    await createPatient(page, { name: "Bienestar" });
    // El bienestar diario es un cuestionario: en Valoración › Cuestionarios.
    await tab(page, "Valoración").click();
    await page.getByRole("link", { name: /^Bienestar diario/ }).click();
    await expect(page.getByRole("heading", { name: "¿Cómo está hoy?" })).toBeVisible();
    await answer(page, { Fatiga: 4, "Calidad del sueño": 2 });
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Falta responder: dolor muscular general, estrés, ánimo.")).toBeVisible();
    await answer(page, { "Dolor muscular general": 3, Estrés: 5, Ánimo: 3 });
    await page.getByLabel("Dolor de la lesión (opcional)").fill("12");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Un número entero de 0 a 10, o déjalo vacío.")).toBeVisible();
    await page.getByLabel("Dolor de la lesión (opcional)").fill("3");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar" }).click();

    const summary = page.getByRole("region", { name: "Resumen de hoy" });
    await expect(summary).toContainText(/17\s*\/ 25/); // 4 + 2 + 3 + 5 + 3
    await expect(summary).toContainText("Con 3 días más se podrá comparar con su media.");
    await expect(summary).toContainText("calidad del sueño (2)");
    await expect(summary).toContainText("Dolor de la lesión: 3 / 10");

    // El mismo día se corrige, no se duplica.
    await expect(page.getByRole("heading", { name: "Corregir lo de hoy" })).toBeVisible();
    await answer(page, { "Calidad del sueño": 4 });
    await page.getByRole("button", { name: "Actualizar el de hoy" }).click();
    await expect(summary).toContainText("19");
    await expect(summary).not.toContainText("Respuestas de 1 o 2");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expectAccessible(page);

    await page.getByRole("link", { name: "Volver a Valoración" }).click();
    await expect(page.getByRole("link", { name: /^Bienestar diario.*19\/25/ })).toBeVisible();
  });

  test("F13-H2 su media de 30 días con los datos de ejemplo, sin clasificar el día", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await tab(page, "Valoración").click();
    await page.getByRole("link", { name: /^Bienestar diario.*14\/25/ }).click();
    const summary = page.getByRole("region", { name: "Resumen de hoy" });
    await expect(summary).toContainText("Su media de los últimos 30 días");
    await expect(summary).not.toContainText("habitual");
    await expect(summary).toContainText("fatiga (2), calidad del sueño (2)");
    await expect(page.locator(".recharts-line")).toHaveCount(1);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(8);
    await expectAccessible(page);
    await page.getByRole("button", { name: /Borrar el registro del/ }).last().click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(7);
  });
});
