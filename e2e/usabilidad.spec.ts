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
    await expect(page.getByRole("link", { name: "Carta de derivación a su médico" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Alarmas/ })).toContainText("Confirmadas: Mareo, visión doble");

    // La carta de derivación sale redactada, urgente y con las alarmas.
    await page.getByRole("link", { name: "Carta de derivación a su médico" }).click();
    await expect(page.getByRole("radio", { name: /^Urgente/ })).toBeChecked();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("Signos y síntomas de alarma");
    await expect(letter).toContainText("Solicito su valoración para descartar origen vascular cervical");
    await page.getByLabel("Dirigida a").fill("Dra. Ruiz, Atención Primaria");
    await expect(letter).toContainText("Dra. Ruiz, Atención Primaria");
    await expectAccessible(page);
  });

  test("US4 banderas amarillas: lo que se escribe propone el cuestionario que lo mide", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Pilar Miedo");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Pilar Miedo" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByLabel("Motivo principal").fill("Lumbalgia");
    await page.getByText("5. Tratamientos previos y expectativas").click();
    await page.getByLabel("Qué cree el paciente que le pasa").fill("Le da miedo agacharse: cree que se le va a romper la espalda");
    await expect(page.getByRole("region", { name: /Banderas amarillas/ })).toContainText("Miedo al movimiento");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await page.getByRole("region", { name: /Banderas amarillas/ }).getByRole("link", { name: /TSK-11/ }).click();
    await expect(page).toHaveURL(/cuestionarios\/nuevo\?tipo=tsk11/);
  });

  test("US5 CIF: buscar rápido, calificar y redactar el diagnóstico; sale en la carta de derivación", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Carlos CIF");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Carlos CIF" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Lumbar", { exact: true }).click();
    await page.getByRole("button", { name: "Añadir códigos de la CIF" }).click();
    const sheet = page.getByRole("dialog", { name: "Buscar en la CIF" });
    // Sin escribir: los de su zona.
    await expect(sheet.getByRole("button", { name: /s76002 Columna vertebral lumbar/ })).toBeVisible();
    // Por palabras, sin tildes.
    await sheet.getByLabel("Código o palabras").fill("dolor espalda");
    await sheet.getByRole("button", { name: /b28013 Dolor en la espalda/ }).click();
    // Por código y filtrando el componente.
    await sheet.getByRole("radio", { name: "Actividades (d)" }).click();
    await sheet.getByLabel("Código o palabras").fill("d450");
    await sheet.getByRole("button", { name: /^d450 Andar/ }).click();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Listo" }).click();

    await page.getByLabel("Calificador (b28013)").selectOption("2");
    await page.getByLabel("Desempeño/realización (d450)").selectOption("2");
    await page.getByLabel("Capacidad (d450)").selectOption("1");
    await page.getByRole("button", { name: "Redactar el diagnóstico con la CIF" }).click();
    await expect(page.getByLabel("Diagnóstico fisioterapéutico (criterio del profesional)")).toHaveValue(/Dolor en la espalda \(b28013\.2\): deficiencia moderada/);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Andar (d450.21): desempeño/realización: dificultad moderada; capacidad: dificultad ligera").first()).toBeVisible();

    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Resumen" }).click();
    await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    await expect(page.getByRole("article", { name: "Carta de derivación" })).toContainText("Perfil de funcionamiento (CIF)");
    await expect(page.getByRole("article", { name: "Carta de derivación" })).toContainText("Dolor en la espalda (b28013.2)");
  });
});
