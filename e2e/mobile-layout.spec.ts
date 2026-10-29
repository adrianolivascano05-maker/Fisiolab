import { expect, loadSeed, test } from "./fixtures";

// Las pantallas del día a día con datos de ejemplo, en un móvil estrecho (360 px) y en uno grande (412 px, como un
// Pixel 7 Pro): nada se sale por los lados (sin desplazamiento horizontal de la página).
for (const width of [360, 412]) {
  test(`ficha, agenda y guía sin desbordes a ${width} px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    await loadSeed(page);
    await page.goto("./");
    const href = await page.getByRole("list", { name: "Pacientes" }).getByRole("link").first().getAttribute("href");
    const patient = `.${href!.replace(/^.*\/pacientes\//, "/pacientes/")}`;
    const paths = [
      "./",
      "./agenda",
      "./agenda/espera",
      "./agenda/recordatorios",
      "./biblioteca",
      "./biblioteca/hombro",
      "./biblioteca/hombro/hom-cluster-murrell-walton",
      "./ajustes/cobros",
      "./ajustes/marca",
      "./ajustes/mensajes",
      "./agenda/envios",
      "./facturas",
      "./facturas/emitidas",
      "./ajustes/estadisticas",
      "./ajustes/cuestionarios",
      patient,
      `${patient}/anamnesis`,
      `${patient}/exploracion`,
      `${patient}/sesiones`,
      `${patient}/sesiones/nueva`,
      `${patient}/cuestionarios`,
      `${patient}/cobros`,
      `${patient}/ejercicios`,
      `${patient}/formularios`,
      `${patient}/informe`,
      `${patient}/derivacion`,
      `${patient}/cuestionarios/nuevo`,
      `${patient}/cuestionarios/nuevo?tipo=dass21`,
      `${patient}/cuestionarios/nuevo?tipo=odi`,
    ];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main").first(), path).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
    }
  });
}
