// Biblioteca: tests de exploración, cuestionarios y mediciones (módulo src/gallery).
import { expect, expectAccessible, test } from "./fixtures";

// La escena 3D se dibuja por software en el navegador de las pruebas: en una máquina cargada tarda en salir
// y frena la página; estas esperas tienen más margen que las demás.
const SCENE = { timeout: 20_000 };

test.describe("Galería de tests", () => {
  test("G1 articulación → patología → test, con animación, desplegables y favoritos", async ({ page }) => {
    test.slow(); // dibuja la escena 3D dos veces
    await page.goto("./");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Biblioteca" }).click();
    await expect(page.getByRole("heading", { name: "Biblioteca", level: 1 })).toBeVisible();
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
    await expect(page.getByRole("columnheader", { name: "LR+" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Añadir a favoritos" }).click();
    await page.reload();
    await expect(page.getByRole("columnheader", { name: "LR+" })).toBeVisible(SCENE);
    // Al recargar vuelve a sonar la animación; en pausa la página responde al momento.
    await page.getByRole("button", { name: "Pausar la animación" }).first().click(SCENE);
    await page.getByRole("button", { name: "Abrir todo" }).click();
    await expect(page.getByText("Precauciones")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar todo" }).click();
    await expect(page.getByRole("columnheader", { name: "LR+" })).toBeHidden();
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible(SCENE);
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible(SCENE);
  });

  test("G2 buscador sin tildes ni mayúsculas", async ({ page }) => {
    await page.goto("./biblioteca");
    await page.getByLabel("Buscar en la Biblioteca").fill("TUNEL carpiano");
    await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link").first()).toBeVisible();
    await page.getByLabel("Buscar en la Biblioteca").fill("zzzz");
    await expect(page.getByText("Nada coincide con «zzzz».")).toBeVisible();
    // Un solo buscador: también cuestionarios y mediciones.
    await page.getByLabel("Buscar en la Biblioteca").fill("rodilla");
    await expect(page.getByRole("region", { name: /^Cuestionarios \(\d+\)/ }).getByRole("link", { name: /KOOS \(rodilla\)/ })).toBeVisible();
    await page.getByLabel("Buscar en la Biblioteca").fill("salto");
    await expect(page.getByRole("region", { name: "Mediciones (1)" }).getByRole("link", { name: /^Saltos/ })).toBeVisible();
    // La dirección antigua (/exploracion) lleva a la Biblioteca.
    await page.goto("./exploracion/rodilla");
    await expect(page).toHaveURL(/\/biblioteca\/rodilla$/);
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible();
  });

  test("G3 la evidencia es la tabla publicada con su fuente, sin calculadora ni lecturas del resultado", async ({ page }) => {
    await page.goto("./biblioteca");
    await page.getByLabel("Buscar en la Biblioteca").fill("Lachman");
    await page.getByRole("list", { name: "Resultados" }).getByRole("link").first().click();
    await page.getByText("Evidencia y fuentes").click();
    const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Fuente" }) });
    await expect(table.getByRole("columnheader", { name: "Sens." })).toBeVisible();
    await expect(table.getByRole("rowheader").first()).not.toBeEmpty();
    await expect(page.getByLabel("Probabilidad antes del test")).toHaveCount(0);
    await expect(page.getByText(/Tu sospecha|Si es positivo|casi confirma|casi descarta/)).toHaveCount(0);
  });

  test("G4 figura en 3D: se gira un poco y vuelve a la vista inicial", async ({ page }) => {
    test.slow();
    await page.goto("./biblioteca/rodilla/rod-lachman");
    await expect(page.getByRole("img", { name: "Test de Lachman" })).toBeVisible(SCENE);
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "Pausar la animación" }).click(SCENE);
    await page.getByRole("button", { name: "Girar la vista a la derecha" }).click();
    await page.getByRole("button", { name: "Girar la vista a la izquierda" }).click();
    await page.getByRole("button", { name: "Volver a la vista inicial" }).click();
    await expect(page.getByRole("button", { name: "Volver a la vista inicial" })).toBeHidden();
    await expectAccessible(page);
  });

  test("G5 varios tests seguidos: todos en 3D (cerrar una figura no deja la siguiente en el dibujo plano)", async ({ page }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./biblioteca/rodilla");
    const links = page.getByRole("main").getByRole("link").filter({ hasText: /\S/ });
    await links.first().waitFor();
    const n = Math.min(5, await links.count());
    for (let i = 0; i < n; i++) {
      await links.nth(i).click();
      await expect(page.getByRole("button", { name: "Girar la vista a la izquierda" }).first()).toBeVisible(SCENE);
      await expect(page.locator("figure [class*='aspect-'] > div > svg")).toHaveCount(0);
      await page.goBack();
      await links.first().waitFor();
    }
  });

  test("G5 estantes de cuestionarios y mediciones", async ({ page }) => {
    await page.goto("./biblioteca");
    await page.getByRole("link", { name: /^Los \d+ cuestionarios/ }).click();
    await expect(page.getByRole("heading", { name: "Cuestionarios", level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel("Buscar cuestionario").fill("lefs");
    await page.getByRole("link", { name: /^LEFS/ }).click();
    await expect(page.getByRole("heading", { name: /^LEFS/, level: 1 })).toBeVisible();
    await expect(page.getByText("de 0 a 80, más es mejor")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pasar a un paciente" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Cuestionarios", exact: false }).first().click();
    await expect(page.getByRole("heading", { name: "Cuestionarios", level: 1 })).toBeVisible();

    await page.goto("./biblioteca/mediciones");
    await expect(page.getByRole("heading", { name: "Nórdico" })).toBeVisible();
    await expectAccessible(page);
    // Sin ficha, directo al tipo elegido, en la ficha «Medición rápida».
    await page.getByRole("button", { name: "Medir ahora, sin ficha: Saltos" }).click();
    await expect(page.getByRole("heading", { name: "Saltos" })).toBeVisible();
    await expect(page).toHaveURL(/\/pacientes\/[^/]+\/test\/saltos$/);
  });
});
