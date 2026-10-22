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
    await page.getByLabel("Día y hora de la consulta").fill("2026-10-20T10:00");
    await expect(page.getByRole("article", { name: "Justificante de asistencia" })).toContainText("con DNI/NIE 12345678Z");
    await expectAccessible(page);
  });

  test("US2 la reevaluación pendiente sigue en la sesión siguiente hasta marcarla hecha", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Rita Reevalúa");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Rita Reevalúa" })).toBeVisible();
    const record = page.url();
    await add(page, "Sesión").click();
    await page.getByRole("button", { name: "En 1 semana" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText(/Reevaluar el/).first()).toBeVisible();

    await page.goto(record);
    await add(page, "Sesión").click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await expect(page.getByText(/Sigue la reevaluación pendiente del/)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Ya reevaluado hoy" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("");
  });

  test("US3 la anamnesis avisa sola de las banderas rojas que se escriben y del cuadro que forman", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Óscar Alarma");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Óscar Alarma" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Cervical", { exact: true }).click();
    // Lo dicho en negativo no cuenta; lo demás sale mientras se escribe.
    await page.getByLabel("Motivo principal").fill("Dolor de cuello. No tiene fiebre. Desde ayer, mareo al girar la cabeza");
    const alarms = page.getByRole("region", { name: /Alarmas/ });
    await expect(alarms.getByRole("article", { name: "Posible origen vascular cervical (arterias del cuello)" })).toContainText("Urgente");
    await expect(alarms).toContainText("En «Motivo principal»");
    await expect(alarms).not.toContainText("Fiebre o malestar general");
    await alarms.getByText("Qué preguntar para profundizar").click();
    await expect(alarms).toContainText("5 D y 3 N");
    await expectAccessible(page);
    // Confirmarla la marca en «Banderas rojas».
    await alarms.getByRole("button", { name: /Confirmar.*Mareo/ }).click();
    await expect(page.getByRole("checkbox", { name: /^Mareo, visión doble/ })).toBeChecked();
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByRole("link", { name: "Hacer un informe para su médico" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Alarmas/ })).toContainText("Confirmadas: Mareo, visión doble");
  });
});
