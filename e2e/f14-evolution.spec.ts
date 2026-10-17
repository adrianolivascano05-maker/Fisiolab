import { createPatient, expect, expectAccessible, loadSeed, markAt, startJump, test } from "./fixtures";

test.describe("F14 Ver la evolución", () => {
  test("F14-H1 cinco CMJ de ejemplo: gráfica, mejor y tabla", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await expectAccessible(page);
    await page.getByRole("link", { name: /Lucía Herrero/ }).click();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Evolución CMJ" }).click();
    await expect(page.locator(".recharts-line-dot")).toHaveCount(5);
    await expect(page.getByText(/^Mejor: 31,2/)).toBeVisible();
    await page.getByText("Ver los datos en tabla").click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(6);
    await expectAccessible(page);
  });

  test("F14-E1 una sola medición lo dice", async ({ page }) => {
    await createPatient(page, { name: "Uno" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await page.getByRole("link", { name: "Ver evolución" }).click();
    await expect(page.getByText("Hay una sola medición: hace falta otra para ver la evolución.")).toBeVisible();
  });

  test("F14-E2 potencia sin masa: explica por qué no hay datos", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Irene Soto/ }).click();
    await page.getByRole("link", { name: "Evolución CMJ" }).click();
    await page.getByLabel("Medida").selectOption({ label: "Potencia media" });
    await expect(page.getByText("La potencia necesita la masa y la distancia de empuje del paciente.")).toBeVisible();
  });
});
