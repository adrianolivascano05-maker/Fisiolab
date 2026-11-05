// Cuestionarios propios de la clínica (docs/cuestionarios-propios.md): crearlo, la etiqueta fija, pasarlo en consulta,
// verlo en la ficha y en la Biblioteca, y archivarlo sin perder lo respondido. En el móvil, sin desbordes.
import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";

const LABEL = "Cuestionario propio de la clínica · no validado";

/** Crea en el editor un cuestionario de dos preguntas (una escala y unas opciones con puntos) con nota «Suma». */
async function createOwn(page: Page, name: string) {
  await page.goto("./ajustes/cuestionarios-propios");
  await expect(page.getByText(/Todavía no hay cuestionarios propios/)).toBeVisible();
  await page.getByRole("button", { name: "Nuevo cuestionario" }).click();
  // La primera vez, la línea fija de los derechos de autor.
  await expect(page.getByText("No copies cuestionarios con derechos de autor (KOOS, Oswestry, QuickDASH, NDI…). El contenido es responsabilidad de tu clínica.")).toBeVisible();
  await page.getByLabel("Nombre").fill("KOOS adaptado");
  await expect(page.getByText(/Ese nombre es de un cuestionario con derechos de autor \(KOOS\)/)).toBeVisible();
  await page.getByLabel("Nombre").fill(name);
  await expect(page.getByText(/Ese nombre es de un cuestionario/)).toHaveCount(0);
  await page.getByLabel("Nota para el profesional (opcional)").fill("Comentarlo en la última sesión.");
  await page.getByRole("button", { name: "Añadir pregunta" }).click();
  await page.getByLabel("Pregunta 1", { exact: true }).fill("¿Cómo de satisfecho está con el trato?");
  await page.getByLabel("Texto del 0").fill("Nada");
  await page.getByLabel("Texto del 10").fill("Muchísimo");
  await page.getByRole("button", { name: "Añadir pregunta" }).click();
  await page.getByLabel("Pregunta 2", { exact: true }).fill("¿Hace los ejercicios en casa?");
  const second = page.getByRole("group", { name: "Editar la pregunta 2" });
  await second.getByRole("button", { name: "Opciones con puntos" }).click();
  await second.getByRole("button", { name: "Nunca 0 · A veces 1 · A menudo 2 · Siempre 3" }).click();
  await expect(second.getByLabel("Opción 4", { exact: true })).toHaveValue("Siempre");
  // Así lo verá el paciente: con la etiqueta.
  await page.getByRole("button", { name: "Así lo verá" }).click();
  const preview = page.getByRole("dialog", { name: "Así lo verá el paciente" });
  await expect(preview).toContainText("no validado");
  await expect(preview).toContainText("¿Hace los ejercicios en casa?");
  await preview.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cuestionario guardado")).toBeVisible();
  await expect(page.getByRole("region", { name: "Cuestionarios de la clínica" })).toContainText("2 preguntas · con nota");
}

test.describe("Cuestionarios propios", () => {
  test("CP1 crear, pasarlo en consulta y verlo en la ficha con su etiqueta y su nota para el profesional", async ({ page }) => {
    test.slow();
    await createOwn(page, "Satisfacción con el tratamiento");
    await expectAccessible(page);

    // En la Biblioteca, en su grupo.
    await page.goto("./biblioteca/cuestionarios");
    await expect(page.getByRole("region", { name: "De la clínica" })).toContainText("Satisfacción con el tratamiento");

    const record = await createPatient(page, { name: "Pilar Propia" });
    await page.goto(`${record}/cuestionarios/nuevo`);
    const group = page.getByRole("region", { name: "De la clínica" });
    await expect(group).toContainText("No validado");
    await group.getByRole("button", { name: /Satisfacción con el tratamiento/ }).click();
    await expect(page.getByText(LABEL).first()).toBeVisible();
    await expect(page.getByText(/^Nota para el profesional \(.*\): Comentarlo en la última sesión\.$/)).toBeVisible();
    // Solo se rellena (no hay «solo anotar la nota»).
    await expect(page.getByText("Solo anotar la nota")).toHaveCount(0);
    await page.getByRole("group", { name: /¿Cómo de satisfecho/ }).getByText("8", { exact: true }).click();
    await page.getByRole("group", { name: /¿Hace los ejercicios/ }).getByText("A menudo", { exact: true }).click();
    await expect(page.getByLabel("Nota: 10/13")).toBeVisible();
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByText("Cuestionario registrado")).toBeVisible();
    const tiles = page.getByRole("list", { name: "Cuestionarios" });
    await expect(tiles).toContainText(`Satisfacción con el tratamiento (${LABEL})`);
    await expect(tiles).toContainText("10/13");
    await expect(tiles).toContainText("Comentarlo en la última sesión.");

    // Archivarlo: fuera de «Pasar», pero lo respondido se sigue viendo.
    await page.goto("./ajustes/cuestionarios-propios");
    await page.getByRole("button", { name: "Más opciones de «Satisfacción con el tratamiento»" }).click();
    await page.getByRole("button", { name: "Archivar" }).click();
    await page.getByRole("dialog", { name: /¿Archivar/ }).getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByRole("list", { name: "Cuestionarios archivados" })).toContainText("Satisfacción con el tratamiento");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await expect(page.getByRole("region", { name: "De la clínica" })).toHaveCount(0);
    await page.goto(`${record}/cuestionarios`);
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("10/13");
  });

  test("CP2 en el móvil de 360 px: lista y editor sin desbordes y con zonas de 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await createOwn(page, "Control semanal de prueba");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole("link", { name: /Control semanal de prueba/ }).click();
    await expect(page.getByLabel("Nombre")).toHaveValue("Control semanal de prueba");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Salir con cambios sin guardar avisa.
    await page.getByLabel("Nombre").fill("Control semanal (cambiado)");
    await page.getByRole("link", { name: /Volver/ }).click();
    const warn = page.getByRole("dialog", { name: "Tienes cambios sin guardar" });
    await expect(warn).toBeVisible();
    await warn.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByRole("region", { name: "Cuestionarios de la clínica" })).toContainText("Control semanal de prueba");
    await expectAccessible(page);
  });
});
