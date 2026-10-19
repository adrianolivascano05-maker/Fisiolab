import { readFileSync } from "node:fs";
import { createPatient, expect, expectAccessible, loadSeed, test } from "./fixtures";

test.describe("F15 Exportar, copiar y restaurar", () => {
  test("F15-H1 CSV para Excel en español", async ({ page }) => {
    await loadSeed(page);
    await expectAccessible(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Exportar resultados/ }).click()]);
    const text = readFileSync((await dl.path())!, "utf8");
    expect(dl.suggestedFilename()).toMatch(/^fisiolab-resultados-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("paciente;fecha;test;movimiento;lado;metodo;carga_kg;altura_caida_cm;fps_grabacion;intento;metrica;valor;unidad");
    expect(text).toMatch(/Ejemplo · Lucía Herrero;[^;]+;cmj;;;;0;;240;;jump_height_cm;\d+,\d+;cm/);
    expect(text).toMatch(/Ejemplo · Marcos Vidal;[^;]+;bienestar;;;;;;;;fatiga;2;1-5\r\n/);
    expect(text).toMatch(/Ejemplo · Marcos Vidal;[^;]+;rom_ankle;Tobillo · flexión dorsal en carga \(lunge\);derecha;Inclinómetro del móvil;0;;;;wall_distance_cm;9,5;cm/);
  });

  test("F15-H2 copia de seguridad y restauración", async ({ page }) => {
    await createPatient(page, { name: "Antes de la copia" });
    await page.goto("./ajustes");
    await expect(page.getByText("Última copia: nunca")).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar copia de seguridad" }).click()]);
    const backup = (await dl.path())!;
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();

    await createPatient(page, { name: "Después de la copia" });
    await page.goto("./ajustes");
    await page.getByLabel("Elegir copia de seguridad").setInputFiles(backup);
    await page.getByRole("dialog").getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("Copia restaurada")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Antes de la copia/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Después de la copia/ })).toHaveCount(0);
  });

  test("F15-N1 un archivo que no es una copia no toca los datos", async ({ page }) => {
    await createPatient(page, { name: "Intacto" });
    await page.goto("./ajustes");
    await page.getByLabel("Elegir copia de seguridad").setInputFiles({ name: "x.sqlite3", mimeType: "application/octet-stream", buffer: Buffer.from("no soy una base") });
    await page.getByRole("dialog").getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("El archivo no es una copia de seguridad válida.")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Intacto/ })).toBeVisible();
  });

  test("F15-E1 cargar ejemplo no se duplica aunque se pulse rápido", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 30_000 });
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Ejemplo · / })).toHaveCount(3);
    await page.goto("./ajustes");
    await page.getByRole("button", { name: "Borrar los datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Cargar datos de ejemplo" })).toBeVisible();
  });

  test("F15-E2 dos pestañas: la segunda avisa y no trabaja en vacío; al cerrar la primera, funciona", async ({ page, context }) => {
    await createPatient(page, { name: "Pestaña uno" });
    const second = await context.newPage();
    await second.goto("./");
    await expect(second.getByText("Cénit ya está abierta en otra pestaña")).toBeVisible();
    await expect(second.getByRole("link", { name: "Nuevo paciente" })).toHaveCount(0);
    await page.close();
    await second.getByRole("button", { name: "Reintentar" }).click();
    await expect(second.getByRole("link", { name: /Pestaña uno/ })).toBeVisible();
  });
});
