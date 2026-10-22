// Los cuestionarios nuevos (docs/cuestionarios-nuevos.md): buscarlos, rellenarlos, que lleguen con sus códigos CIF a
// la carta de derivación, los pendientes del permiso de su titular y los de solo nota con su lectura.
import type { Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";

async function newPatient(page: Page, name: string) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

test.describe("Cuestionarios nuevos", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("CQ1 buscar, rellenar el Roland-Morris y verlo en la carta de derivación con su CIF", async ({ page }) => {
    const record = await newPatient(page, "Rosa Roland");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("roland");
    await expect(page.getByRole("button", { name: /^RMDQ/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^KOOS/ })).toHaveCount(0);
    await expectAccessible(page);
    await page.getByRole("button", { name: /^RMDQ/ }).click();
    // 12 de las 24 frases le describen hoy.
    const questions = page.getByRole("group").filter({ has: page.getByText("Sí, me describe hoy") });
    await expect(questions).toHaveCount(24);
    for (let i = 0; i < 12; i++) await questions.nth(i).getByText("Sí, me describe hoy").click();
    const result = page.getByRole("heading", { name: "Resultado" }).locator("..");
    await expect(result).toContainText("12/24");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("12/24");

    // La carta: el funcionamiento con la CIF (propuesto con el cuestionario) y el cuestionario con sus códigos.
    await page.goto(`${record}`);
    await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("RMDQ (lumbar, Roland-Morris)");
    await expect(letter).toContainText("CIF: b28013, d410, d415, d450, d540");
    // 12/24 = 50 % de problema: dificultad GRAVE según la escala de la CIF.
    await expect(letter).toContainText("Según la CIF, presenta");
    await expect(letter).toContainText("dificultad grave en cambiar las posturas corporales básicas (d410.3)");
    await expect(page.getByLabel("Funcionamiento según la CIF")).toHaveValue(/Limitaciones en la actividad y restricciones en la participación: .*\(d410\.3\)/);
    await expectAccessible(page);
  });

  test("CQ2 pendiente del permiso de su titular: solo nota hasta que la clínica marca que lo tiene", async ({ page }) => {
    const record = await newPatient(page, "Kiko Koos");
    await page.goto(`${record}/cuestionarios/nuevo?tipo=koos12`);
    await expect(page.getByText(/Pendiente del permiso de su titular/)).toBeVisible();
    await expect(page.getByText("Rellenarlo aquí")).toHaveCount(0);
    await expect(page.getByText("Pásalo con su hoja oficial y escribe aquí la puntuación total.")).toBeVisible();

    await page.goto("./ajustes");
    await page.getByRole("link", { name: /^Cuestionarios/ }).click();
    await expect(page.getByRole("heading", { name: "Cuestionarios" })).toBeVisible();
    await expect(page.getByRole("list", { name: "De pago: solo la nota" })).toContainText("WOMAC");
    await page.getByRole("checkbox", { name: /Tenemos el permiso: KOOS-12/ }).check();
    await expect(page.getByText(/KOOS-12 \(rodilla, forma corta\): ya se puede rellenar en la app/)).toBeVisible();
    await expectAccessible(page);

    await page.goto(`${record}/cuestionarios/nuevo?tipo=koos12`);
    await expect(page.getByText("Rellenarlo aquí")).toBeVisible();
  });

  test("CQ3 de pago, solo la nota: se lee con sus tramos al anotarla", async ({ page }) => {
    const record = await newPatient(page, "Nuria Neuropática");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("paindetect");
    await page.getByRole("button", { name: /^painDETECT/ }).click();
    await expect(page.getByText(/De pago para uso comercial/)).toBeVisible();
    await page.getByLabel("Puntuación").fill("20");
    await expect(page.getByText("Componente neuropático probable (19 o más)")).toBeVisible();
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("painDETECT");
  });
});
