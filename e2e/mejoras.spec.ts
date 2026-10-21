// Mejoras frente a la competencia (replica/fixes.md): mapa del dolor en la anamnesis, bonos y cobros, lista de espera
// y hoja de ejercicios para casa.
import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";

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

  test("MJ1 mapa del dolor: se toca en el dibujo, intensidad, propone zona y lado, y sale en la ficha y el informe", async ({ page }) => {
    await createPatient(page, { name: "Marta Mapa" });
    await tab(page, "Anamnesis").click();
    const map = page.locator("fieldset", { has: page.getByText("Mapa del dolor", { exact: true }) });
    const front = map.getByRole("group", { name: "De frente" });
    const back = map.getByRole("group", { name: "De espaldas" });
    await front.getByRole("checkbox", { name: "Hombro derecho" }).click();
    await expect(front.getByRole("checkbox", { name: "Hombro derecho" })).toBeChecked();
    // De espaldas el hombro derecho es el mismo: sale marcado también.
    await expect(back.getByRole("checkbox", { name: "Hombro derecho" })).toBeChecked();
    await map.getByLabel("Al tocar una zona, marcar").getByText("Hormigueo o adormecimiento").click();
    await back.getByRole("checkbox", { name: "Lumbar" }).press("Space");
    await map.getByLabel("Intensidad en: Hombro derecho").selectOption("6");
    await map.getByLabel("Añadir una zona de la lista").selectOption({ label: "Rodilla izquierda" });
    await map.getByLabel("Qué tiene en: Rodilla izquierda").selectOption("dolor");
    await expect(map.getByRole("list", { name: "Zonas marcadas" }).getByRole("listitem")).toHaveCount(3);
    await expectAccessible(page);

    // Lo marcado propone la zona y el lado para los tests.
    await page.getByRole("button", { name: "Añadir a Zona y Lado" }).click();
    const zona = page.getByRole("group", { name: "Zona", exact: true });
    for (const r of ["Hombro", "Lumbar", "Rodilla"]) await expect(zona.getByRole("checkbox", { name: r, exact: true })).toBeChecked();
    await expect(page.getByRole("group", { name: "Lado", exact: true }).getByRole("radio", { name: "Los dos" })).toBeChecked();
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();

    const text = "Hombro derecho: dolor 6/10; Lumbar: hormigueo; Rodilla izquierda: dolor";
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByRole("img", { name: `De frente: ${text}` })).toBeVisible();
    await expectAccessible(page);
    await tab(page, "Resumen").click();
    await expect(page.getByText(`Mapa del dolor: ${text}`)).toBeVisible();
    await page.getByRole("link", { name: /Informe/ }).click();
    await expect(page.getByRole("article", { name: "Informe" }).getByRole("img", { name: `De espaldas: ${text}` })).toBeVisible();
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
    await page.getByRole("button", { name: "Apuntar un cobro" }).click();
    const pay = page.getByRole("dialog", { name: "Apuntar un cobro" });
    await pay.getByLabel("Cantidad").fill("25,50");
    await pay.getByText("Efectivo").click();
    await pay.getByRole("button", { name: "Guardar el cobro" }).click();
    await expect(page.getByText("Pagado a cuenta")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/25,50/);
    await expectAccessible(page);

    await page.goto("./ajustes/cobros");
    await expect(page.getByText(/Cobrado en octubre/).locator("..")).toContainText(/205,50.*Efectivo 25,50.*Bizum 180,00|205,50.*Bizum 180,00.*Efectivo 25,50/);
    await expect(page.getByText("Nadie tiene nada pendiente.")).toBeVisible();
  });

  test("MJ3 lista de espera: al anular una cita, ofrecer el hueco por WhatsApp y darle la cita", async ({ page }) => {
    await importData(page, "Nombre;Teléfono\r\nCarlos Cita;600 111 222\r\nDana Espera;611 222 333\r\n", "Paciente;Fecha;Hora\r\nCarlos Cita;21/10/2026;10:00\r\n");
    await page.goto("./agenda");
    await page.getByRole("link", { name: /Lista de espera/ }).click();
    await page.getByRole("button", { name: "Añadir a la lista" }).click();
    const sheet = page.getByRole("dialog", { name: "Añadir a la lista de espera" });
    await sheet.getByLabel("Paciente", { exact: true }).fill("Dana");
    await sheet.getByRole("button", { name: "Dana Espera" }).click();
    await sheet.getByLabel("Cuándo le viene bien (opcional)").fill("Por las mañanas");
    await sheet.getByRole("button", { name: "Añadir a la lista" }).click();
    await expect(page.getByRole("group", { name: "Dana Espera" })).toContainText("Le viene bien: Por las mañanas");
    await expectAccessible(page);

    // Carlos anula su cita de mañana: la hoja ofrece el hueco.
    await page.goto("./");
    await page.getByRole("link", { name: /Carlos Cita/ }).first().click();
    await page.getByRole("button", { name: /Próxima cita/ }).click();
    const cita = page.getByRole("dialog", { name: "Cita de Carlos Cita" });
    await cita.getByRole("button", { name: "Anular" }).click();
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
    await page.getByRole("link", { name: /Lista de espera/ }).click();
    await expect(page.getByText("No hay nadie esperando.")).toBeVisible();
  });

  test("MJ4 hoja de ejercicios: biblioteca con ejemplos, la hoja del paciente, PDF y WhatsApp", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Biblioteca de ejercicios/ }).click();
    await page.getByRole("button", { name: "Añadir ejemplos para empezar" }).click();
    await expect(page.getByText(/14 ejemplos añadidos/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lumbar" })).toBeVisible();
    await expectAccessible(page);

    await importData(page, "Nombre;Teléfono\r\nElena Ejercicios;622 333 444\r\n");
    await page.goto("./");
    await page.getByRole("link", { name: /Elena Ejercicios/ }).first().click();
    await page.getByRole("link", { name: /Ejercicios para casa/ }).click();
    await page.getByRole("button", { name: "Añadir de la biblioteca" }).click();
    const lib = page.getByRole("dialog", { name: "Biblioteca de ejercicios" });
    await lib.getByRole("button", { name: "Lumbar" }).click();
    await lib.getByText("Puente de glúteo").click();
    await lib.getByText("Gato-camello").click();
    await lib.getByRole("button", { name: "Añadir 2 ejercicios" }).click();
    await page.getByRole("button", { name: "Escribir uno" }).click();
    await page.getByLabel("Ejercicio 3").fill("Caminar");
    await page.getByLabel("Dosis").nth(2).fill("30 minutos al día");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar la hoja" }).click();

    const doc = page.getByRole("article", { name: "Hoja de ejercicios" });
    await expect(doc.getByRole("listitem")).toHaveCount(3);
    await expect(doc).toContainText("Puente de glúteo3 series de 10");
    await expect(doc).toContainText("Caminar30 minutos al día");
    await expect(page.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/34622333444\?text=Hola%2C%20Elena\.%20Tus%20ejercicios/);
    await expectAccessible(page);
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar en PDF" }).click()]);
    expect(pdf.suggestedFilename()).toBe("Ejercicios Elena Ejercicios 2026-10-20.pdf");
  });
});
