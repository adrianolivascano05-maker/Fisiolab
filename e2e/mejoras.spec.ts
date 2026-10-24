// Mejoras frente a la competencia (replica/fixes.md): mapa del dolor (cuestionario), bonos y cobros, lista de espera
// y hoja de ejercicios para casa.
import type { Page } from "@playwright/test";
import { add, createPatient, expect, expectAccessible, test } from "./fixtures";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });

/** Pacientes (con teléfono) y citas desde un CSV: lo más rápido para la prueba. */
async function importData(page: Page, patients: string, appointments?: string) {
  await page.goto("./ajustes/importar");
  await page.getByLabel("Elegir el archivo de pacientes").setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(patients, "utf8") });
  await page.getByRole("button", { name: /^Importar \d+ pacientes?$/ }).click();
  await expect(page.getByText(/pacientes? importados?/)).toBeVisible();
  if (!appointments) return;
  await page.getByRole("radio", { name: /Citas/ }).click();
  await page.getByLabel("Elegir el archivo de citas").setInputFiles({ name: "c.csv", mimeType: "text/csv", buffer: Buffer.from(appointments, "utf8") });
  await page.getByRole("button", { name: /^Importar \d+ citas?$/ }).click();
  await expect(page.getByText(/citas? importadas?/)).toBeVisible();
}

test.describe("Mejoras frente a la competencia", () => {
  // Un martes a las 10:00 en Madrid.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("MJ1 anamnesis limpia, todos los tests de cada zona y el mapa del dolor como cuestionario", async ({ page }) => {
    await createPatient(page, { name: "Marta Mapa" });
    await tab(page, "Anamnesis").click();
    // Para escribir: sin mapa ni opciones para elegir, salvo zona, lado, banderas rojas y precauciones.
    await expect(page.getByText("Mapa del dolor")).toHaveCount(0);
    await page.getByLabel("Forma de inicio").fill("Progresivo, tras empezar a nadar");
    const zona = page.getByRole("group", { name: "Zona", exact: true });
    await zona.getByText("Hombro", { exact: true }).click();
    await zona.getByText("ATM", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();
    await expect(page.getByText("Progresivo, tras empezar a nadar")).toBeVisible();

    // Valoración › Registrar un test: cada zona con todos sus tests, la segunda también, arriba del todo.
    await tab(page, "Valoración").click();
    await page.getByRole("link", { name: "Registrar un test" }).click();
    await expect(page.getByRole("heading", { name: /^Tests de Hombro \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Tests de ATM \(\d+\)$/ })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Volver a Valoración" }).click();
    await tab(page, "Resumen").click();
    await add(page, "Cuestionario").click();
    await page.getByRole("button", { name: /Mapa del dolor/ }).click();
    const map = page.locator("fieldset", { has: page.getByText("Zonas", { exact: true }) });
    const front = map.getByRole("group", { name: "De frente" });
    const back = map.getByRole("group", { name: "De espaldas" });
    await front.getByRole("checkbox", { name: "Hombro derecho" }).click();
    await expect(front.getByRole("checkbox", { name: "Hombro derecho" })).toBeChecked();
    // Un dibujo cada vez, grande; de espaldas el hombro derecho es el mismo: sale marcado también.
    await map.getByRole("group", { name: "Vista" }).getByRole("button", { name: /De espaldas/ }).click();
    await expect(back.getByRole("checkbox", { name: "Hombro derecho" })).toBeChecked();
    await map.getByLabel("Al tocar una zona, marcar").getByText("Hormigueo").click();
    await back.getByRole("checkbox", { name: "Lumbar" }).press("Space");
    await map.getByLabel("Intensidad en: Hombro derecho").selectOption("6");
    await map.getByLabel("Zona de la lista").selectOption({ label: "Rodilla izquierda" });
    await map.getByRole("button", { name: "Añadir", exact: true }).click();
    await map.getByLabel("Qué tiene en: Rodilla izquierda").selectOption("dolor");
    await expect(map.getByRole("list", { name: "Zonas marcadas" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Intensidad más alta: 6/10")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    const list = page.getByRole("list", { name: "Cuestionarios" });
    await expect(list).toContainText("Mapa del dolor");
    await expect(list).toContainText("6/10");

    const text = "Hombro derecho: dolor 6/10; Lumbar: hormigueo; Rodilla izquierda: dolor";
    await page.goto(page.url().replace(/\/(cuestionarios|valoracion).*$/, ""));
    await page.getByRole("link", { name: /^Informe(?! de alta)/ }).click();
    const report = page.getByRole("article", { name: "Informe" });
    await expect(report).toContainText(text);
    await expect(report.getByRole("img", { name: `De espaldas: ${text}` })).toBeVisible();
  });

  test("MJ2 bonos y cobros: precio de la sesión, vender un bono, las sesiones lo gastan, cobrar y lo pendiente", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Precios y cobros/ }).click();
    await page.getByLabel("Precio de la sesión suelta").fill("40");
    await page.getByRole("button", { name: "Guardar el precio" }).click();
    await expect(page.getByText(/Sesión suelta: 40,00/)).toBeVisible();

    await createPatient(page, { name: "Bea Bono" });
    const url = page.url();
    await page.getByRole("link", { name: /Bonos y cobros/ }).click();
    await expect(page.getByRole("status")).toHaveText("Al día");
    await page.getByRole("button", { name: "Vender un bono" }).click();
    const sheet = page.getByRole("dialog", { name: "Vender un bono" });
    await sheet.getByLabel("Sesiones").fill("5");
    await expect(sheet.getByLabel("Nombre")).toHaveValue("Bono 5 sesiones");
    await expect(sheet.getByLabel("Precio")).toHaveValue("200");
    await sheet.getByLabel("Precio").fill("180");
    await sheet.getByLabel("¿Lo ha pagado ya?").selectOption({ label: "Sí, bizum" });
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Guardar el bono" }).click();
    await expect(page.getByRole("group", { name: "Bono 5 sesiones" })).toContainText("0 de 5 usadas · quedan 5");

    // Dos sesiones: gastan el bono.
    for (let i = 0; i < 2; i++) {
      await page.goto(`${url}/sesiones/nueva`);
      await page.getByLabel("Tratamiento").fill("Terapia manual");
      await page.getByRole("button", { name: "Guardar sesión" }).click();
      await expect(page.getByText("Sesión registrada")).toBeVisible();
    }
    await page.goto(url);
    await expect(page.getByRole("link", { name: /Bonos y cobros/ })).toContainText("Bono 5 sesiones: quedan 3 de 5");
    await page.getByRole("link", { name: /Bonos y cobros/ }).click();
    await expect(page.getByRole("group", { name: "Bono 5 sesiones" })).toContainText("2 de 5 usadas · quedan 3");
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar" });
    await pay.getByLabel("Cantidad").fill("25,50");
    await pay.getByText("Efectivo").click();
    await pay.getByRole("button", { name: "Guardar el cobro" }).click();
    await expect(page.getByText("Pagado a cuenta")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/25,50/);
    await expectAccessible(page);

    await page.goto("./ajustes/cobros");
    await expect(page.getByText(/Cobrado en octubre/).locator("..")).toContainText(/205,50.*Efectivo 25,50.*Bizum 180,00|205,50.*Bizum 180,00.*Efectivo 25,50/);
    await page.getByRole("link", { name: /Pendiente de cobro/ }).click();
    await expect(page.getByText("Nadie tiene nada pendiente")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a Hoy" })).toBeVisible();
  });

  test("MJ3 lista de espera: al anular una cita, ofrecer el hueco por WhatsApp y darle la cita", async ({ page }) => {
    await importData(page, "Nombre;Teléfono\r\nCarlos Cita;600 111 222\r\nDana Espera;611 222 333\r\n", "Paciente;Fecha;Hora\r\nCarlos Cita;21/10/2026;10:00\r\n");
    await page.goto("./agenda");
    await page.getByRole("link", { name: /Lista de espera/ }).click();
    await page.getByRole("button", { name: "Añadir a la lista" }).click();
    const sheet = page.getByRole("dialog", { name: "Añadir a la lista de espera" });
    await sheet.getByLabel("Paciente", { exact: true }).fill("Dana");
    await sheet.getByRole("button", { name: "Dana Espera" }).click();
    await sheet.getByLabel("Nota (opcional)").fill("Por las mañanas");
    await sheet.getByRole("button", { name: "Añadir a la lista" }).click();
    await expect(page.getByRole("group", { name: "Dana Espera" })).toContainText("Por las mañanas");
    await expectAccessible(page);

    // Carlos anula su cita de mañana: la hoja ofrece el hueco.
    await page.goto("./");
    await page.getByRole("link", { name: /Carlos Cita/ }).first().click();
    await page.getByRole("button", { name: /Próxima cita/ }).click();
    const cita = page.getByRole("dialog", { name: "Cita de Carlos Cita" });
    await cita.getByRole("button", { name: "Anular" }).click();
    await cita.getByRole("button", { name: "Sí, anular" }).click();
    const freed = page.getByRole("dialog", { name: "Hueco libre" });
    await expect(freed.getByText("Hay 1 paciente en la lista de espera")).toBeVisible();
    await expectAccessible(page);
    await freed.getByRole("link", { name: "Ofrecer el hueco" }).click();
    await expect(page.getByText("Hueco libre: miércoles, 21 de octubre, a las 10:00")).toBeVisible();
    const dana = page.getByRole("group", { name: "Dana Espera" });
    await expect(dana.getByRole("link", { name: "Ofrecer por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/34611222333\?text=Hola%2C%20Dana\.%20Se%20ha%20quedado%20libre/);
    await expectAccessible(page);
    await dana.getByRole("button", { name: "Darle la cita" }).click();
    await expect(page.getByText(/Cita dada a Dana Espera/)).toBeVisible();
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Hoy" }).click();
    await page.getByRole("link", { name: /Lista de espera/ }).click();
    await expect(page.getByText("No hay nadie esperando.")).toBeVisible();
  });

  test("MJ4 hoja de ejercicios: biblioteca con ejemplos, la hoja del paciente, PDF y WhatsApp", async ({ page }) => {
    // Las hojas de ejercicios están ocultas (src/app/features.ts): sin enlace, pero la página sigue.
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Biblioteca de ejercicios/ })).toHaveCount(0);
    await page.goto("./ajustes/ejercicios");
    await page.getByRole("button", { name: "Añadir ejemplos para empezar" }).click();
    await expect(page.getByText(/14 ejemplos añadidos/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lumbar" })).toBeVisible();
    await expectAccessible(page);

    await importData(page, "Nombre;Teléfono\r\nElena Ejercicios;622 333 444\r\n");
    await page.goto("./");
    await page.getByRole("link", { name: /Elena Ejercicios/ }).first().click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);
    await page.goto(`${page.url()}/ejercicios`);
    await page.getByRole("button", { name: "Añadir de la biblioteca" }).click();
    const lib = page.getByRole("dialog", { name: "Biblioteca de ejercicios" });
    await lib.getByRole("button", { name: "Lumbar" }).click();
    await lib.getByText("Puente de glúteo").click();
    await lib.getByText("Gato-camello").click();
    await lib.getByRole("button", { name: "Añadir 2 ejercicios" }).click();
    await page.getByRole("button", { name: "Escribir uno" }).click();
    await page.getByLabel("Ejercicio 3").fill("Caminar");
    await page.getByLabel("Dosis").fill("30 minutos al día");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar la hoja" }).click();

    const doc = page.getByRole("article", { name: "Hoja de ejercicios" });
    await expect(doc.getByRole("listitem")).toHaveCount(3);
    await expect(doc).toContainText("Puente de glúteo3 series de 10");
    await expect(doc).toContainText("Caminar30 minutos al día");
    await expect(page.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/34622333444\?text=Hola%2C%20Elena\.%20Tus%20ejercicios/);
    await expectAccessible(page);
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Guardar en PDF" }).click()]);
    expect(pdf.suggestedFilename()).toBe("Ejercicios Elena Ejercicios 2026-10-20.pdf");
  });

  test("MJ5 cobrar en el momento: bonos de la clínica, la sesión gasta el bono, cobrar desde la cita, recibo y Excel", async ({ page }) => {
    await page.goto("./ajustes/cobros");
    await page.getByLabel("Precio de la sesión suelta").fill("40");
    await page.getByRole("button", { name: "Guardar el precio" }).click();
    await expect(page.getByText(/Sesión suelta: 40,00/)).toBeVisible();
    await page.getByRole("button", { name: "Añadir un bono" }).click();
    const preset = page.getByRole("dialog", { name: "Nuevo bono de la clínica" });
    await preset.getByLabel("Sesiones").fill("5");
    await preset.getByLabel("Precio").fill("180");
    await preset.getByLabel("Caduca a los (opcional)").fill("3");
    await preset.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("list", { name: "Bonos de la clínica" })).toContainText(/5 sesiones · 180,00\s€ · caduca a los 3 meses/);
    await expectAccessible(page);

    await importData(page, "Nombre;Teléfono\r\nPablo Pago;600 333 444\r\nQuique Suelto;600 444 555\r\n", "Paciente;Fecha;Hora\r\nQuique Suelto;20/10/2026;09:00\r\n");
    await page.goto("./");
    await page.getByRole("link", { name: /Pablo Pago/ }).first().click();
    const url = page.url();
    await page.getByRole("link", { name: /Bonos y cobros/ }).click();
    await page.getByRole("button", { name: "Vender un bono" }).click();
    const sell = page.getByRole("dialog", { name: "Vender un bono" });
    await expect(sell.getByRole("radio", { name: /Bono 5 sesiones · 180,00/ })).toBeChecked();
    await expect(sell.getByLabel("Caduca (opcional)")).toHaveValue("2027-01-19");
    await sell.getByLabel("¿Lo ha pagado ya?").selectOption({ label: "Sí, tarjeta" });
    await sell.getByRole("button", { name: "Guardar el bono" }).click();
    await expect(page.getByRole("group", { name: "Bono 5 sesiones" })).toContainText("caduca el 19 ene 2027");

    // Al apuntar la sesión ya se ve qué la paga.
    await page.goto(`${url}/sesiones/nueva`);
    await expect(page.getByText("Del «Bono 5 sesiones»: después de esta, quedan 4 de 5")).toBeVisible();
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Sesión registrada · bono: quedan 4 de 5")).toBeVisible();

    // El recibo del cobro: la cantidad en letra, la forma de pago y que no es una factura.
    await page.goto(`${url}/cobros`);
    await page.getByRole("link", { name: /Recibo del cobro de 180,00/ }).click();
    const receipt = page.getByRole("article", { name: "Recibo" });
    await expect(receipt).toContainText(/ha recibido de Pablo Pago la cantidad de 180,00\s€ \(ciento ochenta euros\)/);
    await expect(receipt).toContainText("Forma de pago: tarjeta.");
    await expect(receipt).toContainText("no es una factura");
    await expectAccessible(page);
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Guardar en PDF" }).click()]);
    expect(pdf.suggestedFilename()).toBe("Recibo Pablo Pago 2026-10-20.pdf");

    // Cobrar desde la cita de hoy (sesión suelta), en Agenda › Hoy.
    await page.goto("./agenda");
    await page.getByRole("region", { name: "Citas de hoy" }).getByRole("button", { name: /^\d\d:\d\d · Quique Suelto/ }).click();
    const cita = page.getByRole("dialog", { name: "Cita de Quique Suelto" });
    // Importada ya pasada, entra como atendida: el justificante, sí; «Atender», no.
    await expect(cita.getByRole("link", { name: "Justificante de asistencia" })).toBeVisible();
    await cita.getByRole("button", { name: "Cobrar" }).click();
    await expect(cita.getByLabel("Cantidad")).toHaveValue("40");
    await cita.getByText("Bizum").click();
    await cita.getByRole("button", { name: "Cobrar" }).click();
    await expect(page.getByText(/Cobrado: 40,00/)).toBeVisible();
    await expect(cita.getByText(/Cuenta: .*a cuenta 40,00/)).toBeVisible();

    // Para la gestoría: los cobros del mes en Excel.
    await page.goto("./ajustes/cobros");
    await expect(page.getByText(/Cobrado en octubre/).locator("..")).toContainText("220,00");
    await page.getByRole("link", { name: /Cobros para la gestoría/ }).click();
    await expect(page.getByRole("heading", { name: "Para facturar" })).toBeVisible();
    const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar en Excel" }).click()]);
    expect(xlsx.suggestedFilename()).toBe("Cobros 2026-10.xlsx");
  });

  test("MJ6 lista de espera con horario: desde la ficha, a quién le encaja el hueco y a quién se le ofreció", async ({ page }) => {
    await importData(
      page,
      "Nombre;Teléfono\r\nCarlos Cita;600 111 222\r\nDana Tarde;611 222 333\r\nElsa Manana;622 333 444\r\n",
      "Paciente;Fecha;Hora\r\nCarlos Cita;21/10/2026;10:00\r\n",
    );
    // Desde la ficha de Dana: se abre ya con ella.
    await page.goto("./");
    await page.getByRole("link", { name: /Dana Tarde/ }).first().click();
    await page.getByRole("link", { name: /Lista de espera/ }).click();
    const add = page.getByRole("dialog", { name: "Añadir a la lista de espera" });
    await expect(add.getByText("Paciente: Dana Tarde")).toBeVisible();
    await add.getByText("Tardes", { exact: true }).click();
    await add.getByRole("button", { name: "Añadir a la lista" }).click();
    await expect(page.getByRole("group", { name: "Dana Tarde" })).toContainText("Tardes");
    // Elsa: mañanas de miércoles.
    await page.getByRole("button", { name: "Añadir a la lista" }).click();
    await add.getByLabel("Paciente", { exact: true }).fill("Elsa");
    await add.getByRole("button", { name: /Elsa Manana/ }).click();
    await add.getByText("Mañanas", { exact: true }).click();
    await add.getByLabel("miércoles").check({ force: true });
    await add.getByRole("button", { name: "Añadir a la lista" }).click();
    await expect(page.getByRole("group", { name: "Elsa Manana" })).toContainText("Mañanas, miércoles");
    await expectAccessible(page);

    // Carlos anula el miércoles a las 10:00: primero sale Elsa, a quien le encaja.
    await page.goto("./");
    await page.getByRole("link", { name: /Carlos Cita/ }).first().click();
    await page.getByRole("button", { name: /Próxima cita/ }).click();
    const cita = page.getByRole("dialog", { name: "Cita de Carlos Cita" });
    await cita.getByRole("button", { name: "Anular" }).click();
    await cita.getByRole("button", { name: "Sí, anular" }).click();
    await page.getByRole("dialog", { name: "Hueco libre" }).getByRole("link", { name: "Ofrecer el hueco" }).click();
    const list = page.getByRole("list", { name: "Lista de espera" });
    await expect(list.getByRole("group")).toHaveCount(2);
    await expect(list.getByRole("group").first()).toHaveAccessibleName("Elsa Manana");
    await expect(page.getByRole("group", { name: "Elsa Manana" })).toContainText("Le encaja este hueco");
    await expect(page.getByRole("group", { name: "Dana Tarde" })).toContainText("No es su horario");
    const wa = page.getByRole("group", { name: "Elsa Manana" }).getByRole("link", { name: "Ofrecer por WhatsApp" });
    await wa.evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
    await wa.click();
    await expect(page.getByRole("group", { name: "Elsa Manana" })).toContainText("Ofrecido el");
    await page.getByRole("group", { name: "Elsa Manana" }).getByRole("button", { name: "Darle la cita" }).click();
    await expect(page.getByText(/Cita dada a Elsa Manana/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Elsa Manana\s*,\s*10:00/ })).toBeVisible();
  });

  test("MJ7 ejercicios: vídeo con código QR, plantilla y la misma hoja para otro paciente", async ({ page }) => {
    await page.goto("./ajustes/ejercicios");
    await page.getByRole("button", { name: "Nuevo ejercicio" }).click();
    const ex = page.getByRole("dialog", { name: "Nuevo ejercicio" });
    await ex.getByLabel("Nombre").fill("Sentadilla en pared");
    await ex.getByLabel("Zona").selectOption({ label: "Rodilla" });
    await ex.getByLabel("Dosis").fill("3 × 30 s");
    await ex.getByLabel("Vídeo (enlace, opcional)").fill("youtu.be/abc123");
    await ex.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("heading", { name: "Rodilla" })).toBeVisible();

    await importData(page, "Nombre;Teléfono\r\nFede Fase;633 444 555\r\nGala Igual;644 555 666\r\n");
    await page.goto("./");
    await page.getByRole("link", { name: /Fede Fase/ }).first().click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);
    await page.goto(`${page.url()}/ejercicios`);
    await page.getByRole("button", { name: "Añadir de la biblioteca" }).click();
    const lib = page.getByRole("dialog", { name: "Biblioteca de ejercicios" });
    await lib.getByLabel("Buscar un ejercicio").fill("pared");
    await lib.getByText("Sentadilla en pared").click();
    await lib.getByRole("button", { name: "Añadir 1 ejercicio" }).click();
    await page.getByRole("button", { name: "Guardar la hoja" }).click();
    const doc = page.getByRole("article", { name: "Hoja de ejercicios" });
    await expect(doc.getByRole("img", { name: "Código QR del vídeo de Sentadilla en pared" })).toBeVisible();
    await expect(doc.getByRole("link", { name: "Ver el vídeo" })).toHaveAttribute("href", "https://youtu.be/abc123");
    await expect(page.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute("href", /V%C3%ADdeo%3A%20https%3A%2F%2Fyoutu\.be%2Fabc123/);
    await page.getByRole("button", { name: "Guardar como plantilla" }).click();
    await page.getByRole("dialog", { name: "Guardar como plantilla" }).getByLabel("Nombre de la plantilla").fill("Rodilla, fase 1");
    await page.getByRole("dialog", { name: "Guardar como plantilla" }).getByRole("button", { name: "Guardar la plantilla" }).click();
    await expect(page.getByText(/Plantilla «Rodilla, fase 1» guardada/)).toBeVisible();

    await page.goto("./");
    await page.getByRole("link", { name: /Gala Igual/ }).first().click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);
    await page.goto(`${page.url()}/ejercicios`);
    await page.getByRole("button", { name: "Usar una plantilla" }).click();
    await page.getByRole("dialog", { name: "Plantillas" }).getByRole("button", { name: /^Rodilla, fase 1/ }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar la hoja" }).click();
    await expect(page.getByRole("article", { name: "Hoja de ejercicios" })).toContainText("Sentadilla en pared3 × 30 s");
  });

  test("MJ8 anamnesis de la clínica: preguntas propias y un paquete por especialidad, en la ficha y el informe", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Anamnesis de la clínica/ }).click();
    await page.getByRole("button", { name: "Suelo pélvico" }).click();
    await expect(page.getByText(/Suelo pélvico: \d preguntas añadidas/)).toBeVisible();
    await page.getByRole("button", { name: "Añadir una pregunta" }).click();
    const q = page.getByRole("dialog", { name: "Nueva pregunta" });
    await q.getByLabel("Apartado").selectOption({ label: "6. Hábitos y estilo de vida" });
    await q.getByLabel("Pregunta").fill("Horas sentado al día");
    await q.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("list", { name: "Preguntas propias: Hábitos y estilo de vida" })).toContainText("Horas sentado al día");
    await expectAccessible(page);

    await createPatient(page, { name: "Nora Propia" });
    await tab(page, "Anamnesis").click();
    await page.locator("fieldset", { hasText: "Escapes de orina" }).getByText("Al esfuerzo").click();
    await page.locator("summary", { hasText: "Hábitos y estilo de vida" }).click();
    await page.getByLabel("Horas sentado al día").fill("8");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Anamnesis guardada")).toBeVisible();
    await expect(page.getByText("Al esfuerzo")).toBeVisible();
    await tab(page, "Resumen").click();
    await page.getByRole("link", { name: /^Informe(?! de alta)/ }).click();
    const report = page.getByRole("article", { name: "Informe" });
    await expect(report).toContainText("Escapes de orina");
    await expect(report).toContainText("Horas sentado al día");
  });
});
