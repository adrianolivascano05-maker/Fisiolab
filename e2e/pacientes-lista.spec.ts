// La lista de pacientes (docs/rediseno-sencilla.md, bloque 8): filtros de un toque con cuántos hay, y en cada fila por
// qué viene, cuántas sesiones lleva y lo más urgente en una etiqueta.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("PL1 pacientes: filtros rápidos con número y cada fila con sus sesiones y su etiqueta", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const name of ["Alba Lista", "Bruno Lista"]) {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  // A Bruno, una sesión con siguiente cita en una semana.
  await page.goto(`${page.url()}/sesiones/nueva`);
  await page.getByLabel("Tratamiento", { exact: true }).fill("Terapia manual");
  await page.getByRole("button", { name: "Cita en 1 semana" }).click();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" }).first()).toBeVisible();

  await page.goto("./");
  const quick = page.getByRole("group", { name: "Ver" });
  await expect(quick.getByRole("button", { name: "Todos 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(quick.getByRole("button", { name: "Sin cita 1" })).toBeVisible();
  await expect(quick.getByRole("button", { name: "Hoy 0" })).toBeVisible();
  await expect(quick.getByRole("button", { name: "Deben 0" })).toBeVisible();
  // Cada fila: las sesiones que lleva y su etiqueta (sin cita, o su próxima cita).
  await expect(page.getByRole("link", { name: /Alba Lista.*Sin visitas todavía.*Sin cita/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bruno Lista.*1 sesión/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bruno Lista/ })).not.toContainText("Sin cita");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // «Sin cita» deja solo a Alba; «Todos» vuelve a los dos.
  await quick.getByRole("button", { name: "Sin cita 1" }).click();
  await expect(page.getByRole("link", { name: /Alba Lista/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bruno Lista/ })).toHaveCount(0);
  await quick.getByRole("button", { name: "Hoy 0" }).click();
  await expect(page.getByText("Ningún paciente con estos filtros.")).toBeVisible();
  await quick.getByRole("button", { name: "Todos 2" }).click();
  await expect(page.getByRole("link", { name: /Bruno Lista/ })).toBeVisible();
});
