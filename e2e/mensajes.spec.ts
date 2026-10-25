// Mensajes a pacientes (src/messages): en Ajustes, cada mensaje con su texto, su asunto y la firma común; lo que se
// escribe es lo que sale por WhatsApp y correo en el resto de la app.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test.describe("Mensajes a pacientes", () => {
  test("MS1 se edita un mensaje con fichas y firma, se ve en la vista previa, se guarda y lo usa la agenda", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("region", { name: "Clínica", exact: true }).getByRole("link", { name: /Mensajes a pacientes/ }).click();
    await expect(page.getByRole("heading", { name: "Mensajes a pacientes" })).toBeVisible();
    const list = page.getByRole("list", { name: "Mensajes" });
    await expect(list.getByRole("button")).toHaveCount(6);
    await expect(list.getByRole("button", { name: /Recordatorio de cita/ })).toHaveAttribute("aria-pressed", "true");
    await expectAccessible(page);

    // Hueco libre: texto nuevo con fichas (una insertada con su botón), asunto y firma.
    await list.getByRole("button", { name: /Hueco libre/ }).click();
    const text = page.getByLabel("Texto del mensaje");
    await text.fill("Hola {nombre}, hay hueco el {dia} a las ");
    await page.getByRole("group", { name: "Fichas que se sustituyen solas" }).getByRole("button", { name: "{hora}" }).click();
    await expect(text).toHaveValue("Hola {nombre}, hay hueco el {dia} a las {hora}");
    await page.getByLabel("Asunto del correo").fill("Hueco en {clinica}");
    await page.getByLabel("Firma al final de todos los mensajes").fill("Fisioterapia Ruiz · 954 000 000");
    const preview = page.getByText(/Así le llega a Ana/).locator("..");
    await expect(preview).toContainText(/Hola Ana, hay hueco el \S+, \d+ de \w+ a las 10:00/);
    await expect(preview).toContainText("Fisioterapia Ruiz · 954 000 000");
    await expect(preview).toContainText("Hueco en la clínica");
    // Una ficha que no existe avisa.
    await text.fill("Hola {nombre} {precio}");
    await expect(page.getByText(/\{precio\}: esa ficha no existe/)).toBeVisible();
    await text.fill("Hola {nombre}, hay hueco el {dia} a las {hora}");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Mensajes guardados: son los mismos para toda la clínica")).toBeVisible();
    await expect(list.getByRole("button", { name: /Hueco libre.*cambiado/ })).toBeVisible();

    // Se recuerda, y «Volver al texto de Cénit» lo deja como estaba.
    await page.reload();
    await list.getByRole("button", { name: /Hueco libre/ }).click();
    await expect(text).toHaveValue("Hola {nombre}, hay hueco el {dia} a las {hora}");
    await page.getByRole("button", { name: "Volver al texto de Cénit" }).click();
    await expect(text).toHaveValue(/Se ha quedado libre un hueco/);

    // El recordatorio: la firma sale también en la agenda, y desde Recordatorios se llega aquí.
    await page.goto("./agenda/recordatorios");
    await expect(page.getByText(/Fisioterapia Ruiz · 954 000 000/)).toBeVisible();
    await page.getByRole("link", { name: "Cambiar el mensaje" }).click();
    await expect(page.getByRole("heading", { name: "Mensajes a pacientes" })).toBeVisible();
    await expect(list.getByRole("button", { name: /Recordatorio de cita/ })).toHaveAttribute("aria-pressed", "true");
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);
  });
});
