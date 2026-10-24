// Para facturar (src/data/toBill.ts): la app no hace facturas. Los cobros del mes salen con los datos del paciente y en
// Excel para el programa de facturación de la clínica; en cada cobro se apunta el número que le dio ese programa. Las
// facturas que se hicieron antes con la app siguen en «Facturas hechas con la app», en solo lectura.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { expect, expectAccessible, test } from "./fixtures";

/** El texto de los archivos de un .xlsx (un .zip): para buscar lo que lleva dentro. */
function xlsxText(bytes: Buffer): string {
  let out = "";
  for (let at = bytes.indexOf("PK\x03\x04", 0, "latin1"); at >= 0; at = bytes.indexOf("PK\x03\x04", at + 4, "latin1")) {
    const method = bytes.readUInt16LE(at + 8);
    const size = bytes.readUInt32LE(at + 18);
    const start = at + 30 + bytes.readUInt16LE(at + 26) + bytes.readUInt16LE(at + 28);
    const data = bytes.subarray(start, start + size);
    out += (method === 8 ? inflateRawSync(data) : data).toString("utf8");
  }
  return out;
}

test.describe("Para facturar", () => {
  // Un martes a las 10:00 en Madrid.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("FA1 los cobros del mes con los datos del paciente, en Excel; se apunta el nº de factura y se ve lo que falta", async ({ page }) => {
    // Un paciente con su DNI y un cobro.
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Ana Factura");
    await page.getByLabel("DNI o NIE").fill("12345678Z");
    await page.getByLabel("Dirección").fill("Calle Sol 3, Sevilla");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Ana Factura" })).toBeVisible();
    const cobros = `${page.url()}/cobros`;
    await page.goto(cobros);
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar" });
    await pay.getByLabel("Cantidad").fill("45");
    await pay.getByText("Tarjeta").click();
    await pay.getByRole("button", { name: "Guardar el cobro" }).click();
    await expect(page.getByRole("status")).toHaveText(/45,00/);
    // La app ya no hace facturas: en el cobro, apuntar el número.
    await expect(page.getByRole("link", { name: /Hacer la factura/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Apuntar nº de factura del cobro de 45,00/ })).toBeVisible();

    // Ajustes › Para facturar.
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Para facturar/ }).click();
    await expect(page.getByRole("heading", { name: "Para facturar" })).toBeVisible();
    await expect(page.getByText(/La app no hace facturas/)).toBeVisible();
    const list = page.getByRole("list", { name: "Cobros de octubre de 2026" });
    await expect(list).toContainText("Ana Factura");
    await expect(list).toContainText("45,00");
    await expect(page.getByText("Solo los que faltan por facturar (1)")).toBeVisible();
    await expect(page.getByRole("link", { name: /Facturas hechas con la app/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expectAccessible(page);

    // El Excel, con lo que pide la factura.
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar en Excel" }).click()]);
    expect(dl.suggestedFilename()).toBe("Cobros 2026-10.xlsx");
    const text = xlsxText(readFileSync((await dl.path())!));
    for (const v of ["Nº de factura", "Ana Factura", "12345678Z", "Calle Sol 3, Sevilla", "Sesión de fisioterapia", "Tarjeta", "Operación exenta de IVA"]) expect(text, v).toContain(v);

    // Hecha con su programa: se apunta el número.
    await page.getByRole("button", { name: /Apuntar nº de factura del cobro de Ana Factura/ }).click();
    const sheet = page.getByRole("dialog", { name: "Nº de factura" });
    await sheet.getByLabel("Número de la factura").fill("F-2026-15");
    await sheet.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Factura F-2026-15 apuntada")).toBeVisible();
    await expect(list).toContainText("Factura F-2026-15");
    await page.getByLabel(/Solo los que faltan por facturar/).check();
    await expect(page.getByText("Todos los cobros de este mes tienen su factura.")).toBeVisible();

    // En sus cobros, también.
    await page.goto(cobros);
    await expect(page.getByRole("button", { name: /Factura F-2026-15 del cobro de 45,00/ })).toBeVisible();
  });

  test("FA2 lo que se puso sobre el IVA se guarda; las direcciones antiguas llevan a su sitio", async ({ page }) => {
    await page.goto("./facturas");
    await page.getByLabel("IVA", { exact: true }).selectOption({ label: "21 %" });
    await expect(page.getByLabel("Motivo de la exención")).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("IVA", { exact: true })).toHaveValue("21");

    await page.goto("./facturas/nueva");
    await expect(page.getByRole("heading", { name: "Para facturar" })).toBeVisible();
    await page.goto("./facturas/emitidas");
    await expect(page.getByRole("heading", { name: "Facturas hechas con la app" })).toBeVisible();
    await expect(page.getByText("Sin facturas en 2026.")).toBeVisible();
    await expectAccessible(page);
  });
});
