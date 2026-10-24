import { expect, expectAccessible, loadSeed, test } from "./fixtures";

// Pantallas principales a 390 y 1440 px: sin desbordes horizontales y sin fallos de accesibilidad.
for (const width of [390, 1440]) {
  test(`pantallas a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadSeed(page);
    for (const path of ["./", "./ajustes", "./ajustes/cuenta", "./ajustes/clinica", "./ajustes/bloqueo", "./ajustes/datos", "./ayuda", "./ayuda/fallos", "./agenda/envios", "./facturas", "./facturas/nueva", "./instalar", "./pacientes/nuevo", "./no-existe"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
      await expectAccessible(page);
    }
  });
}
