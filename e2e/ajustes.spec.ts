// Ajustes y ayuda (docs/rediseno-sencilla.md, bloque 7): buscador con otras palabras, cinco grupos que dicen cómo está
// cada cosa, la ayuda con buscador, el «?» de la barra y «Novedades» con su aviso de una vez.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("AJ1 ajustes: buscar con otras palabras, aviso de «sin PIN», ayuda con buscador, «?» y novedades", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./ajustes");
  // Sin PIN y sin clínica en el servidor: la fila lo dice.
  await expect(page.getByRole("region", { name: "Seguridad y datos", exact: true }).getByRole("link", { name: /Bloqueo con PIN.*quien coja este dispositivo/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);

  // Buscar: «tarifa» lleva a Precios y cobros; con algo escrito, solo lo que encaja.
  const find = page.getByLabel("Buscar en Ajustes");
  await find.fill("tarifa");
  const results = page.getByRole("region", { name: "Resultados", exact: true });
  await expect(results.getByRole("link", { name: "Precios y cobros" })).toHaveAttribute("href", /\/ajustes\/cobros$/);
  await expect(page.getByRole("region", { name: "Tu clínica", exact: true })).toBeHidden();
  await expectAccessible(page);
  await find.fill("zzzz");
  await expect(results).toContainText("Nada con ese nombre");
  await find.fill("");
  await expect(page.getByRole("region", { name: "Tu clínica", exact: true })).toBeVisible();

  // El «?» de la barra lleva a «Cómo se usa»; allí se busca dentro.
  await page.getByRole("link", { name: "Cómo se usa esta pantalla" }).click();
  await expect(page.getByRole("heading", { name: "Cómo se usa" })).toBeVisible();
  const steps = page.getByRole("list", { name: "Pasos" }).getByRole("listitem");
  await page.getByLabel("Buscar en la ayuda").fill("bono");
  await expect(page.getByRole("status").filter({ hasText: /apartados? lo explican?\./ })).toBeVisible();
  await expect(steps.filter({ hasText: "Bonos, cobros" })).toBeVisible();
  await expect(steps.filter({ hasText: "Consentimientos" })).toBeHidden();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // Novedades: la página, desde la ayuda.
  await page.getByRole("link", { name: /Novedades: lo que ha cambiado de sitio/ }).click();
  await expect(page.getByRole("list", { name: "Novedades" }).getByRole("listitem").first()).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
});

test("AJ2 novedades: quien ya tenía pacientes ve el aviso una vez; quien estrena la app, no", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  // Al estrenarla (sin pacientes) no hay aviso.
  await page.goto("./ajustes");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByRole("note", { name: "Novedades" })).toHaveCount(0);

  // Con pacientes y sin haberlas visto (como tras actualizar): sale el aviso en las pantallas principales.
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Nora Novedad");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Nora Novedad" })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("omniclin.novedades"));
  await page.goto("./ajustes");
  const note = page.getByRole("note", { name: "Novedades" });
  await expect(note).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await note.getByRole("link", { name: "Ver las novedades" }).click();
  await expect(page.getByRole("heading", { name: "Novedades" })).toBeVisible();
  // Una vez vistas, no vuelve.
  await page.goto("./ajustes");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(note).toHaveCount(0);
});
