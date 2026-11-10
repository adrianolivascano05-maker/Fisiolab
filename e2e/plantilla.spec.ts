// Ajustes › Anamnesis de la clínica (docs/anamnesis-adaptable.md): el editor que parece la anamnesis. Ocultar,
// renombrar, añadir, deshacer y volver al original; lo ya respondido se sigue leyendo; en el móvil, sin desbordes.
import type { Page } from "@playwright/test";
import { ampliada, createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });
const editor = async (page: Page) => {
  await page.goto("./ajustes/anamnesis");
  await expect(page.getByText("Lo que cambies lo ve todo el equipo. Lo ya respondido no se toca.")).toBeVisible();
};
const fold = (page: Page, title: string) => page.locator("summary", { hasText: title });
const row = (page: Page, label: string) => page.getByRole("switch", { name: `Mostrar «${label}»` });
/** Antes de salir con una recarga entera: que lo último que se hizo en el editor ya esté guardado. */
const saved = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

test.describe("Anamnesis de la clínica", () => {
  test("PL1 ocultar 3 y renombrar 2 en pocos toques; lo respondido se sigue viendo con su texto", async ({ page }) => {
    test.slow();
    // Una anamnesis con «Profesión» respondida, antes de ocultarla.
    await createPatient(page, { name: "Olga Oculta" });
    await tab(page, "Anamnesis").click();
    await ampliada(page);
    await page.locator("summary", { hasText: "Datos personales" }).click();
    await page.getByLabel("Profesión").fill("Carpintera");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();
    const patientUrl = page.url();

    await editor(page);
    await expect(fold(page, "Motivo de consulta")).toContainText("15 preguntas · 8 en la base · 8 al paciente");
    // Ocultar 3: tres interruptores.
    // «Profesión» es fija: avisa de lo que deja de funcionar y se oculta igualmente.
    await fold(page, "Datos personales").click();
    await row(page, "Profesión").click();
    const fixed = page.getByRole("dialog", { name: "¿Ocultar «Profesión»?" });
    await expect(fixed).toContainText("la redacción de la CIF no tendrá su profesión");
    await fixed.getByRole("button", { name: "Ocultar igualmente" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pregunta oculta" })).toBeVisible();
    await fold(page, "Hábitos y estilo de vida").click();
    await row(page, "Hábitos: tabaco / alcohol").click();
    await row(page, "Calidad del sueño").click();
    await expect(row(page, "Calidad del sueño")).toHaveAttribute("aria-checked", "false");
    // Otra fija: «Dejar» no la oculta.
    await fold(page, "Motivo de consulta").click();
    await row(page, "Motivo principal").click();
    const ask = page.getByRole("dialog", { name: "¿Ocultar «Motivo principal»?" });
    await expect(ask).toContainText("el nombre del motivo de consulta");
    await ask.getByRole("button", { name: "Dejar" }).click();
    await expect(row(page, "Motivo principal")).toHaveAttribute("aria-checked", "true");
    // Renombrar 2: tocar la fila, escribir, «Listo».
    await page.getByRole("button", { name: /^Motivo principal/ }).click();
    let sheet = page.getByRole("dialog", { name: "Pregunta" });
    await sheet.getByLabel("Pregunta", { exact: true }).fill("¿Qué le trae?");
    await expect(sheet.getByRole("region", { name: "Así se ve" })).toContainText("¿Qué le trae?");
    await sheet.getByRole("button", { name: "Listo" }).click();
    await page.getByRole("button", { name: /^Intensidad \(EVA 0-10\)/ }).click();
    sheet = page.getByRole("dialog", { name: "Pregunta" });
    await sheet.getByLabel("Pregunta", { exact: true }).fill("Dolor ahora (0-10)");
    await sheet.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("button", { name: /¿Qué le trae\?/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "Cambiada" })).toHaveCount(2);
    await expectAccessible(page);

    // En la ficha: los textos nuevos y lo oculto, con su texto, en «Respuestas a preguntas que ya no están».
    await saved(page);
    await page.goto(patientUrl);
    const otros = page.getByRole("region", { name: "Respuestas a preguntas que ya no están" });
    await expect(otros).toContainText("Profesión");
    await expect(otros).toContainText("Carpintera");
    await page.getByRole("button", { name: "Editar anamnesis" }).click();
    await expect(page.getByLabel("¿Qué le trae?")).toBeVisible();
    await expect(page.getByLabel("Profesión")).toHaveCount(0);
    // La plantilla no se cambia en la anamnesis del paciente (para no cambiarla sin querer): «Modificar» lleva a Ajustes.
    await expect(page.getByRole("link", { name: /plantilla/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Modificar/ })).toBeVisible();
  });

  test("PL2 añadir «Sí/No con detalle», deshacer, quitar y volver a la plantilla de OmniClin", async ({ page }) => {
    test.slow();
    await editor(page);
    await fold(page, "Antecedentes médicos personales").click();
    await page.locator("#plantilla-antecedentes").getByRole("button", { name: "Añadir pregunta" }).click();
    const add = page.getByRole("dialog", { name: "Nueva pregunta" });
    await add.getByRole("button", { name: "Sí/No con detalle" }).click();
    await add.getByLabel("Pregunta", { exact: true }).fill("¿Lleva marcapasos?");
    await add.getByLabel("Si contesta Sí, se le pregunta").fill("¿Desde cuándo?");
    // «Así se ve»: al marcar Sí aparece el detalle.
    const preview = add.getByRole("region", { name: "Así se ve" });
    await preview.getByText("Sí", { exact: true }).click();
    await expect(preview.getByLabel("¿Desde cuándo?")).toBeVisible();
    await add.getByRole("button", { name: "Añadir", exact: true }).click();
    const list = page.getByRole("list", { name: "Preguntas: Antecedentes médicos personales" });
    await expect(list).toContainText("¿Lleva marcapasos?");
    await expect(list).toContainText("Sí/No con detalle · Los dos · propia");

    // Ocultar y deshacer.
    await row(page, "¿Lleva marcapasos?").click();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(row(page, "¿Lleva marcapasos?")).toHaveAttribute("aria-checked", "true");

    // Contestarla en una ficha.
    await saved(page);
    await createPatient(page, { name: "Pablo Propia" });
    await tab(page, "Anamnesis").click();
    // «Antecedentes» se abre solo al entrar.
    const q = page.locator("fieldset", { hasText: "¿Lleva marcapasos?" });
    await q.getByText("Sí", { exact: true }).click();
    await page.getByLabel("¿Desde cuándo?").fill("2019");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Sí: 2019")).toBeVisible();
    const patientUrl = page.url();

    // Volver a la plantilla de OmniClin: la propia se retira, pero lo respondido se lee con su pregunta.
    await editor(page);
    await page.getByRole("button", { name: "Volver a la plantilla de OmniClin" }).click();
    const reset = page.getByRole("dialog", { name: "Volver a la plantilla de OmniClin" });
    await expect(reset).toContainText("Se quitarán tus cambios (1). Lo respondido por los pacientes no cambia.");
    await reset.getByRole("button", { name: "Sí, volver" }).click();
    await expect(page.getByRole("button", { name: "Volver a la plantilla de OmniClin" })).toHaveCount(0);
    await saved(page);
    await page.goto(patientUrl);
    const otros = page.getByRole("region", { name: "Respuestas a preguntas que ya no están" });
    await expect(otros).toContainText("¿Lleva marcapasos?");
    await expect(otros).toContainText("Sí: 2019");
  });

  test("PL3 en el móvil de 360 px: sin desbordes y zonas táctiles de 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await editor(page);
    await fold(page, "Motivo de consulta").click();
    await fold(page, "Hábitos y estilo de vida").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole("button", { name: /^Motivo principal/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectAccessible(page);
  });
});
