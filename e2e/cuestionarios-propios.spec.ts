// Cuestionarios propios de la clínica (docs/cuestionarios-propios.md): crearlo, la etiqueta fija, pasarlo en consulta,
// verlo en la ficha y en la Biblioteca, y archivarlo sin perder lo respondido; la Biblioteca de OmniClin (añadir,
// varias a la vez, «Prefiero no responder», el detalle del «Sí» y las líneas por pregunta). En el móvil, sin desbordes.
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
  await second.getByRole("button", { name: "Opciones", exact: true }).click();
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
    // El editor con sus opciones: todo de 44 px y sin desbordes.
    await expect(page.getByLabel("Opción 4", { exact: true })).toHaveValue("Siempre");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
    // Salir con cambios sin guardar avisa.
    await page.getByLabel("Nombre").fill("Control semanal (cambiado)");
    await page.getByRole("link", { name: /Volver/ }).click();
    const warn = page.getByRole("dialog", { name: "Tienes cambios sin guardar" });
    await expect(warn).toBeVisible();
    await warn.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByRole("region", { name: "Cuestionarios de la clínica" })).toContainText("Control semanal de prueba");
    await expectAccessible(page);
  });

  test("CP3 Biblioteca de OmniClin en 360 px: añadir, cambiarlo, pasarlo y ver una línea por pregunta", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("./ajustes/cuestionarios-propios");
    const library = page.getByRole("list", { name: "Biblioteca de OmniClin" });
    await expect(library.getByRole("listitem")).toHaveCount(4);
    await expect(library).toContainText("Satisfacción con el tratamiento");
    await expect(library).toContainText("Vuelta al deporte: lista de comprobación");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);

    // Verlo antes de añadirlo: la nota para el profesional y cómo lo verá el paciente.
    await library.getByRole("button", { name: /^Control semanal/ }).click();
    const peek = page.getByRole("dialog", { name: "Control semanal" });
    await expect(peek).toContainText("Sin nota global a propósito");
    await expect(peek.getByRole("checkbox", { name: "Prefiero no responder: 5. ¿Cómo ha estado tu ánimo?" })).toBeAttached();
    await expect(peek.getByText("Prefiero no responder", { exact: true })).toBeVisible();
    await peek.getByRole("group", { name: /episodio nuevo/ }).getByText("Sí", { exact: true }).click();
    await expect(peek.getByLabel("Cuéntanos qué")).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await peek.getByRole("button", { name: "Añadir a mis cuestionarios" }).click();
    await expect(page.getByText("«Control semanal» añadido: ya es de tu clínica")).toBeVisible();
    await expect(page.getByRole("region", { name: "Cuestionarios de la clínica" })).toContainText("6 preguntas · sin nota");
    await expect(library).toContainText("ya lo tienes");
    await page.getByRole("button", { name: "Añadir «Adherencia a los ejercicios»" }).click();
    await expect(page.getByRole("region", { name: "Cuestionarios de la clínica" })).toContainText("Adherencia a los ejercicios");

    // En el editor, cada pregunta con lo suyo; se puede cambiar como cualquier otro.
    await page.getByRole("link", { name: /^Control semanal/ }).click();
    const first = page.getByRole("group", { name: "Editar la pregunta 1" });
    await expect(first.getByLabel("Verla en la evolución con su línea")).toBeChecked();
    await expect(first.getByRole("button", { name: "Menos es mejor" })).toHaveAttribute("aria-pressed", "true");
    await expect(first.getByLabel("Cuenta en la nota")).toBeChecked();
    await expect(page.getByRole("group", { name: "Editar la pregunta 5" }).getByRole("button", { name: "«Prefiero no responder»" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Editar la pregunta 6" }).getByLabel("Si contesta «Sí», se le pregunta (opcional)")).toHaveValue("Cuéntanos qué");
    await page.getByLabel("Pregunta 1", { exact: true }).fill("Dolor medio de la semana");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cuestionario guardado")).toBeVisible();

    // Adherencia: la de varias se marca y no suma; la nota solo con las dos primeras.
    const record = await createPatient(page, { name: "Olga Semanal" });
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByRole("region", { name: "De la clínica" }).getByRole("button", { name: /Adherencia a los ejercicios/ }).click();
    await page.getByRole("group", { name: /¿Cuántos días/ }).getByText("3-4 días", { exact: true }).click();
    await page.getByRole("group", { name: /cuánto del plan/ }).getByText("Todo", { exact: true }).click();
    const hard = page.getByRole("group", { name: /¿Qué te lo puso difícil/ });
    await expect(hard).toContainText("Puedes marcar varias.");
    await hard.getByText("Falta de tiempo", { exact: true }).click();
    await hard.getByText("No me acordaba", { exact: true }).click();
    await expect(page.getByLabel("Nota: 5/7")).toBeVisible();
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByText("Cuestionario registrado")).toBeVisible();

    // Control semanal, dos semanas: sin nota, con una línea por pregunta.
    const week = async (pain: string, worst: string, other: "Sí" | "No") => {
      await page.goto(`${record}/cuestionarios/nuevo`);
      await page.getByRole("region", { name: "De la clínica" }).getByRole("button", { name: /Control semanal/ }).click();
      await page.getByRole("group", { name: /Dolor medio de la semana/ }).getByText(pain, { exact: true }).click();
      await page.getByRole("group", { name: /Peor momento de dolor/ }).getByText(worst, { exact: true }).click();
      await page.getByText("Prefiero no responder", { exact: true }).click();
      await page.getByRole("group", { name: /episodio nuevo/ }).getByText(other, { exact: true }).click();
      if (other === "Sí") await page.getByLabel("Cuéntanos qué").fill("Un pinchazo nuevo en la rodilla");
      await page.getByRole("button", { name: "Guardar cuestionario" }).click();
      await expect(page.getByText("Cuestionario registrado")).toBeVisible();
    };
    await week("7", "8", "No");
    await week("4", "6", "Sí");
    const lines = page.getByRole("list", { name: /Pregunta a pregunta: Control semanal/ });
    await expect(lines.getByRole("listitem")).toHaveCount(6);
    await expect(lines).toContainText("Dolor medio de la semana");
    await expect(lines).toContainText("4 · menos es mejor");
    await expect(lines).toContainText("Prefiero no responder · más es mejor");
    await expect(lines).toContainText("Sí: Un pinchazo nuevo en la rodilla");
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("Sin nota");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Lo escrito se ve al abrirlo.
    await lines.click();
    await expect(page.getByLabel("Cuéntanos qué")).toHaveValue("Un pinchazo nuevo en la rodilla");
    await expectAccessible(page);
  });
});
