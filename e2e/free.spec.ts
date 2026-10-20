// Medición libre (módulo experimental de src/free). El vídeo de prueba no tiene personas: se comprueba
// que el motor de pose carga desde la propia app (con su política de seguridad) y el flujo sin detección.
// La detección con una persona real se comprobó a mano (abducción de 90° → 91,6°).
import { add, createPatient, expect, expectAccessible, test, video } from "./fixtures";

test.describe("Medición libre (experimental)", () => {
  test("FL-H1 carga el motor de pose y avisa si no hay nadie en el vídeo", async ({ page }) => {
    test.setTimeout(300_000);
    await createPatient(page, { name: "Libre" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Movilidad/ }).click();
    await page.getByRole("link", { name: /Ángulos en vídeo con IA/ }).click();
    await expect(page.getByText("Experimental", { exact: true })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    const s = page.getByRole("slider", { name: "Posición en el vídeo" });
    await expect(s).toBeVisible();
    await page.getByRole("button", { name: /^Inicio/ }).click();
    await s.focus();
    await s.press("PageUp");
    await page.getByRole("button", { name: /^Fin/ }).click();
    await expect(page.getByRole("button", { name: "Fin: fot. 11" })).toBeVisible();
    await page.getByRole("button", { name: "Analizar movimiento" }).click();
    await expect(page.getByText(/No se detecta a ninguna persona/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/No se pudo cargar el detector/)).toHaveCount(0);
    await page.getByLabel("Medición", { exact: true }).selectOption("knee_r");
    await expect(page.getByLabel("Plano", { exact: true })).toHaveValue("sagittal");
    await expectAccessible(page);
    // Sin inicio ni fin: busca el movimiento en todo el vídeo.
    await page.getByRole("button", { name: "Cerrar este vídeo" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await page.getByRole("button", { name: "Analizar movimiento" }).click();
    await expect(page.getByText(/No se detecta a ninguna persona/)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Inicio: —" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar este vídeo" }).click();
    await expect(page.getByRole("button", { name: "Grabar o elegir vídeo" })).toBeVisible();
  });
});
