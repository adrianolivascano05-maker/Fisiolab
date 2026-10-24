// Reserva online (src/booking): la clínica la enciende en Ajustes, el paciente pide cita desde su móvil sin cuenta,
// la reserva entra en la agenda (con su ficha nueva), la confirmación sale en Envíos con el enlace para anular, y al
// anular el hueco vuelve a salir libre al momento. El servidor solo ve franjas libres y datos cifrados.
import type { Browser, Locator, Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

test.use({ serviceWorkers: "block" });

/** Una consulta de un fisio por su cuenta, con el servidor de la clínica. */
async function soloClinic(page: Page) {
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
}

/** El móvil del paciente (360 px): sin cuenta, solo el enlace. */
async function patientPhone(browser: Browser, google: FakeGoogle, errors: string[]) {
  const { baseURL, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ baseURL, viewport: { width: 360, height: 740 }, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
  await google.install(ctx, () => "ana", { server: true });
  const phone = await ctx.newPage();
  phone.on("pageerror", (e) => errors.push(`paciente: ${e.message}`));
  return phone;
}

/** Sin scroll horizontal y con los botones y opciones de al menos 44 px de alto. */
async function fitsPhone(phone: Page) {
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const small = await phone.evaluate(() =>
    [...document.querySelectorAll("main button, main label:has(input)")]
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 30), h: el.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44),
  );
  expect(small).toEqual([]);
}

/** Las opciones de la página son botones grandes con la casilla escondida dentro: se pulsan por su etiqueta. */
const pick = (radio: Locator) => radio.check({ force: true });

/** Que la app mire ya si hay reservas o anulaciones (lo hace sola cada dos minutos y al volver a la app). */
const collectNow = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test.describe("Reserva online", () => {
  test("RS1 la clínica la enciende, el paciente reserva y anula, y el hueco vuelve a quedar libre", async ({ page, context, browser }) => {
    test.slow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`clínica: ${e.message}`));
    const google = new FakeGoogle({ ana: { sub: "4001", email: "ana@reservas.test", name: "Ana Reservas" } });
    await google.install(context, () => "ana", { server: true });
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>" }));
    await soloClinic(page);

    // Ajustes › Reserva online: la dirección sale del nombre de la consulta.
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Reserva online/ }).click();
    await expect(page.getByRole("heading", { name: "Reserva online" })).toBeVisible();
    await expect(page.getByLabel("Dirección de la página")).toHaveValue("consulta-ana");
    await page.getByLabel("Reserva por internet encendida").check();
    await page.getByLabel("Tipo 2").fill("Revisión");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado: la página ya está publicada")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /\/reservar\/consulta-ana$/ })).toBeVisible();
    // Al servidor van los tipos de cita y las franjas libres; ni citas ni pacientes.
    const published = [...google.bookingPages.values()][0]!;
    expect(published.slug).toBe("consulta-ana");
    expect(published.windows.length).toBeGreaterThan(0);
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Reserva online.*Encendida/ })).toBeVisible();

    // El paciente pide cita desde su móvil.
    const phone = await patientPhone(browser, google, errors);
    await phone.goto("./reservar/no-existe");
    await expect(phone.getByText("Esta clínica no tiene reserva por internet ahora mismo")).toBeVisible({ timeout: 15_000 });
    await phone.goto("./reservar/consulta-ana");
    await expect(phone.getByRole("heading", { name: "Pide tu cita" })).toBeVisible({ timeout: 15_000 });
    await pick(phone.getByRole("radio", { name: /Primera visita/ }));
    const dayGroup = phone.getByRole("group", { name: "¿Qué día?" });
    const day = dayGroup.getByRole("radio").first();
    const dayName = (await day.evaluate((el) => el.closest("label")!.textContent!)).replace(/\d+ horas?$/, "").trim();
    await pick(day);
    const time = phone.getByRole("group", { name: /¿A qué hora\?/ }).getByRole("radio").first();
    const timeName = (await time.evaluate((el) => el.closest("label")!.textContent!)).trim();
    await pick(time);
    await phone.getByLabel("Nombre y apellidos").fill("Marta Reserva");
    await phone.getByLabel("Móvil").fill("611 222 333");
    await phone.getByLabel("¿Qué te pasa? (si quieres)").fill("Me duele el hombro al peinarme");
    await phone.getByRole("button", { name: "Reservar la cita" }).click();
    await expect(phone.getByText("Marca que has leído la información sobre tus datos.")).toBeVisible();
    await phone.getByLabel("He leído para qué son mis datos").check();
    await fitsPhone(phone);
    await expectAccessible(phone);
    await phone.getByRole("button", { name: "Reservar la cita" }).click();
    await expect(phone.getByText("¡Cita reservada!")).toBeVisible({ timeout: 15_000 });
    await expect(phone.getByText(new RegExp(`a las ${timeName}`))).toBeVisible();
    const cancelUrl = (await phone.getByRole("link", { name: /\/cita\// }).getAttribute("href"))!;
    expect(cancelUrl).toMatch(/\/cita\/[A-Za-z0-9_-]{20,}$/);
    await fitsPhone(phone);
    await expectAccessible(phone);
    // Lo que guarda el servidor va cifrado: ni el nombre ni el móvil se leen.
    const booking = [...google.bookings.values()][0]!;
    expect(booking.payload).toMatch(/^CB1\./);
    expect(JSON.stringify([...google.bookings.values()])).not.toMatch(/Marta|611/);

    // La clínica la recoge: cita en la agenda y paciente nuevo con lo que escribió.
    await collectNow(page);
    await expect(page.getByText(/Nueva reserva por internet: Marta Reserva/)).toBeVisible({ timeout: 20_000 });
    expect([...google.bookings.values()][0]!.payload).toBeNull();
    await page.goto("./");
    await page.getByRole("link", { name: /Marta Reserva/ }).click();
    await expect(page.getByRole("button", { name: /Próxima cita/ })).toBeVisible();

    // La confirmación por WhatsApp sale en Envíos, con el mismo enlace para anular que vio el paciente.
    await page.goto("./agenda/envios");
    await expect(page.getByRole("region", { name: /Confirmaciones de reservas por internet · 1/ })).toBeVisible();
    await page.getByRole("button", { name: /^Enviar (el mensaje|los \d+ uno tras otro)$/ }).click();
    const sheet = page.getByRole("dialog", { name: /^Enviar/ });
    await expect(sheet.getByLabel("Mensaje")).toContainText(new URL(cancelUrl).pathname, { timeout: 15_000 });
    const [popup] = await Promise.all([page.waitForEvent("popup"), sheet.getByRole("link", { name: "Enviar por WhatsApp" }).click()]);
    expect(popup.url()).toContain("wa.me/34611222333");
    await popup.close();

    // El paciente la anula con su enlace.
    await phone.goto(cancelUrl);
    await expect(phone.getByRole("heading", { name: "Tu cita" })).toBeVisible({ timeout: 15_000 });
    await expect(phone.getByText(new RegExp(`a las ${timeName}`))).toBeVisible();
    await phone.getByRole("button", { name: "Anular la cita" }).click();
    await phone.getByRole("button", { name: "Sí, anular la cita" }).click();
    await expect(phone.getByText("Cita anulada")).toBeVisible();
    await fitsPhone(phone);
    await expectAccessible(phone);
    await phone.goto("./cita/enlace-que-no-existe-de-ninguna-cita");
    await expect(phone.getByText("Este enlace no es válido o la cita ya pasó")).toBeVisible({ timeout: 15_000 });

    // El hueco vuelve a salir libre al momento, aunque la clínica aún no lo haya visto.
    await phone.goto("./reservar/consulta-ana");
    await pick(phone.getByRole("radio", { name: /Primera visita/ }));
    await pick(phone.getByRole("group", { name: "¿Qué día?" }).getByRole("radio", { name: new RegExp(`^${dayName}`) }));
    await expect(phone.getByRole("group", { name: /¿A qué hora\?/ }).getByRole("radio", { name: timeName, exact: true })).toBeVisible();

    // Y la clínica ve la anulación: la cita queda anulada.
    await collectNow(page);
    await expect(page.getByText(/Marta Reserva ha anulado su cita/)).toBeVisible({ timeout: 20_000 });
    await page.goto("./");
    await page.getByRole("link", { name: /Marta Reserva/ }).click();
    await expect(page.getByRole("button", { name: "Dar cita" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("RS2 sin servidor, la pantalla de ajustes explica qué hace falta", async ({ page }) => {
    await page.goto("./ajustes/reservas");
    await expect(page.getByText("Hace falta el servidor de la clínica")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajustes › Cuenta de Google" })).toBeVisible();
    await expectAccessible(page);
  });
});
