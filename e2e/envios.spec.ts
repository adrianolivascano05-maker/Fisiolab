// Bandeja de envíos (src/schedule/outbox.ts y OutboxPage.tsx): lo que toca mandar hoy, ya escrito, para enviarlo por
// WhatsApp uno tras otro. Recordatorios del día antes y, con el servidor de la clínica, la anamnesis antes de la
// primera cita.
import type { Page } from "@playwright/test";
import { allowContact, createPatient, expect, expectAccessible, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

/** Mañana, en la hora de Madrid, a las 10:00 («AAAA-MM-DDT10:00» para el campo de fecha y hora). */
const tomorrowAt10 = () => {
  const d = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" })}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T10:00`;
};

/** Un paciente nuevo con móvil y una cita mañana a las 10:00; salvo `signed: false`, con el permiso de contacto firmado. */
async function newPatientWithAppointment(page: Page, name: string, phone: string, { signed = true, hour = "10:00" } = {}) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Teléfono").fill(phone);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Dar cita" }).click();
  const sheet = page.getByRole("dialog", { name: `Dar cita a ${name}` });
  await sheet.getByLabel("Día y hora").fill(tomorrowAt10().replace("10:00", hour));
  await sheet.getByRole("button", { name: "Dar la cita" }).click();
  await expect(page.getByRole("button", { name: /Próxima cita/ })).toBeVisible();
  if (signed) await allowContact(page, name);
}

test.describe("Bandeja de envíos", () => {
  test("EN1 sin servidor: el recordatorio de mañana sale listo para WhatsApp; la anamnesis espera al servidor", async ({ page, context }) => {
    // WhatsApp, simulado: se abre en otra pestaña.
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>" }));
    await newPatientWithAppointment(page, "Rosa Envíos", "612 345 678");
    // Sin el permiso de contacto firmado no entra en la bandeja (los dos mensajes son de Rosa).
    await newPatientWithAppointment(page, "Sin Permiso", "622 000 000", { signed: false, hour: "12:00" });

    await page.goto("./agenda?vista=hoy");
    await page.getByRole("link", { name: /2 mensajes por enviar/ }).click();
    await expect(page.getByRole("heading", { name: "Envíos" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Recordatorios de cita · 1/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /Anamnesis antes de la primera cita · 1/ })).toBeVisible();
    await expect(page.getByText("1 envío necesita el servidor de la clínica")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Enviar el mensaje" }).click();
    const sheet = page.getByRole("dialog", { name: "Enviar" });
    await expect(sheet.getByLabel("Mensaje")).toContainText("Hola, Rosa. Te recordamos tu cita de fisioterapia");
    const wa = sheet.getByRole("link", { name: "Enviar por WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/34612345678\?text=Hola%2C%20Rosa/);
    await expectAccessible(page);
    const [popup] = await Promise.all([page.waitForEvent("popup"), wa.click()]);
    await popup.close();
    await expect(sheet.getByText("Hecho: no queda nada por enviar en esta tanda.")).toBeVisible();
    await sheet.getByRole("button", { name: "Terminar" }).click();

    // El recordatorio queda apuntado en la cita; la anamnesis sigue esperando hasta que se decida.
    await expect(page.getByRole("region", { name: /Recordatorios de cita/ })).toHaveCount(0);
    await page.getByRole("button", { name: "No enviar a Rosa Envíos" }).click();
    await expect(page.getByText("Nada que enviar ahora")).toBeVisible();
    await page.goto("./agenda/recordatorios");
    await expect(page.getByText(/Recordada a las/)).toBeVisible();

    // Los ajustes: apagar los recordatorios (lo mismo para toda la clínica).
    await page.goto("./agenda/envios");
    await page.getByLabel("Recordatorio de la cita, el día antes").uncheck();
    await expect(page.getByText("Guardado: es lo mismo para toda la clínica")).toBeVisible();
    await expect(page.getByLabel("Recordatorio de la cita, el día antes")).not.toBeChecked();
  });

  test("EN2 con el servidor de la clínica: recordatorio y anamnesis seguidos; el enlace de la anamnesis se crea al enviarla", async ({ page, context }) => {
    test.slow();
    const google = new FakeGoogle({ ana: { sub: "3001", email: "ana@envios.test", name: "Ana Envíos" } });
    await google.install(context, () => "ana", { server: true });
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>" }));
    await page.goto("./");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByLabel("Por mi cuenta")).toBeChecked({ timeout: 15_000 });
    await page.getByLabel("Nombre de tu consulta (o el tuyo)").fill("Consulta Ana");
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page.getByRole("heading", { name: "Elige tu PIN" })).toBeVisible({ timeout: 20_000 });
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Guardar el PIN" }).click();
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });

    await newPatientWithAppointment(page, "Luis Nuevo", "699 000 111");
    await page.goto("./agenda/envios");
    await page.getByRole("button", { name: "Enviar los 2 uno tras otro" }).click();
    const sheet = page.getByRole("dialog", { name: "Enviar (1 de 2)" });
    await expect(sheet.getByLabel("Mensaje")).toContainText("Te recordamos tu cita");
    let [popup] = await Promise.all([page.waitForEvent("popup"), sheet.getByRole("link", { name: "Enviar por WhatsApp" }).click()]);
    await popup.close();

    const second = page.getByRole("dialog", { name: "Enviar (2 de 2)" });
    await expect(second.getByLabel("Mensaje")).toContainText("Tu primera cita de fisioterapia en Consulta Ana", { timeout: 15_000 });
    await expect(second.getByLabel("Mensaje")).toContainText("/formulario/");
    expect(google.forms.size).toBe(1);
    // «Saltar por ahora»: no cuenta como enviada (ni en su ficha) y vuelve a salir.
    await second.getByRole("button", { name: "Saltar por ahora" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Terminar" }).click();
    await expect(page.getByRole("button", { name: "Enviar el mensaje" })).toBeVisible();
    await page.getByRole("button", { name: "Enviar el mensaje" }).click();
    const again = page.getByRole("dialog", { name: "Enviar" });
    await expect(again.getByLabel("Mensaje")).toContainText("/formulario/", { timeout: 15_000 });
    [popup] = await Promise.all([page.waitForEvent("popup"), again.getByRole("link", { name: "Enviar por WhatsApp" }).click()]);
    expect(decodeURIComponent(popup.url())).toContain("/formulario/");
    await popup.close();
    expect(google.forms.size).toBe(1);
    await expect(page.getByRole("dialog").getByText("Hecho: no queda nada por enviar en esta tanda.")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Terminar" }).click();
    await expect(page.getByText("Nada que enviar ahora")).toBeVisible();
    await expectAccessible(page);

    // En su ficha, el formulario mandado, esperando respuesta.
    await page.goto("./");
    await page.getByRole("link", { name: /Luis Nuevo/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Anamnesis" }).click();
    await page.goto(page.url().replace(/\/anamnesis$/, "/formularios"));
    await expect(page.getByText("Anamnesis (su parte)")).toHaveCount(1);
    await expect(page.getByText("Esperando respuesta")).toHaveCount(1);
  });

  test("EN4 en una anamnesis aún sin rellenar, «Enviar al móvil del paciente» abre el envío con la anamnesis elegida", async ({ page }) => {
    const url = await createPatient(page, { name: "Ana Envío" });
    await page.goto(`${url}/anamnesis`);
    await page.getByRole("link", { name: "Enviar al móvil del paciente" }).click();
    await expect(page).toHaveURL(/\/formularios\?enviar=anamnesis$/);
    await expectAccessible(page);
  });
});
