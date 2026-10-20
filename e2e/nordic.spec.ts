import { add, createPatient, expect, expectAccessible, loadSeed, markAt, scrubber, test, video } from "./fixtures";

test.describe("F12 Nórdico de isquios", () => {
  test("F12-H1 por vídeo: rotura, ángulo sobre el fotograma y momento estimado", async ({ page }) => {
    await createPatient(page, { name: "Isquios", mass: "80", height: "180" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Nórdico/ }).click();
    await page.getByRole("button", { name: "Cómo grabar y marcar" }).click();
    await expect(page.getByRole("img", { name: /tobillos sujetos/ })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await page.getByRole("button", { name: "Marcar la rotura" }).click();
    await expect(scrubber(page)).toBeVisible();
    await markAt(page, 150, "rotura");
    await page.getByRole("button", { name: "Medir el ángulo en este fotograma" }).click();

    // Rodilla y cadera: la cadera 100 px más allá, inclinada 55° respecto a la vertical.
    const svg = page.getByTestId("protractor");
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    const knee = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.85 };
    const rad = (55 * Math.PI) / 180;
    await page.mouse.click(knee.x, knee.y);
    await page.mouse.click(knee.x + 100 * Math.sin(rad), knee.y - 100 * Math.cos(rad));
    await expect(page.getByTestId("angulo-actual")).toContainText("55°");
    await page.getByRole("button", { name: "Guardar resultado" }).click();

    const card = (label: string) => page.getByText(label, { exact: true }).locator("..");
    await expect(card("Ángulo de rotura")).toContainText("55");
    await expect(card("Ángulo de rotura")).toContainText("con el suelo: 35°");
    // 0,878 · 80 · 9,81 · 0,322 · 1,80 · sen 55° / 2 = 163,6 N·m
    await expect(card("Momento por pierna (estimado)")).toContainText("164");
    await expect(card("Relativo al peso")).toContainText("2,04");
    await expectAccessible(page);
  });

  test("F12-H2 a mano y sin estatura: solo el ángulo", async ({ page }) => {
    await createPatient(page, { name: "Sin estatura", mass: "70" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Nórdico/ }).click();
    await expect(page.getByText("Sin peso o estatura, solo el ángulo")).toBeVisible();
    await page.getByRole("radio", { name: /A mano/ }).check({ force: true });
    await page.getByRole("textbox", { name: "Ángulo de rotura" }).fill("95");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Escribe la inclinación en grados (0-90).")).toBeVisible();
    await page.getByRole("textbox", { name: "Ángulo de rotura" }).fill("45");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/añade el peso y la estatura/)).toBeVisible();
    await page.getByRole("link", { name: "Volver" }).first().click();
    await expect(page.getByRole("link", { name: /Nórdico.*45°/ })).toBeVisible();
  });

  test("F12-H3 evolución con los datos de ejemplo", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Mediciones" }).click();
    await page.getByRole("link", { name: /Nórdico.*57°/ }).click();
    await expect(page.getByRole("heading", { name: "Evolución" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("table")).toContainText("50°");
    await expectAccessible(page);
  });
});
