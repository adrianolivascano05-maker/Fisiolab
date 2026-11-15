// La cabecera compacta de la ficha (docs/rediseno-sencilla.md, bloque 1): nombre, motivo, la cita con su estado y
// «Más datos» con lo que se usa poco (teléfono, peso, estatura). En el móvil (360 px), sin desbordes y con 44 px.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test.describe("Ficha: cabecera compacta", () => {
  test("FC1 «Dar cita» pasa a decir la cita; «Más datos» guarda el teléfono, el peso y la estatura; deslizar cambia de pestaña", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Carmen Cabecera Compacta");
    await page.getByLabel("Teléfono").fill("600 123 456");
    await page.getByLabel("Peso").fill("62");
    await page.getByLabel("Estatura").fill("168");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Carmen Cabecera Compacta" })).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    // Lo que se usa poco, a un toque.
    await page.getByRole("button", { name: "Más datos" }).click();
    const more = page.getByRole("dialog", { name: "Más datos de Carmen Cabecera Compacta" });
    await expect(more.getByRole("link", { name: "600 123 456" })).toBeVisible();
    await expect(more).toContainText("62,0 kg");
    await expect(more).toContainText("168 cm");
    await expect(more.getByRole("link", { name: "Editar sus datos" })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(more).toBeHidden();

    // Sin cita, «Dar cita»; con cita, el mismo botón dice cuándo es.
    await page.getByRole("button", { name: "Dar cita" }).click();
    const give = page.getByRole("dialog", { name: "Dar cita a Carmen Cabecera Compacta" });
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    await give.getByLabel("Día y hora").fill(`${tomorrow}T10:00`);
    await give.getByRole("button", { name: "Dar la cita" }).click();
    await expect(give).toBeHidden();
    await expect(page.getByRole("button", { name: /^Próxima cita: / })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar cita", exact: true })).toHaveCount(0);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);

    // Deslizar el dedo hacia la izquierda pasa a la pestaña siguiente (Anamnesis); hacia la derecha, vuelve.
    const swipe = async (fromX: number, toX: number) =>
      page
        .locator("[data-tab-swipe]")
        .evaluate(
          (el, [a, b]) => {
            const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
            el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(a!)], changedTouches: [touch(a!)] }));
            el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(b!)] }));
          },
          [fromX, toX],
        );
    await expect(page.getByRole("heading", { name: "Situación" })).toBeVisible();
    await swipe(300, 60);
    await expect(page).toHaveURL(/\/anamnesis$/);
    await expect(page.getByRole("heading", { name: "Anamnesis", exact: true })).toBeVisible();
    await swipe(60, 300);
    await expect(page).toHaveURL(/\/pacientes\/[^/]+$/);
  });
});
