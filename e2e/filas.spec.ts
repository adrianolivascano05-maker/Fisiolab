// Listas largas con filas que se abren (docs/rediseno-sencilla.md, bloque 6): con pocas, todo a la vista; con más,
// la última sesión abierta y las demás en una línea, «Abrir todas», buscar dentro y los cobros por mes con su total.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("FL1 sesiones y cobros: con muchas, filas que se abren, «Abrir todas», buscar dentro y el total del mes", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Lía Lista");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Lía Lista" })).toBeVisible();
  const record = page.url();

  const what = ["Movilización lumbar", "Puente glúteo 3x12", "Punción seca", "Estiramiento de isquios", "Control motor en cuadrupedia"];
  for (const [i, t] of what.entries()) {
    await page.goto(`${record}/sesiones/nueva`);
    await page.getByLabel("Tratamiento", { exact: true }).fill(t);
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `Sesión ${i + 1}` }).first()).toBeVisible();
    // Hasta tres, todas abiertas y sin buscador.
    if (i === 2) {
      await expect(page.getByText("Tratamiento", { exact: true })).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Abrir todas" })).toHaveCount(0);
    }
  }

  // Con cinco: solo la última abierta; las demás dicen su primera frase en una línea.
  const list = page.getByRole("list", { name: "Sesiones" });
  await expect(list.getByText("Tratamiento", { exact: true })).toHaveCount(1);
  await expect(list.getByRole("button", { name: /Sesión 5/ })).toHaveAttribute("aria-expanded", "true");
  await expect(list.getByRole("button", { name: /Sesión 1/ })).toHaveAttribute("aria-expanded", "false");
  await expect(list.getByText("Movilización lumbar")).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // Una fila se abre al tocarla; «Abrir todas» y «Cerrar todas».
  await list.getByRole("button", { name: /Sesión 2/ }).click();
  await expect(list.getByText("Tratamiento", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Abrir todas" }).click();
  await expect(list.getByText("Tratamiento", { exact: true })).toHaveCount(5);
  await page.getByRole("button", { name: "Cerrar todas" }).click();
  await expect(list.getByText("Tratamiento", { exact: true })).toHaveCount(1);

  // Buscar dentro: quedan las que lo dicen, abiertas (sin tildes ni mayúsculas).
  await page.getByLabel("Buscar en las sesiones").fill("puncion");
  await expect(page.getByText("1 sesión lo dice.")).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: "Sesión 3" })).toContainText("Punción seca");
  await expect(list.getByRole("button", { name: /Sesión 5/ })).toHaveCount(0);
  // Editar sigue a un toque en cada fila.
  await page.getByLabel("Buscar en las sesiones").fill("");
  await expect(list.getByRole("link", { name: "Editar la sesión 1" })).toBeVisible();

  // Cobros: con cuatro, cada fila se abre (Recibo, nº de factura, Borrar) y el mes dice su total.
  await page.goto(`${record}/cobros`);
  for (const amount of ["10", "20", "30", "40"]) {
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar" });
    await pay.getByLabel("Cantidad").fill(amount);
    await pay.getByText("Efectivo").click();
    await pay.getByRole("button", { name: "Guardar el cobro" }).click();
    await expect(pay).toBeHidden();
  }
  const pays = page.getByRole("list", { name: "Cobros" });
  await expect(pays.getByRole("listitem")).toHaveCount(4);
  await expect(pays.getByRole("listitem").first()).toContainText("100,00");
  await expect(pays.getByRole("link", { name: /Recibo del cobro/ })).toHaveCount(0);
  await pays.getByRole("button", { name: /40,00/ }).click();
  await expect(pays.getByRole("link", { name: /Recibo del cobro de 40,00/ })).toBeVisible();
  await expect(pays.getByRole("button", { name: /Borrar el cobro de 40,00/ })).toBeVisible();
  await expect(pays.getByRole("button", { name: /Apuntar nº de factura del cobro de 40,00/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
});
