// Facturas (src/data/invoices.ts): desde un cobro del paciente, en blanco (para una mutua), anular con una
// rectificativa y el libro para la gestoría. Numeración por serie y año; una factura emitida no se cambia.
import { readFileSync } from "node:fs";
import { expect, expectAccessible, test } from "./fixtures";

test.describe("Facturas", () => {
  // Un martes a las 10:00 en Madrid.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("FA1 sin los datos de la clínica no se puede facturar; avisa de qué falta", async ({ page }) => {
    await page.goto("./facturas/nueva");
    await expect(page.getByText("Faltan los datos de la clínica")).toBeVisible();
    await page.getByLabel("Nombre o razón social").fill("Mutua Ejemplo");
    await page.getByLabel("Precio sin IVA (€)").fill("30");
    await page.getByRole("button", { name: "Revisar y emitir" }).click();
    await expect(page.getByText(/Faltan el nombre o el NIF de la clínica/)).toBeVisible();
    await expectAccessible(page);
  });

  test("FA2 factura de un cobro, otra en blanco con IVA, rectificativa y libro de facturas", async ({ page }) => {
    await page.goto("./ajustes/clinica");
    await page.getByLabel("Clínica (nombre o razón social)").fill("Fisiolab Centro");
    await page.getByLabel("NIF").fill("B12345678");
    await page.getByLabel("Dirección").fill("Calle Mayor 1, Sevilla");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText(/guardad/i).first()).toBeVisible();

    // Un paciente con su DNI y un cobro.
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Ana Factura");
    await page.getByLabel("DNI o NIE").fill("12345678Z");
    await page.getByLabel("Dirección").fill("Calle Sol 3, Sevilla");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Ana Factura" })).toBeVisible();
    await page.goto(`${page.url()}/cobros`);
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar" });
    await pay.getByLabel("Cantidad").fill("45");
    await pay.getByText("Tarjeta").click();
    await pay.getByRole("button", { name: "Guardar el cobro" }).click();
    await expect(page.getByRole("status")).toHaveText(/45,00/);

    // La factura del cobro: ya viene escrita.
    await page.getByRole("link", { name: /Hacer la factura del cobro de 45,00/ }).click();
    await expect(page.getByRole("heading", { name: "Nueva factura" })).toBeVisible();
    await expect(page.getByLabel("Nombre o razón social")).toHaveValue("Ana Factura");
    await expect(page.getByLabel("NIF, DNI o NIE")).toHaveValue("12345678Z");
    await expect(page.getByLabel("Precio sin IVA (€)")).toHaveValue("45");
    await expect(page.getByRole("definition").last()).toHaveText(/45,00/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Revisar y emitir" }).click();
    const confirm = page.getByRole("dialog", { name: "¿Emitir la factura?" });
    await expect(confirm).toContainText("no se puede cambiar ni borrar");
    await confirm.getByRole("button", { name: "Emitir la factura" }).click();
    await expect(page.getByText("Factura A2026-0001 emitida")).toBeVisible();
    const first = page.getByRole("article", { name: "Factura A2026-0001" });
    await expect(first).toContainText("Fisiolab Centro");
    await expect(first).toContainText("NIF B12345678");
    await expect(first).toContainText("Ana Factura");
    await expect(first).toContainText("NIF 12345678Z");
    await expect(first).toContainText(/Total\s*45,00/);
    await expect(first).toContainText("exenta de IVA");
    await expectAccessible(page);
    const firstUrl = page.url();

    // En sus cobros, el enlace a la factura (y ya no se puede hacer otra del mismo cobro).
    await page.getByRole("link", { name: "Ir a los cobros del paciente" }).click();
    await expect(page.getByRole("link", { name: /Factura A2026-0001/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Hacer la factura/ })).toHaveCount(0);

    // Una en blanco para una mutua, con IVA y dos líneas.
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Facturas/ }).click();
    await page.getByRole("link", { name: "Nueva factura" }).click();
    await page.getByLabel("Nombre o razón social").fill("Mutua Ejemplo SA");
    await page.getByLabel("NIF, DNI o NIE").fill("A11111111");
    await page.getByLabel("Concepto", { exact: true }).fill("Informe de valoración");
    await page.getByLabel("Precio sin IVA (€)").fill("30");
    await page.getByRole("button", { name: "Añadir una línea" }).click();
    await page.getByLabel("Concepto 2").fill("Sesión de fisioterapia");
    await page.getByLabel("Unidades").nth(1).fill("2");
    await page.getByLabel("Precio sin IVA (€)").nth(1).fill("40");
    await page.getByLabel("IVA", { exact: true }).selectOption({ label: "21 %" });
    await expect(page.getByRole("definition").last()).toHaveText(/133,10/);
    await page.getByRole("button", { name: "Revisar y emitir" }).click();
    await page.getByRole("dialog", { name: "¿Emitir la factura?" }).getByRole("button", { name: "Emitir la factura" }).click();
    const second = page.getByRole("article", { name: "Factura A2026-0002" });
    await expect(second).toContainText(/Base imponible\s*110,00/);
    await expect(second).toContainText(/IVA \(21 %\)\s*23,10/);

    // La primera tenía un error: se anula con una rectificativa.
    await page.goto(firstUrl);
    await page.getByRole("button", { name: "Anular con una rectificativa" }).click();
    const rect = page.getByRole("dialog", { name: "Anular con una rectificativa" });
    await rect.getByRole("button", { name: "Emitir la rectificativa" }).click();
    await expect(rect.getByText("Escribe el motivo de la rectificación.")).toBeVisible();
    await rect.getByLabel("Motivo").fill("error en los datos del destinatario");
    await rect.getByRole("button", { name: "Emitir la rectificativa" }).click();
    const r = page.getByRole("article", { name: "Factura RA2026-0001" });
    await expect(r).toContainText("Factura rectificativa");
    await expect(r).toContainText("Rectifica la factura A2026-0001 del 20/10/2026: error en los datos del destinatario");
    await expect(r).toContainText(/Total\s*-45,00|Total\s*−45,00/);
    await page.goto(firstUrl);
    await expect(page.getByText("Anulada con la rectificativa RA2026-0001")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular con una rectificativa" })).toHaveCount(0);

    // La lista del año, la comprobación y el libro para la gestoría.
    await page.goto("./facturas");
    await expect(page.getByText("Numeración y huellas en orden (3 facturas)")).toBeVisible();
    const list = page.getByRole("list", { name: "Facturas de 2026" });
    await expect(list.getByRole("link")).toHaveCount(3);
    await expect(page.getByRole("definition").last()).toHaveText(/133,10/);
    await expect(page.getByText("No está adaptada a Verifactu")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectAccessible(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar el libro de 2026 (Excel)" }).click()]);
    expect(dl.suggestedFilename()).toBe("Facturas 2026.csv");
    const csv = readFileSync((await dl.path())!, "utf8");
    expect(csv).toContain("A2026-0001;Factura;20/10/2026;;Ana Factura;12345678Z;45,00;0;0,00;0;0,00;45,00;");
    expect(csv).toContain("A2026-0002;Factura;20/10/2026;;Mutua Ejemplo SA;A11111111;110,00;21;23,10;0;0,00;133,10;");
    expect(csv).toMatch(/RA2026-0001;Factura rectificativa;20\/10\/2026;;Ana Factura;12345678Z;-45,00;.*;A2026-0001;Rectifica la factura A2026-0001/);
  });
});
