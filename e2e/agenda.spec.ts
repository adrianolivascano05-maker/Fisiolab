// Agenda y seguimiento (src/data/appointments.ts y src/clinical): citas sin sesión, la agenda de hoy en Pacientes
// (atendida, no vino), repetir el tratamiento de la última sesión, las sesiones previstas (bono) y el informe de alta.
import type { Page } from "@playwright/test";
import { add, createPatient, expect, expectAccessible, test } from "./fixtures";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });

/** Desde la cabecera de la ficha: «Dar cita» a una hora de hoy. */
async function giveAppointment(page: Page, name: string, when: string) {
  await page.getByRole("button", { name: "Dar cita" }).click();
  const sheet = page.getByRole("dialog", { name: `Dar cita a ${name}` });
  await sheet.getByLabel("Día y hora").fill(when);
  await sheet.getByRole("button", { name: "Dar la cita" }).click();
  await expect(sheet).toBeHidden();
}

test.describe("Agenda y seguimiento", () => {
  // Un martes a las 10:00 en Madrid: «hoy» es siempre el mismo día.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("AG1 citas sin sesión: la agenda de hoy, no vino, atendida al apuntar la sesión", async ({ page }) => {
    await createPatient(page, { name: "Ana Agenda" });
    await giveAppointment(page, "Ana Agenda", "2026-10-20T12:30");
    await expect(page.getByRole("button", { name: /Próxima cita: .*12:30/ })).toBeVisible();
    await createPatient(page, { name: "Bruno Falta" });
    await giveAppointment(page, "Bruno Falta", "2026-10-20T11:00");

    await page.goto("./");
    const today = page.getByRole("region", { name: "Hoy" });
    await expect(today.getByRole("button")).toHaveText([/11:00 · Bruno Falta.*45 min/, /12:30 · Ana Agenda.*45 min/]);
    await expectAccessible(page);

    // Bruno no viene.
    await today.getByRole("button", { name: /Bruno Falta/ }).click();
    const sheet = page.getByRole("dialog", { name: "Cita de Bruno Falta" });
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "No vino" }).click();
    await expect(today.getByRole("button", { name: /Bruno Falta/ })).toContainText("No vino");

    // Ana viene: desde la agenda se apunta su sesión y la cita queda atendida.
    await today.getByRole("button", { name: /Ana Agenda/ }).click();
    await page.getByRole("dialog", { name: "Cita de Ana Agenda" }).getByRole("link", { name: /Atender/ }).click();
    await page.getByLabel("Tratamiento").fill("Terapia manual");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Terapia manual")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar cita" })).toBeVisible();
    await page.goto("./");
    await expect(today.getByRole("button", { name: /Ana Agenda/ })).toContainText("Atendida");
  });

  test("AG2 cambiar y anular una cita desde la ficha", async ({ page }) => {
    await createPatient(page, { name: "Clara Cambia" });
    await giveAppointment(page, "Clara Cambia", "2026-10-22T09:00");
    await page.getByRole("button", { name: /Próxima cita/ }).click();
    const sheet = page.getByRole("dialog", { name: "Cita de Clara Cambia" });
    await sheet.getByRole("button", { name: "Cambiar el día o la hora" }).click();
    const edit = page.getByRole("dialog", { name: "Cambiar la cita" });
    await edit.getByLabel("Día y hora").fill("2026-10-23T17:15");
    await edit.getByRole("button", { name: "Guardar el cambio" }).click();
    await expect(page.getByRole("button", { name: /Próxima cita: .*17:15/ })).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("region", { name: "Próximas citas" })).toContainText("Clara Cambia");
    await page.getByRole("link", { name: /Clara Cambia/ }).first().click();
    await page.getByRole("button", { name: /Próxima cita/ }).click();
    await page.getByRole("dialog", { name: "Cita de Clara Cambia" }).getByRole("button", { name: "Anular" }).click();
    await expect(page.getByRole("button", { name: "Dar cita" })).toBeVisible();
  });

  test("AG3 repetir el tratamiento, sesiones previstas e informe de alta", async ({ page }) => {
    await createPatient(page, { name: "Diego Alta" });
    await tab(page, "Anamnesis").click();
    await page.getByLabel("Motivo principal").fill("Dolor lumbar");
    await page.locator("fieldset", { hasText: "Intensidad (EVA 0-10)" }).getByText("7", { exact: true }).click();
    await page.getByLabel("Diagnóstico fisioterapéutico (criterio del profesional)").fill("Lumbalgia mecánica");
    await page.getByLabel("Sesiones previstas (o del bono)").fill("2");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();

    // Primera sesión.
    await tab(page, "Resumen").click();
    await add(page, "Sesión").click();
    await expect(page.getByText("Diego Alta · sesión 1 de 2")).toBeVisible();
    await page.getByLabel("Tratamiento").fill("Movilización lumbar y ejercicio de control motor");
    await page.getByLabel("Plan y ejercicios para casa").fill("Puente glúteo 3×10");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("1 de 2 sesiones")).toBeVisible();
    await expect(page.getByText("Queda 1")).toBeVisible();

    // Segunda: repite el tratamiento con un toque.
    await page.getByRole("link", { name: "Nueva sesión" }).click();
    await expect(page.getByText("Diego Alta · sesión 2 de 2")).toBeVisible();
    await page.getByLabel("Fecha y hora").fill("2026-10-27T10:00");
    await page.getByRole("button", { name: /Repetir el tratamiento de la última sesión/ }).click();
    await expect(page.getByLabel("Tratamiento")).toHaveValue("Movilización lumbar y ejercicio de control motor");
    await expect(page.getByLabel("Plan y ejercicios para casa")).toHaveValue("Puente glúteo 3×10");
    await page.locator("fieldset", { hasText: "Dolor hoy" }).getByText("2", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Hechas todas")).toBeVisible();
    await expectAccessible(page);

    // Dar por terminado el motivo lleva a su informe de alta.
    await page.getByRole("button", { name: /Motivo:/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: "Dar por terminado" }).click();
    await expect(page.getByRole("heading", { name: "Informe de alta" })).toBeVisible();
    const report = page.getByRole("article", { name: "Informe de alta" });
    await expect(report).toContainText("Lumbalgia mecánica");
    await expect(report.getByRole("row", { name: /Dolor \(EVA 0-10\) 7 2 Mejor/ })).toBeVisible();
    await expect(report).toContainText("Movilización lumbar y ejercicio de control motor");
    await page.getByLabel("Recomendaciones al alta").fill("Seguir con el puente glúteo 3 días por semana.");
    await page.getByRole("button", { name: "Guardar las recomendaciones" }).click();
    await expect(report).toContainText("Seguir con el puente glúteo 3 días por semana.");
    await expectAccessible(page);
    await page.reload();
    await expect(page.getByRole("article", { name: "Informe de alta" })).toContainText("Seguir con el puente glúteo");
  });

  test("AG4 agenda como Google Calendar: arrastrar una cita, deshacer, crear en un hueco y moverla una semana", async ({ page }) => {
    await createPatient(page, { name: "Eva Mueve" });
    await giveAppointment(page, "Eva Mueve", "2026-10-20T12:00");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Agenda" }).click();
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Martes, 20 de octubre" })).toBeVisible();
    const event = page.getByRole("button", { name: /^Eva Mueve\s*,\s*12:00–12:45/ });
    await expect(event).toBeVisible();
    await expectAccessible(page);

    // Arrastrar una hora hacia abajo (56 px por hora).
    const box = (await event.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 30, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + 56, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: /^Eva Mueve\s*,\s*13:00–13:45/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Movida" })).toContainText("Eva Mueve");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByRole("button", { name: /^Eva Mueve\s*,\s*12:00–12:45/ })).toBeVisible();

    // Moverla una semana desde su hoja.
    await page.getByRole("button", { name: /^Eva Mueve\s*,\s*12:00–12:45/ }).click();
    await page.getByRole("dialog", { name: "Cita de Eva Mueve" }).getByRole("group", { name: "Mover la cita" }).getByRole("button", { name: "1 semana después" }).click();
    await expect(page.getByRole("button", { name: /Eva Mueve/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Día siguiente" }).click();
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
    await page.getByRole("button", { name: "Semana siguiente" }).click();
    await expect(page.getByRole("button", { name: /^Eva Mueve\s*,\s*12:00–12:45/ })).toBeVisible();

    // Una cita nueva desde el botón, eligiendo el paciente.
    await page.getByRole("button", { name: "Hoy" }).click();
    await page.getByRole("button", { name: "Nueva cita" }).click();
    const sheet = page.getByRole("dialog", { name: "Nueva cita" });
    await sheet.getByLabel("Paciente", { exact: true }).fill("eva");
    await sheet.getByRole("list", { name: "Pacientes" }).getByRole("button", { name: "Eva Mueve" }).click();
    await expect(sheet.getByText("Paciente: Eva Mueve")).toBeVisible();
    await sheet.getByLabel("Día y hora").fill("2026-10-21T16:30");
    await sheet.getByRole("button", { name: "Dar la cita" }).click();
    await expect(page.getByRole("button", { name: /^Eva Mueve\s*,\s*16:30–17:15/ })).toBeVisible();
    await expectAccessible(page);
  });

  test("AG5 más sencilla: ir a una fecha, tocar un hueco, crear el paciente ahí mismo, una serie semanal y aviso si se pisa", async ({ page }) => {
    await page.goto("./agenda");
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
    await page.getByLabel("Ir a una fecha").fill("2026-10-27");
    await expect(page.getByRole("heading", { name: "Martes, 27 de octubre" })).toBeVisible();

    // Tocar el hueco de las 10:00 abre directamente la cita; el paciente nuevo se crea con su nombre, sin salir.
    await page.locator('[data-day="2026-10-27"]').click({ position: { x: 30, y: 3 * 56 + 5 } });
    const sheet = page.getByRole("dialog", { name: "Nueva cita" });
    await expect(sheet.getByLabel("Día y hora")).toHaveValue("2026-10-27T10:00");
    await sheet.getByLabel("Paciente", { exact: true }).fill("Nuria Nueva");
    await sheet.getByRole("button", { name: "Paciente nuevo: «Nuria Nueva»" }).click();
    await expect(sheet.getByText("Paciente: Nuria Nueva")).toBeVisible();
    await sheet.getByLabel("Repetir").selectOption("3");
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Dar las 3 citas" }).click();
    await expect(page.getByText(/3 citas dadas, una por semana hasta el/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Nuria Nueva\s*,\s*10:00–10:45/ })).toBeVisible();
    await page.getByLabel("Ir a una fecha").fill("2026-11-10");
    await expect(page.getByRole("button", { name: /^Nuria Nueva\s*,\s*10:00–10:45/ })).toBeVisible();

    // Otra cita que se pisa con la suya: avisa, y se puede dar igualmente.
    await page.getByRole("button", { name: "Nueva cita" }).click();
    await sheet.getByLabel("Día y hora").fill("2026-11-10T10:15");
    await sheet.getByLabel("Paciente", { exact: true }).fill("Otro Paciente");
    await sheet.getByRole("button", { name: "Paciente nuevo: «Otro Paciente»" }).click();
    await expect(sheet.getByText("Paciente: Otro Paciente")).toBeVisible();
    await sheet.getByRole("button", { name: "Dar la cita" }).click();
    await expect(sheet.getByText("A esa hora ya hay una cita")).toBeVisible();
    await expect(sheet.getByText(/Nuria Nueva, /)).toBeVisible();
    await sheet.getByRole("button", { name: "Darla igualmente" }).click();
    await expect(page.getByRole("button", { name: /^Otro Paciente\s*,\s*10:15–11:00/ })).toBeVisible();
  });
});
