import { add, expect, expectAccessible, loadSeed, test } from "./fixtures";

// El modo oscuro sigue el ajuste del teléfono. Aquí se emula y se pasa el escáner de accesibilidad (contraste
// incluido) por las pantallas principales; los documentos se quedan en claro, como papel.
test.use({ colorScheme: "dark" });

const background = (el: import("@playwright/test").Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor);

test.describe("Modo oscuro", () => {
  test("OS1 pantallas principales con contraste suficiente y documentos en papel claro", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    // El fondo de la app es oscuro (#0F1512).
    expect(await background(page.locator("body"))).toBe("rgb(15, 21, 18)");
    await expectAccessible(page);

    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await expect(page.getByRole("heading", { name: "Situación" })).toBeVisible();
    await expectAccessible(page);
    await add(page, "Medición").click();
    await expect(page.getByRole("link", { name: /Fuerza/ })).toBeVisible();
    await expectAccessible(page);
    await page.goBack();

    const tabs = page.getByRole("navigation", { name: "Ficha del paciente" });
    await tabs.getByRole("link", { name: "Valoración" }).click();
    await expect(page.getByRole("heading", { name: "Mediciones", exact: true })).toBeVisible();
    await expectAccessible(page);
    await tabs.getByRole("link", { name: "Sesiones" }).click();
    await expect(page.getByRole("heading", { name: "Sesiones", exact: true })).toBeVisible();
    await expectAccessible(page);

    // El informe se ve como un papel blanco con texto oscuro.
    await tabs.getByRole("link", { name: "Resumen" }).click();
    await page.getByRole("link", { name: /^Informe(?! de alta)/ }).click();
    const paper = page.getByRole("article", { name: "Informe" });
    await expect(paper).toBeVisible();
    expect(await background(paper)).toBe("rgb(255, 255, 255)");
    expect(await paper.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(22, 32, 27)");
    await expectAccessible(page);

    await page.goto("./agenda");
    await expectAccessible(page);
    await page.goto("./biblioteca");
    await expectAccessible(page);
    await page.goto("./ajustes");
    await expectAccessible(page);
  });

  test("OS2 Ajustes → Aspecto: claro u oscuro a mano, se recuerda, y automático vuelve a seguir al dispositivo", async ({ page }) => {
    // El dispositivo está en oscuro (test.use arriba): «Claro» lo deja en claro.
    await page.goto("./ajustes");
    await page.getByRole("region", { name: "App", exact: true }).getByRole("link", { name: /Aspecto.*Automático/ }).click();
    await expect(page.getByRole("heading", { name: "Aspecto" })).toBeVisible();
    await page.getByRole("radio", { name: /^Claro/ }).check();
    expect(await background(page.locator("body"))).toBe("rgb(242, 244, 241)");
    await expectAccessible(page);
    // Se recuerda al volver a abrir la app.
    await page.reload();
    await expect(page.getByRole("radio", { name: /^Claro/ })).toBeChecked();
    expect(await background(page.locator("body"))).toBe("rgb(242, 244, 241)");
    // Oscuro, y la fila de Ajustes lo dice.
    await page.getByRole("radio", { name: /^Oscuro/ }).check();
    expect(await background(page.locator("body"))).toBe("rgb(15, 21, 18)");
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Aspecto.*Oscuro/ })).toBeVisible();
    // Automático: como el dispositivo (aquí, oscuro); con el dispositivo en claro, claro.
    await page.goto("./ajustes/aspecto");
    await page.getByRole("radio", { name: /^Automático/ }).check();
    await page.emulateMedia({ colorScheme: "light" });
    expect(await background(page.locator("body"))).toBe("rgb(242, 244, 241)");
  });
});
