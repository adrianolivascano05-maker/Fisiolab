// Apuntar una sesión (docs/rediseno-sencilla.md, bloque 5): el dolor con su escala de color y el de la última vez,
// «Igual que la última» en cada cuadro, la siguiente cita dicha antes de guardar, el borrador y «Guardar» fijo abajo.
import { ampliada, expect, expectAccessible, smallTargets, test } from "./fixtures";

test("SE1 sesión: dolor de la última vez, «Igual que la última», borrador al recargar, la siguiente cita y «Guardar» siempre a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Selma Sesión");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Selma Sesión" })).toBeVisible();
  const record = page.url();

  // Primera sesión: dolor 4 y un tratamiento.
  await page.goto(`${record}/sesiones/nueva`);
  const pain = page.locator("fieldset", { hasText: "Dolor hoy" });
  await pain.getByText("4", { exact: true }).click();
  await page.getByLabel("Tratamiento", { exact: true }).fill("Movilización lumbar y puente glúteo 3x12");
  // «Guardar» está a la vista sin bajar.
  const save = page.getByRole("button", { name: "Guardar sesión" });
  await expect(save).toBeInViewport();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await save.click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" })).toBeVisible();

  // Segunda: dice el dolor de la última vez y copia su propio tratamiento con un toque.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByText("La última vez, 4 (con borde dorado).")).toBeVisible();
  await page.getByRole("button", { name: "Igual que la última: Tratamiento" }).click();
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Movilización lumbar y puente glúteo 3x12");
  await page.getByLabel("Qué refiere").fill("Mejor al caminar");
  await expect(page.getByText(/^Borrador guardado en este dispositivo · /)).toBeVisible();
  // Se sale a mitad (aquí, recargar): lo escrito sigue.
  await page.reload();
  await expect(page.getByLabel("Qué refiere")).toHaveValue("Mejor al caminar");
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Movilización lumbar y puente glúteo 3x12");

  // La siguiente cita se dice antes de guardar.
  await page.getByRole("button", { name: "Cita en 1 semana" }).click();
  await expect(page.getByText(/^La siguiente cita: /)).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  // Abajo del todo, la barra de «Guardar» no tapa nada (a media página tapa lo que pasa por debajo, como toda barra fija).
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 2" })).toBeVisible();

  // Guardada: el borrador se ha ido.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByLabel("Qué refiere")).toHaveValue("");
  await expect(page.getByText(/^Borrador guardado/)).toHaveCount(0);
});

test("SE2 la escala EVA en una sola fila: once números de al menos 24 px de ancho y 44 de alto (sesión a 320 px; anamnesis, dos filas a 320 y una a 360)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Eva Fila");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Eva Fila" })).toBeVisible();
  const record = page.url();
  const measure = async (legend: RegExp, rows = 1) => {
    const spans = page.locator("fieldset", { has: page.locator("legend", { hasText: legend }) }).first().locator("label > span");
    await expect(spans).toHaveCount(11);
    const boxes = await spans.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: Math.round(r.y), w: r.width, h: r.height })));
    expect(boxes).toHaveLength(11);
    expect(new Set(boxes.map((b) => b.y)).size).toBe(rows);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(24);
      expect(b.h).toBeGreaterThanOrEqual(44);
    }
  };
  await page.goto(`${record}/sesiones/nueva`);
  await measure(/^Dolor hoy/);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 320);
  expect(await smallTargets(page)).toEqual([]);
  // En la anamnesis va dentro de una caja: a 320 px no caben once de 24 px y pasa a dos filas; a 360, en una.
  await page.goto(`${record}/anamnesis`);
  await ampliada(page);
  await measure(/^Intensidad \(EVA/, 2);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 320);
  await page.setViewportSize({ width: 360, height: 720 });
  await measure(/^Intensidad \(EVA/);
});
