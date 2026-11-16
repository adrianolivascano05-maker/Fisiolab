// El Resumen de la ficha como tablero (docs/rediseno-sencilla.md, bloque 9): «Lo siguiente» arriba, cuatro cifras que
// se tocan y Documentos y Legal plegados en una fila cada uno.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("RS1 resumen: «Lo siguiente», las cuatro cifras y Documentos y Legal plegados que se abren y se recuerdan", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Rita Resumen");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Rita Resumen" })).toBeVisible();
  const record = page.url();

  // Lo siguiente: lo pendiente más importante (aquí, la hoja de protección de datos), con su enlace.
  const next = page.getByRole("region", { name: "Lo siguiente" });
  await expect(next.getByRole("link", { name: /Hoja de protección de datos sin entregar/ })).toHaveAttribute("href", /\/proteccion-datos$/);
  // Las cifras, vacías todavía.
  const tiles = page.getByRole("list", { name: "En cifras" });
  await expect(tiles.getByRole("link", { name: /^Dolor/ })).toContainText("Sin apuntar");
  await expect(tiles.getByRole("link", { name: /^Sesiones/ })).toContainText("Ninguna todavía");
  await expect(tiles.getByRole("link", { name: /^Bonos y cobros/ })).toHaveAttribute("href", /\/cobros$/);
  // Documentos y Legal, plegados: dicen lo que hay y se abren al tocarlos.
  const docs = page.getByRole("region", { name: "Documentos", exact: true });
  await expect(docs.getByRole("button", { name: /^Documentos/ })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: /^Informe de alta/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Legal", exact: true })).toContainText("protección de datos sin entregar");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await docs.getByRole("button", { name: /^Documentos/ }).click();
  await expect(docs.getByRole("link", { name: /^Informe de alta/ })).toBeVisible();
  await expect(docs.getByRole("link", { name: /^Justificante de asistencia/ })).toBeVisible();

  // Con una sesión y su dolor, las cifras lo dicen y llevan a Sesiones.
  await page.goto(`${record}/sesiones/nueva`);
  await page.locator("fieldset", { hasText: "Dolor hoy" }).getByText("6", { exact: true }).click();
  await page.getByLabel("Tratamiento", { exact: true }).fill("Terapia manual");
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" }).first()).toBeVisible();
  await page.goto(record);
  await expect(tiles.getByRole("link", { name: /^Dolor/ })).toContainText("6/10");
  await expect(tiles.getByRole("link", { name: /^Sesiones/ })).toContainText("1");
  // Lo abierto se recuerda mientras la app está abierta.
  await expect(docs.getByRole("link", { name: /^Informe de alta/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await tiles.getByRole("link", { name: /^Dolor/ }).click();
  await expect(page.getByRole("heading", { name: "Sesiones", exact: true })).toBeVisible();
});
