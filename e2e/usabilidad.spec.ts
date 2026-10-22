// Comodidad del día a día: el DNI de la ficha llega al justificante y la reevaluación pendiente pasa a la sesión
// siguiente hasta que se hace.
import { add, expect, expectAccessible, test } from "./fixtures";

test.describe("Comodidad del día a día", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("US1 el DNI de la ficha sale solo en el justificante", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Diana Documento");
    await page.getByLabel("DNI o NIE").fill("12345678z");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Diana Documento" })).toBeVisible();
    await page.goto(`${page.url()}/justificante`);
    await expect(page.getByLabel("DNI o NIE del paciente (opcional)")).toHaveValue("12345678Z");
    await expect(page.getByRole("article", { name: "Justificante de asistencia" })).toContainText("con DNI/NIE 12345678Z");
    await expectAccessible(page);
  });

  test("US2 la reevaluación pendiente sigue en la sesión siguiente hasta marcarla hecha", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Rita Reevalúa");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Rita Reevalúa" })).toBeVisible();
    await add(page, "Sesión").click();
    await page.getByRole("button", { name: "En 1 semana" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText(/Reevaluar el/).first()).toBeVisible();

    await page.goto("./");
    await page.getByRole("link", { name: /Rita Reevalúa/ }).first().click();
    await add(page, "Sesión").click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await expect(page.getByText(/Sigue la reevaluación pendiente del/)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Ya reevaluado hoy" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("");
  });
});
