// Fase 2 de la anamnesis adaptable (docs/anamnesis-adaptable.md): varias plantillas, módulos de OmniClin y de la
// clínica, condicionales, obligatorias, destacar y «Volver a la versión de OmniClin». En el móvil, sin desbordes.
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";

test.describe("Plantillas y módulos de la anamnesis", () => {
  test("MD1 una plantilla con un módulo de OmniClin: destacar, condicional, un motivo con ella y volver a la versión de OmniClin", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("./ajustes/anamnesis");
    await expect(page.getByText("Lo que cambies lo ve todo el equipo. Lo ya respondido no se toca.")).toBeVisible();
    // Con una sola plantilla no hay chips: solo «Nueva plantilla» y «⋯».
    const bar = page.getByRole("group", { name: "Plantillas" });
    await expect(bar.getByRole("button", { name: "General", exact: true })).toHaveCount(0);
    await bar.getByRole("button", { name: "Nueva plantilla" }).click();
    const nueva = page.getByRole("dialog", { name: "Nueva plantilla" });
    await nueva.getByLabel("Nombre", { exact: true }).fill("Suelo pélvico");
    await nueva.getByRole("switch", { name: "Suelo pélvico" }).click();
    await nueva.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByText("Plantilla «Suelo pélvico» creada")).toBeVisible();
    await expect(bar.getByRole("button", { name: "Suelo pélvico", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(bar.getByRole("button", { name: "General", exact: true })).toHaveAttribute("aria-pressed", "false");

    // El módulo, en su apartado propio; destacar «Al esfuerzo» en «Escapes de orina».
    const modulo = page.locator("#plantilla-m_suelo_pelvico");
    await expect(modulo.locator("summary")).toContainText("Módulo de OmniClin");
    await modulo.locator("summary").click();
    await modulo.getByRole("button", { name: /^Escapes de orina/ }).click();
    let sheet = page.getByRole("dialog", { name: "Pregunta" });
    await expect(sheet).toContainText("Del módulo «Suelo pélvico»");
    await sheet.getByRole("group", { name: "Destacar en la ficha estas respuestas" }).getByRole("button", { name: "Al esfuerzo" }).click();
    await sheet.getByRole("button", { name: "Listo" }).click();
    await expect(modulo.getByRole("list")).toContainText("destaca");

    // Una pregunta nueva en el módulo, que solo se ve si hay escapes al esfuerzo.
    await modulo.getByRole("button", { name: "Añadir pregunta" }).click();
    const add = page.getByRole("dialog", { name: "Nueva pregunta" });
    await add.getByLabel("Pregunta", { exact: true }).fill("¿Desde cuándo?");
    await add.locator("form > button[type=submit]").click();
    await expect(page.getByText("Pregunta añadida al módulo")).toBeVisible();
    await modulo.getByRole("button", { name: /^¿Desde cuándo\?/ }).click();
    sheet = page.getByRole("dialog", { name: "Pregunta" });
    await sheet.getByRole("group", { name: "Depende de" }).getByRole("button", { name: "Escapes de orina" }).click();
    const cuando = sheet.getByRole("group", { name: "Se ve si contesta" });
    await cuando.getByRole("button", { name: "Al esfuerzo" }).click();
    await cuando.getByRole("button", { name: "No", exact: true }).click();
    await expect(cuando.getByRole("button", { name: "Al esfuerzo" })).toHaveAttribute("aria-pressed", "true");
    await expect(cuando.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await sheet.getByRole("button", { name: "Listo" }).click();
    await expect(modulo.getByRole("list")).toContainText("con condición");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    // Un motivo de consulta con la plantilla «Suelo pélvico».
    await createPatient(page, { name: "Rocío Pélvico" });
    await page.getByRole("button", { name: /Motivo:/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: "Nuevo motivo de consulta" }).click();
    const motivo = page.getByRole("dialog", { name: "Nuevo motivo de consulta" });
    await motivo.getByLabel("¿Por qué viene ahora?").fill("Escapes de orina");
    await motivo.getByRole("group", { name: "Plantilla de anamnesis" }).getByRole("button", { name: "Suelo pélvico" }).click();
    await motivo.getByRole("button", { name: "Crear y rellenar su anamnesis" }).click();
    await expect(page.getByLabel("Motivo principal")).toHaveValue("Escapes de orina");
    // En la base (como se abre), el apartado del módulo es un bloque más, a la vista.
    const apartado = page.locator("#anamnesis-m_suelo_pelvico");
    await expect(apartado.getByRole("heading", { name: "Suelo pélvico" })).toBeVisible();
    await expect(page.getByLabel("¿Desde cuándo?")).toHaveCount(0);
    await apartado.getByRole("group", { name: "Escapes de orina" }).getByText("Al esfuerzo", { exact: true }).click();
    await page.getByLabel("¿Desde cuándo?").fill("Dos años, tras el segundo parto");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();
    const destacado = page.getByRole("region", { name: "Destacado" });
    await expect(destacado).toContainText("Escapes de orina: Al esfuerzo");
    await expect(destacado).toContainText("Destacado según la configuración de tu clínica.");
    await expect(page.getByRole("region", { name: /Banderas rojas/ })).toHaveCount(0);
    const anamnesisUrl = page.url();

    // Volver a la versión de OmniClin: su pregunta se retira, pero lo respondido se sigue leyendo con su texto.
    await page.goto("./ajustes/anamnesis");
    await page.getByRole("group", { name: "Plantillas" }).getByRole("button", { name: "Suelo pélvico", exact: true }).click();
    await page.getByRole("list", { name: "Módulos de esta plantilla" }).getByRole("button", { name: "Volver a la versión de OmniClin" }).click();
    await expect(page.getByText("«Suelo pélvico»: versión de OmniClin")).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.goto(anamnesisUrl);
    await expect(page.getByRole("region", { name: "Respuestas a preguntas que ya no están" })).toContainText("¿Desde cuándo?");
    await expect(page.getByRole("region", { name: "Respuestas a preguntas que ya no están" })).toContainText("Dos años, tras el segundo parto");
    await expect(page.getByRole("region", { name: "Destacado" })).toHaveCount(0);
  });

  test("MD2 la de por defecto, archivar sin perder nada y apartados nuevos", async ({ page }) => {
    await page.goto("./ajustes/anamnesis");
    const bar = page.getByRole("group", { name: "Plantillas" });
    await bar.getByRole("button", { name: "Nueva plantilla" }).click();
    const nueva = page.getByRole("dialog", { name: "Nueva plantilla" });
    await nueva.getByLabel("Nombre", { exact: true }).fill("Deportiva");
    await nueva.getByRole("button", { name: "Crear" }).click();
    await expect(bar.getByRole("button", { name: "Deportiva", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Un apartado nuevo, con su pregunta.
    await page.getByRole("button", { name: "Añadir apartado" }).click();
    await page.getByRole("dialog", { name: "Nuevo apartado" }).getByLabel("Nombre del apartado").fill("Temporada");
    await page.getByRole("dialog", { name: "Nuevo apartado" }).getByRole("button", { name: "Añadir apartado" }).click();
    const temporada = page.locator("details", { has: page.locator("summary", { hasText: "Temporada" }) });
    await expect(temporada.locator("summary")).toContainText("Apartado de la clínica");
    await temporada.locator("summary").click();
    await temporada.getByRole("button", { name: "Añadir pregunta" }).click();
    const add = page.getByRole("dialog", { name: "Nueva pregunta" });
    await add.getByRole("button", { name: "Número" }).click();
    await add.getByLabel("Pregunta", { exact: true }).fill("Entrenamientos por semana");
    await add.getByRole("group", { name: "Unidad" }).getByRole("button", { name: "veces" }).click();
    await add.locator("form > button[type=submit]").click();
    await expect(temporada.getByRole("list")).toContainText("Entrenamientos por semana");
    // Usarla por defecto: ya no se puede archivar; con «General» por defecto, sí.
    await page.getByRole("button", { name: "Más opciones de la plantilla «Deportiva»" }).click();
    let menu = page.getByRole("dialog", { name: "Plantilla «Deportiva»" });
    await menu.getByRole("button", { name: "Usar por defecto" }).click();
    await expect(page.getByText("«Deportiva» sale ahora por defecto")).toBeVisible();
    await page.getByRole("button", { name: "Más opciones de la plantilla «Deportiva»" }).click();
    menu = page.getByRole("dialog", { name: "Plantilla «Deportiva»" });
    await expect(menu.getByRole("button", { name: "Archivar" })).toHaveCount(0);
    await menu.getByRole("button", { name: "Cerrar" }).click();
    await bar.getByRole("button", { name: "General", exact: true }).click();
    await page.getByRole("button", { name: "Más opciones de la plantilla «General»" }).click();
    await page.getByRole("dialog", { name: "Plantilla «General»" }).getByRole("button", { name: "Usar por defecto" }).click();
    await bar.getByRole("button", { name: "Deportiva", exact: true }).click();
    await page.getByRole("button", { name: "Más opciones de la plantilla «Deportiva»" }).click();
    await page.getByRole("dialog", { name: "Plantilla «Deportiva»" }).getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByText("«Deportiva» archivada")).toBeVisible();
    // Archivada: sin chips (solo queda una) y se puede volver a usar.
    await expect(bar.getByRole("button", { name: "Deportiva", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Más opciones de la plantilla «General»" }).click();
    const archivadas = page.getByRole("region", { name: "Plantillas archivadas" });
    await expect(archivadas).toContainText("Deportiva");
    await archivadas.getByRole("button", { name: "Volver a usarla" }).click();
    await expect(bar.getByRole("button", { name: "Deportiva", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("details", { has: page.locator("summary", { hasText: "Temporada" }) })).toBeVisible();
  });
});
