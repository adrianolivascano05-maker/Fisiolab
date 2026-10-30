import { add, createPatient, expect, expectAccessible, loadSeed, markAt, markNextInSeries, startJump, test } from "./fixtures";

test.describe("Fase 2 de saltos", () => {
  test("F04 perfil fuerza-velocidad con los SJ cargados de ejemplo", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Valoración" }).click();
    await page.getByRole("link", { name: "Perfil fuerza-velocidad" }).click();
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(4);
    for (const b of await boxes.all()) await b.check();
    // Los SJ de ejemplo salen de un perfil F0 30 N/kg y V0 3,4 m/s (redondeados a fotogramas enteros).
    const f0 = page.locator("p,div,span").filter({ hasText: /^F0$/ }).first();
    await expect(f0).toBeVisible();
    const card = (label: string) => page.getByText(label, { exact: true }).locator("..");
    await expect(card("F0")).toContainText(/(29|30|31),\d\s*N\/kg/);
    await expect(card("V0")).toContainText(/3,[3-5]\d\s*m\/s/);
    await expect(page.getByText(/Pendiente más orientada a la velocidad que la óptima del modelo/)).toBeVisible();
    await expect(page.locator(".recharts-scatter-symbol")).toHaveCount(4);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByRole("heading", { name: "Perfiles guardados" })).toBeVisible();
    await expect(page.getByText(/SJ · /)).toBeVisible();
  });

  test("F04-N1 una sola carga no da perfil", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Valoración" }).click();
    await page.getByRole("link", { name: "Perfil fuerza-velocidad" }).click();
    await page.getByRole("checkbox").first().check();
    await expect(page.getByRole("button", { name: "Guardar perfil" })).toHaveCount(0);
  });

  test("F05 asimetría: izquierda 96 fotogramas, derecha 104 → 14,8 %, rinde menos la izquierda", async ({ page }) => {
    await createPatient(page, { name: "Asimetría" });
    await startJump(page, { type: /CMJ a una pierna/, side: "Izquierda" });
    await markAt(page, 100, "despegue");
    await markAt(page, 196, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await page.getByRole("link", { name: /Ahora la pierna derecha/ }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles((await import("./fixtures")).video.at240);
    await page.getByRole("button", { name: "Marcar el salto" }).click();
    await markAt(page, 100, "despegue");
    await markAt(page, 204, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await page.getByRole("link", { name: "Ver asimetría" }).click();
    await expect(page.getByText("14,8 %", { exact: true })).toBeVisible();
    await expect(page.getByText("Rinde menos la pierna izquierda.")).toBeVisible();
    await expectAccessible(page);
  });

  test("F06 saltos repetidos 10/5: 6 saltos, deshacer y orden", async ({ page }) => {
    await createPatient(page, { name: "Repetidos" });
    await startJump(page, { type: /Saltos repetidos/ });
    // 6 saltos: vuelo 20 fotogramas, contacto 10.
    const frames = [5, 25, 35, 55, 65, 85, 95, 115, 125, 145, 155, 175];
    for (const f of frames.slice(0, 3)) await markNextInSeries(page, f);
    // Una marca antes de la anterior se rechaza
    await markNextInSeries(page, 30).catch(() => {});
    await expect(page.getByText("Cada marca debe ir después de la anterior: avanza en el vídeo.")).toBeVisible();
    // Deshacer quita la última (despegue 2 en el fotograma 35) y se vuelve a marcar
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByRole("button", { name: /^despegue 2\s*:/i })).toBeVisible();
    for (const f of frames.slice(2)) await markNextInSeries(page, f);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Calcular" }).click();
    // h = 9,81·(20/240)²/8 = 0,851 cm; contacto 41,7 ms → RSI 0,20
    await expect(page.getByText("RSI (media de los 5 mejores)")).toBeVisible();
    await expect(page.getByText("0,20", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(7);
    await expectAccessible(page);
  });

  test("F07 salto horizontal sin vídeo", async ({ page }) => {
    await createPatient(page, { name: "Horizontal" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("radio", { name: /Salto horizontal/ }).check({ force: true });
    await page.getByRole("button", { name: "Guardar salto" }).click();
    await expect(page.getByText("Indica la distancia en centímetros (1-499).")).toBeVisible();
    await page.getByLabel("Distancia").fill("212");
    await page.getByRole("button", { name: "Guardar salto" }).click();
    await expect(page.getByText("212", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("link", { name: /Horizontal.*212/ })).toBeVisible();
  });

  test("F02-E11 CMJ con inicio del movimiento: RSI modificado y tiempo hasta el despegue", async ({ page }) => {
    await createPatient(page, { name: "RSI mod" });
    await startJump(page);
    const s = page.getByRole("slider", { name: "Posición en el vídeo" });
    await s.focus();
    await s.press("Home");
    for (let i = 0; i < 4; i++) await s.press("ArrowRight");
    await page.getByRole("button", { name: /^inicio \(opcional\)\s*:/i }).click();
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    // 96 fotogramas = 400 ms; 0,3066 / 0,4 = 0,77
    await expect(page.getByText("RSI modificado")).toBeVisible();
    await expect(page.getByText("0,77", { exact: true })).toBeVisible();
    await expect(page.getByText("400", { exact: true })).toBeVisible();
  });
});
