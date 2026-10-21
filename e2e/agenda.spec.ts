// Agenda y seguimiento (src/data/appointments.ts y src/clinical): citas sin sesión, la agenda de hoy en Pacientes
// (atendida, no vino), repetir el tratamiento de la última sesión, las sesiones previstas (bono) y el informe de alta.
import type { Locator, Page } from "@playwright/test";
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
    await sheet.getByText("Mover o cambiar la cita").click();
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
    await page.getByRole("dialog", { name: "Cita de Clara Cambia" }).getByRole("button", { name: "Sí, anular" }).click();
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
    await page.getByRole("dialog", { name: "Cita de Eva Mueve" }).getByText("Mover o cambiar la cita").click();
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

  test("AG6 recordatorios: las citas de mañana con su WhatsApp listo; recordada, confirmada y el mensaje de la clínica", async ({ page }) => {
    // Pacientes y citas desde un CSV (lo más rápido para la prueba).
    await page.goto("./ajustes/importar");
    await page.getByLabel("Elegir el archivo de pacientes").setInputFiles({
      name: "p.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Nombre;Teléfono;Correo\r\nAna Ruiz;612 345 678;\r\nLuis Correo;;luis@correo.test\r\n", "utf8"),
    });
    await page.getByRole("button", { name: "Importar 2 pacientes" }).click();
    await page.getByRole("radio", { name: /Citas/ }).click();
    await page.getByLabel("Elegir el archivo de citas").setInputFiles({
      name: "c.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Paciente;Fecha;Hora\r\nAna Ruiz;21/10/2026;10:00\r\nLuis Correo;21/10/2026;11:30\r\n", "utf8"),
    });
    await page.getByRole("button", { name: "Importar 2 citas" }).click();
    await expect(page.getByText("2 citas importadas")).toBeVisible();

    await page.goto("./agenda");
    await page.getByRole("link", { name: /Recordatorios\s*2 de mañana sin recordar/ }).click();
    await expect(page.getByRole("heading", { name: /miércoles, 21 de octubre/i })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "2 citas pendientes" })).toContainText("0 recordadas");
    const ana = page.getByRole("group", { name: "10:00 · Ana Ruiz" });
    const wa = ana.getByRole("link", { name: "WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/34612345678\?text=Hola%2C%20Ana\.%20Te%20recordamos/);
    await expect(ana.getByText("Sin permiso de contacto registrado")).toBeVisible();
    await expectAccessible(page);
    // Al tocar WhatsApp (aquí sin abrirlo), queda recordada.
    await wa.evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
    await wa.click();
    await expect(ana.getByText(/Recordada a las/)).toBeVisible();
    const luis = page.getByRole("group", { name: "11:30 · Luis Correo" });
    await expect(luis.getByRole("link", { name: "Correo" })).toHaveAttribute("href", /^mailto:luis@correo\.test\?subject=Recordatorio/);
    await luis.getByRole("button", { name: "Ha confirmado que viene" }).click();
    await expect(luis.getByText("Confirmada")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "2 citas pendientes" })).toContainText("1 recordada · 1 confirmada");

    // El mensaje es de la clínica: se cambia una vez.
    await page.getByRole("button", { name: "Cambiar el mensaje" }).click();
    await page.getByRole("dialog").getByLabel("Texto").fill("Cita el {dia} a las {hora}, {nombre}");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar el mensaje" }).click();
    await expect(wa).toHaveAttribute("href", /text=Cita%20el%20mi%C3%A9rcoles%2C%2021%20de%20octubre%20a%20las%2010%3A00%2C%20Ana$/);

    // En la agenda, la cita dice que está confirmada.
    await page.goto("./agenda");
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
    await page.getByRole("button", { name: /^Luis Correo\s*,\s*11:30/ }).click();
    await expect(page.getByRole("dialog", { name: "Cita de Luis Correo" }).getByText("Confirmada")).toBeVisible();
  });

  test("AG7 justificante de asistencia desde la cita: día, hora, DNI y para qué, listo para imprimir o PDF", async ({ page }) => {
    await page.goto("./ajustes/clinica");
    await page.getByLabel("Clínica (nombre o razón social)").fill("Fisiolab Centro");
    await page.getByLabel("Fisioterapeuta", { exact: true }).fill("Ana Ruiz");
    await page.getByLabel("Nº de colegiado").fill("1234");
    await page.getByLabel("Localidad").fill("Sevilla");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText(/guardad/i).first()).toBeVisible();
    await createPatient(page, { name: "Eva Justifica" });
    await giveAppointment(page, "Eva Justifica", "2026-10-20T09:00");
    await page.goto("./agenda");
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
    await page.getByRole("button", { name: /^Eva Justifica\s*,\s*09:00/ }).click();
    await page.getByRole("dialog", { name: "Cita de Eva Justifica" }).getByRole("link", { name: "Justificante de asistencia" }).click();
    await page.getByLabel("DNI o NIE del paciente (opcional)").fill("12345678Z");
    await page.getByLabel("Para qué es (opcional)").fill("a petición de la interesada, para presentar en su empresa");
    const doc = page.getByRole("article", { name: "Justificante de asistencia" });
    await expect(doc).toContainText("Ana Ruiz, fisioterapeuta con nº de colegiado 1234 de Fisiolab Centro, hace constar que Eva Justifica, con DNI/NIE 12345678Z, ha asistido a consulta de fisioterapia el martes, 20 de octubre de 2026, de 09:00 a 09:45.");
    await expect(doc).toContainText("Se expide a petición de la interesada, para presentar en su empresa.");
    await expect(doc).toContainText("se firma en Sevilla");
    await expectAccessible(page);
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar en PDF" }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/^Justificante Eva Justifica 2026-10-20\.pdf$/);
  });

  test("AG8 la clínica en números: sesiones, ausencias y la gráfica de cada mes", async ({ page }) => {
    await page.goto("./ajustes/importar");
    await page.getByRole("radio", { name: /Historial de sesiones/ }).click();
    await page.getByLabel("Elegir el archivo de historial de sesiones").setInputFiles({
      name: "h.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Paciente;Fecha\r\nAna Ruiz;02/10/2026 09:00\r\nAna Ruiz;09/10/2026 09:00\r\nLuis Gil;05/10/2026 10:00\r\nLuis Gil;05/09/2026 10:00\r\n", "utf8"),
    });
    await page.getByRole("button", { name: "Importar 4 sesiones" }).click();
    await page.getByRole("radio", { name: /Citas/ }).click();
    await page.getByLabel("Elegir el archivo de citas").setInputFiles({
      name: "c.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Paciente;Fecha;Estado\r\nAna Ruiz;02/10/2026 09:00;atendida\r\nLuis Gil;06/10/2026 10:00;no vino\r\nLuis Gil;07/10/2026 10:00;atendida\r\nLuis Gil;08/10/2026 10:00;atendida\r\n", "utf8"),
    });
    await page.getByRole("button", { name: "Importar 4 citas" }).click();
    await expect(page.getByText("4 citas importadas")).toBeVisible();

    await page.goto("./ajustes");
    await page.getByRole("link", { name: /La clínica en números/ }).click();
    await expect(page.getByRole("heading", { name: "La clínica en números" })).toBeVisible();
    const tiles = page.locator("dl").first();
    await expect(tiles.getByText("Sesiones").locator("..")).toContainText("3");
    await expect(tiles.getByText("Pacientes atendidos").locator("..")).toContainText("2");
    await expect(tiles.getByText("Ausencias").locator("..")).toContainText("25 %");
    await expect(page.getByRole("img", { name: "Sesiones por mes; este mes, 3" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Este año" }).click();
    await expect(tiles.getByText("Sesiones").locator("..")).toContainText("4");
  });
  test("AG9 de semana a día con un toque: la semana cabe en el móvil y tocar un día lo abre solo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createPatient(page, { name: "Vera Vista" });
    await giveAppointment(page, "Vera Vista", "2026-10-22T10:00");
    await page.goto("./agenda");
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
    await expect(page.getByRole("heading", { name: /19 oct – 25 oct 2026/ })).toBeVisible();
    // Los siete días se ven sin desplazarse a los lados.
    const grid = page.getByRole("button", { name: /^Dom 25\s*, ver solo este día$/ });
    await expect(grid).toBeInViewport();
    await page.getByRole("button", { name: /^Jue 22\s*, ver solo este día$/ }).click();
    await expect(page.getByRole("heading", { name: "Jueves, 22 de octubre" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Vera Vista/ })).toBeVisible();
    await expectAccessible(page);
  });
  test.describe("en un móvil táctil", () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test("AG10 pellizco: se centra en el día que queda entre los dedos (el viernes, no hoy)", async ({ page }) => {
      await createPatient(page, { name: "Pablo Pellizco" });
      await giveAppointment(page, "Pablo Pellizco", "2026-10-23T10:00");
      await page.goto("./agenda");
      await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
      await expect(page.getByRole("heading", { name: /19 oct – 25 oct 2026/ })).toBeVisible();

      /** Dos dedos que se separan (o se juntan) sobre la columna de ese día. */
      const pinch = async (over: Locator, from: number, to: number) => {
        const box = (await over.boundingBox())!;
        await page.evaluate(
          ({ x, y, from, to }) => {
            const el = document.elementFromPoint(x, y)!;
            const fire = (type: string, d: number) => {
              const t = [1, 2].map((id) => new Touch({ identifier: id, target: el, clientX: x + (id === 1 ? -d / 2 : d / 2), clientY: y }));
              el.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : t, changedTouches: t, bubbles: true, cancelable: true }));
            };
            fire("touchstart", from);
            fire("touchmove", (from + to) / 2);
            fire("touchmove", to);
            fire("touchend", to);
          },
          { x: box.x + box.width / 2, y: box.y + box.height + 60, from, to },
        );
      };

      // Separar los dedos sobre el viernes: 3 días con el viernes en medio, y después solo el viernes.
      const friday = page.getByRole("button", { name: /^Vie 23\s*, ver solo este día$/ });
      await pinch(friday, 20, 120);
      await expect(page.getByRole("heading", { name: /22 oct – 24 oct 2026/ })).toBeVisible();
      await pinch(friday, 20, 120);
      await expect(page.getByRole("heading", { name: "Viernes, 23 de octubre" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Pablo Pellizco/ })).toBeVisible();

      // Juntarlos vuelve a 3 días alrededor del viernes y a su semana.
      await pinch(page.getByText("Vie", { exact: true }), 160, 40);
      await expect(page.getByRole("heading", { name: /22 oct – 24 oct 2026/ })).toBeVisible();
      await pinch(friday, 160, 40);
      await expect(page.getByRole("heading", { name: /19 oct – 25 oct 2026/ })).toBeVisible();
    });
  });
});
