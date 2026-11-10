// La anamnesis base (lo mínimo: 16 preguntas en tres bloques) y la ampliada (todas), con «Modificar» para elegir dónde
// sale cada pregunta (docs/anamnesis-adaptable.md). En el móvil, sin desbordes.
import { ampliada, createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";
import type { Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });
const fits = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

test.describe("Anamnesis base y ampliada", () => {
  test("AB1 se abre en la base (tres bloques); la ampliada, a un toque; lo ya escrito se ve siempre", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await createPatient(page, { name: "Berta Base" });
    await tab(page, "Anamnesis").click();
    const level = page.getByRole("group", { name: "Anamnesis", exact: true });
    await expect(level.getByRole("button", { name: /^Base/ })).toHaveAttribute("aria-pressed", "true");
    await expect(level.getByRole("button", { name: /^Base/ })).toContainText("16 preguntas");
    await expect(level.getByRole("button", { name: /^Ampliada/ })).toContainText("55 preguntas");
    // Tres bloques a la vista, sin plegar, con lo mínimo.
    for (const title of ["Motivo de consulta", "Salud", "Diagnóstico y plan"]) await expect(page.getByRole("region", { name: title })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Apartados de la anamnesis" })).toHaveCount(0);
    const motivo = page.getByRole("region", { name: "Motivo de consulta" });
    for (const label of ["Motivo principal", "Fecha de inicio", "Factores agravantes", "Factores atenuantes"]) await expect(motivo.getByLabel(label)).toBeVisible();
    for (const group of ["Zona", "Lado", "Banderas rojas"]) await expect(motivo.getByRole("group", { name: group, exact: true })).toBeVisible();
    const salud = page.getByRole("region", { name: "Salud" });
    for (const label of ["Enfermedades previas", "Cirugías previas", "Medicación actual", "Alergias"]) await expect(salud.getByLabel(label)).toBeVisible();
    await expect(salud.getByRole("group", { name: "Precauciones" })).toBeVisible();
    const plan = page.getByRole("region", { name: "Diagnóstico y plan" });
    for (const label of ["Diagnóstico fisioterapéutico (criterio del profesional)", "Plan de intervención propuesto", "Observaciones"]) await expect(plan.getByLabel(label)).toBeVisible();
    // Lo de la ampliada no está.
    for (const label of ["Profesión", "Localización del dolor/síntoma", "Tipo de dolor", "Palpación", "Objetivos a corto plazo"]) await expect(page.getByLabel(label)).toHaveCount(0);
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    await page.getByLabel("Motivo principal").fill("Dolor lumbar al levantarse");
    // La ampliada: todos los apartados, como siempre. Lo que se rellena en ella se queda a la vista al volver.
    await ampliada(page);
    await expect(page.getByRole("navigation", { name: "Apartados de la anamnesis" })).toBeVisible();
    await expect(page.getByLabel("Motivo principal")).toHaveValue("Dolor lumbar al levantarse");
    await page.getByLabel("Localización del dolor/síntoma").fill("Lumbar baja, a la derecha");
    await fits(page);
    await level.getByRole("button", { name: /^Base/ }).click();
    await expect(page.getByLabel("Localización del dolor/síntoma")).toHaveValue("Lumbar baja, a la derecha");
    await expect(page.getByLabel("Tipo de dolor")).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();

    // Al leerla: lo de la base y lo de la ampliada, contado; los apartados solo de la ampliada y vacíos no salen.
    await expect(page.getByText(/1 de 16 de la base · 1 de la ampliada/)).toBeVisible();
    await expect(page.locator("summary", { hasText: "Motivo de consulta" })).toContainText("2 de 9");
    await expect(page.locator("summary", { hasText: "Hábitos y estilo de vida" })).toHaveCount(0);
    await expect(page.locator("summary", { hasText: "Exploración física" })).toHaveCount(0);
    await expect(page.getByText("Lumbar baja, a la derecha")).toBeVisible();
    // Al volver a editar, en la base: lo ya respondido de la ampliada sigue a la vista.
    await page.getByRole("button", { name: "Editar anamnesis" }).click();
    await expect(level.getByRole("button", { name: /^Base/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Localización del dolor/síntoma")).toHaveValue("Lumbar baja, a la derecha");
    await expect(page.getByLabel("Tipo de dolor")).toHaveCount(0);
  });

  test("AB2 «Modificar»: guarda lo escrito y lleva al editor, donde cada pregunta sale en la base, en la ampliada o en ninguna", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await createPatient(page, { name: "Mario Modifica" });
    const record = page.url();
    await tab(page, "Anamnesis").click();
    await page.getByLabel("Motivo principal").fill("Esguince de tobillo");
    await page.getByRole("button", { name: /^Modificar/ }).click();
    // Lo escrito se guarda antes de salir.
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();
    await expect(page.getByText("Lo que cambies lo ve todo el equipo. Lo ya respondido no se toca.")).toBeVisible();
    await expect(page.getByText("Base: 16 preguntas")).toBeVisible();
    await expect(page.getByText(/Ampliada: 55 preguntas/)).toBeVisible();

    // «Profesión» pasa a la base; «Factores atenuantes», a la ampliada.
    const datos = page.locator("#plantilla-datos");
    await expect(datos.locator("summary")).toContainText("1 en la base");
    await datos.locator("summary").click();
    await datos.getByRole("button", { name: /^Profesión/ }).click();
    let sheet = page.getByRole("dialog", { name: "Pregunta" });
    const place = () => sheet.getByRole("group", { name: "Sale en" });
    await expect(place().getByRole("button", { name: "Ampliada" })).toHaveAttribute("aria-pressed", "true");
    await place().getByRole("button", { name: "Base", exact: true }).click();
    await expect(place().getByRole("button", { name: "Base", exact: true })).toHaveAttribute("aria-pressed", "true");
    await fits(page);
    await sheet.getByRole("button", { name: "Listo" }).click();
    await expect(datos.locator("summary")).toContainText("2 en la base");
    // (Cambiada: su fila lleva delante el punto de «Cambiada».)
    await expect(datos.getByRole("button", { name: /Profesión/ })).toContainText("Base ·");
    const motivo = page.locator("#plantilla-motivo");
    await motivo.locator("summary").click();
    await motivo.getByRole("button", { name: /^Factores atenuantes/ }).click();
    sheet = page.getByRole("dialog", { name: "Pregunta" });
    await place().getByRole("button", { name: "Ampliada" }).click();
    await sheet.getByRole("button", { name: "Listo" }).click();
    await expect(motivo.getByRole("button", { name: /Factores atenuantes/ })).toContainText("Ampliada ·");
    // «Tipo de dolor», a ninguna: se oculta desde la misma hoja.
    await motivo.getByRole("button", { name: /^Tipo de dolor/ }).click();
    sheet = page.getByRole("dialog", { name: "Pregunta" });
    await place().getByRole("button", { name: "Oculta" }).click();
    await expect(page.getByRole("dialog", { name: "Pregunta" })).toHaveCount(0);
    await expect(motivo.getByRole("switch", { name: "Mostrar «Tipo de dolor»" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Base: 16 preguntas")).toBeVisible();
    await expect(page.getByText(/Ampliada: 54 preguntas/)).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await fits(page);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    // En la ficha: la base ya trae «Profesión» y no «Factores atenuantes»; lo guardado sigue ahí.
    await page.goto(`${record}/anamnesis`);
    await expect(page.getByText("Esguince de tobillo").first()).toBeVisible();
    await page.getByRole("button", { name: "Editar anamnesis" }).click();
    await expect(page.getByLabel("Motivo principal")).toHaveValue("Esguince de tobillo");
    await expect(page.getByLabel("Profesión")).toBeVisible();
    await expect(page.getByLabel("Factores agravantes")).toBeVisible();
    await expect(page.getByLabel("Factores atenuantes")).toHaveCount(0);
    await ampliada(page);
    await expect(page.getByLabel("Factores atenuantes")).toBeVisible();
    await expect(page.getByLabel("Tipo de dolor")).toHaveCount(0);
  });
});
