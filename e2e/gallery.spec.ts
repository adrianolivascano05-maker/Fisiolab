// Galería de tests de exploración (módulo independiente de src/gallery).
import { expect, expectAccessible, test } from "./fixtures";

// La escena 3D se dibuja por software en el navegador de las pruebas: en una máquina cargada tarda en salir
// y frena la página; estas esperas tienen más margen que las demás.
const SCENE = { timeout: 20_000 };

test.describe("Galería de tests", () => {
  test("G1 articulación → patología → test, con animación, desplegables y favoritos", async ({ page }) => {
    test.slow(); // dibuja la escena 3D dos veces
    await page.goto("./");
    await page.getByRole("link", { name: "Exploración" }).click();
    await expect(page.getByRole("heading", { name: "Exploración" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: /^Rodilla/ }).click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible();
    await expectAccessible(page);
    // La primera patología está abierta; las demás se despliegan.
    await page.getByText("Menisco", { exact: true }).click();
    await expect(page.getByRole("link", { name: /McMurray/ })).toBeVisible();
    await page.getByRole("link", { name: /Lachman/ }).first().click();
    await expect(page.getByRole("img", { name: /Lachman/ }).first()).toBeVisible(SCENE);
    // Animación: fases con su texto, pausa y avance manual.
    await page.getByRole("button", { name: "3. Qué buscar" }).first().click();
    await expect(page.getByRole("button", { name: "Reproducir la animación" }).first()).toBeVisible();
    await expect(page.locator("figcaption").first()).toContainText("Positivo si");
    await page.getByRole("button", { name: "1. Colocación" }).first().click();
    await expect(page.locator("figcaption").first()).toContainText(/supino/i);
    // Desplegables: «Cómo se hace» abierto; la evidencia se abre y se recuerda.
    await expect(page.getByText("Estabiliza el fémur", { exact: false })).toBeVisible();
    await page.getByText("Evidencia y fuentes").click();
    await expect(page.getByText("Qué cambia el resultado")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Añadir a favoritos" }).click();
    await page.reload();
    await expect(page.getByText("Qué cambia el resultado")).toBeVisible(SCENE);
    // Al recargar vuelve a sonar la animación; en pausa la página responde al momento.
    await page.getByRole("button", { name: "Pausar la animación" }).first().click(SCENE);
    await page.getByRole("button", { name: "Abrir todo" }).click();
    await expect(page.getByText("Precauciones")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar todo" }).click();
    await expect(page.getByText("Qué cambia el resultado")).toBeHidden();
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible(SCENE);
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible(SCENE);
  });

  test("G2 buscador sin tildes ni mayúsculas", async ({ page }) => {
    await page.goto("./exploracion");
    await page.getByLabel("Buscar un test").fill("TUNEL carpiano");
    await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link").first()).toBeVisible();
    await page.getByLabel("Buscar un test").fill("zzzz");
    await expect(page.getByText("Ningún test coincide con «zzzz».")).toBeVisible();
  });

  test("G3 calculadora de probabilidad tras el test", async ({ page }) => {
    await page.goto("./exploracion");
    await page.getByLabel("Buscar un test").fill("Lachman");
    await page.getByRole("list", { name: "Resultados" }).getByRole("link").first().click();
    await page.getByText("Evidencia y fuentes").click();
    await expect(page.getByText("Si es positivo")).toBeVisible();
    await page.getByLabel("Probabilidad antes del test").fill("50");
    await expect(page.getByText(/50 %/).first()).toBeVisible();
  });

  test("G4 figura en 3D: se gira un poco y vuelve a la vista inicial", async ({ page }) => {
    test.slow();
    await page.goto("./exploracion/rodilla/rod-lachman");
    await expect(page.getByRole("img", { name: "Test de Lachman" })).toBeVisible(SCENE);
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "Pausar la animación" }).click(SCENE);
    await page.getByRole("button", { name: "Girar la vista a la derecha" }).click();
    await page.getByRole("button", { name: "Girar la vista a la izquierda" }).click();
    await page.getByRole("button", { name: "Volver a la vista inicial" }).click();
    await expect(page.getByRole("button", { name: "Volver a la vista inicial" })).toBeHidden();
    await expectAccessible(page);
  });
});
