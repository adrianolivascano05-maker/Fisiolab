// Organizar el tratamiento por ciclos (docs/ciclos.md, fase A): crear el plan, poner los ejercicios de la semana 1,
// rellenar la progresión y, en una sesión, «Todo hecho como estaba», que escribe solo el texto de Tratamiento.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("CI1 crear un plan por ciclos con ejercicios, rellenar la progresión y apuntar una sesión con «Todo hecho como estaba»", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Lucía Ciclos");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Lucía Ciclos" })).toBeVisible();
  const record = page.url();

  // Sin plan, la sesión solo enseña el botón discreto bajo Tratamiento.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByRole("region", { name: "Tratamiento · hoy toca" })).toHaveCount(0);
  await page.getByRole("link", { name: /Organizar por ciclos/ }).click();

  // Crear: el macrociclo, cuatro fases y las semanas.
  await expect(page.getByRole("heading", { name: "Organizar por ciclos" })).toBeVisible();
  await page.getByLabel("Objetivo general").fill("Volver a jugar al fútbol sin dolor");
  await expect(page.getByText(/^20 semanas · del /)).toBeVisible();
  const fases = page.getByRole("list", { name: "Fases" });
  await expect(fases.getByRole("listitem")).toHaveCount(4);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Siguiente: ejercicios de la semana 1" }).click();

  // La semana 1: dos ejercicios escritos a mano, con sus casillas.
  await expect(page.getByRole("heading", { name: "Semana 1 · Adaptación" })).toBeVisible();
  await page.getByLabel("Objetivo de la fase").fill("Bajar la inflamación");
  const add = async (name: string, values: string[]) => {
    await page.getByLabel("Añadir un ejercicio").fill(name);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const card = page.getByRole("list", { name: /^Ejercicios de la sesión A/ }).getByRole("listitem").filter({ has: page.locator(`input[value="${name}"]`) });
    const inputs = card.locator('input[inputmode="decimal"]');
    for (const [i, v] of values.entries()) await inputs.nth(i).fill(v);
  };
  await add("Sentadilla a cajón", ["3", "10", "", "5"]);
  await add("Prensa bilateral", ["3", "10", "40", "6"]);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Siguiente: cómo progresa" }).click();

  // Cómo progresa: +1 rep para la sentadilla, +5 kg para la prensa; la vista previa y rellenar.
  await expect(page.getByRole("heading", { name: "Cómo progresa" })).toBeVisible();
  await page.getByLabel("Cómo progresa Sentadilla a cajón").selectOption("rep1");
  await page.getByLabel("Cómo progresa Prensa bilateral").selectOption("kg5");
  const preview = page.getByRole("table", { name: /^Vista previa/ });
  await expect(preview.getByRole("row", { name: /Prensa bilateral/ })).toContainText("45 kg");
  // La semana 4 es de descarga: una serie menos y un 40 % menos de carga.
  await expect(preview.getByRole("row", { name: /Prensa bilateral/ })).toContainText("2×1030 kg");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Rellenar las 4 semanas" }).click();

  // El plan: el objetivo y la fase de hoy con su tabla.
  await expect(page.getByRole("heading", { name: "Plan por ciclos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Volver a jugar al fútbol sin dolor" })).toBeVisible();
  await expect(page.getByRole("table", { name: /^1 · Adaptación/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // La sesión de hoy: la línea del plan y lo que toca; «Todo hecho como estaba» escribe Tratamiento.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByRole("link", { name: /Fase 1 · Adaptación · semana 1 de 4/ })).toBeVisible();
  const today = page.getByRole("region", { name: "Tratamiento · hoy toca" });
  await expect(today).toBeVisible();
  await today.getByRole("button", { name: "Todo hecho como estaba" }).click();
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Sentadilla a cajón 3 × 10 (RPE 5). Prensa bilateral 3 × 10 con 40 kg (RPE 6).");
  // Lo real distinto de lo previsto: el esfuerzo notado.
  await today.getByRole("button", { name: /^Prensa bilateral/ }).click();
  await today.getByRole("group", { name: "Esfuerzo de Prensa bilateral" }).getByRole("button", { name: "8" }).click();
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Sentadilla a cajón 3 × 10 (RPE 5). Prensa bilateral 3 × 10 con 40 kg (RPE 8).");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" }).first()).toContainText("Prensa bilateral 3 × 10 con 40 kg (RPE 8).");
  // En Sesiones, la tarjeta del plan lleva a él.
  await expect(page.getByRole("link", { name: /Plan por ciclos: Volver a jugar/ })).toBeVisible();
});
