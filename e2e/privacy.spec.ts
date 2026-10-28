// Protección de datos (src/privacy): texto informativo y consentimientos de cada paciente, datos de la clínica,
// aviso de conservación al borrar y bloqueo de la app con PIN.
import type { Locator, Page } from "@playwright/test";
import { add, createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";

/** Firma de mentira: un garabato con el ratón. */
async function scribble(page: Page, pad: Locator) {
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + box.height * (0.6 + 0.2 * Math.sin(i)));
  await page.mouse.up();
}

/** El campo de la pantalla de bloqueo (lo de debajo está tapado y no cuenta). */

test.describe("Protección de datos", () => {
  test("PD1 datos de la clínica y hoja de protección de datos de un paciente", async ({ page }) => {
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Clínica y protección de datos.*Faltan los datos de la clínica/ })).toBeVisible();
    await page.getByRole("link", { name: /Clínica y protección de datos/ }).click();
    await page.getByLabel("Clínica (nombre o razón social)").fill("Fisio Prueba S.L.");
    await page.getByLabel("Correo para ejercer los derechos").fill("datos@fisioprueba.test");
    await page.getByLabel("Conservar la historia clínica").fill("3");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText("Como mínimo 5 años (Ley 41/2002).")).toBeVisible();
    await page.getByLabel("Conservar la historia clínica").fill("15");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText("Datos de la clínica guardados")).toBeVisible();

    await createPatient(page, { name: "Marta Datos" });
    // En el resumen de la ficha, en naranja mientras no se le haya dado.
    await page.getByRole("link", { name: /^Protección de datos \(RGPD\).*Sin entregar/ }).click();
    await expect(page.getByRole("heading", { name: "Protección de datos", level: 1 })).toBeVisible();
    const notice = page.getByRole("article", { name: "Información sobre protección de datos" });
    await expect(notice.getByText(/Fisio Prueba S\.L\./)).toBeVisible();
    await expect(notice.getByText(/al menos 15 años/)).toBeVisible();
    await expect(notice.getByText("Marta Datos")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("group", { name: "Fotos y vídeos" }).getByText("Sí", { exact: true }).click();
    await page.getByRole("group", { name: "WhatsApp, SMS o correo" }).getByText("No", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(/Información entregada el/)).toBeVisible();

    await page.getByRole("link", { name: "Volver" }).click();
    // La ficha resume cuándo se le informó y sus consentimientos.
    const row = page.getByRole("link", { name: /^Protección de datos \(RGPD\).*Entregada el/ });
    await expect(row).toContainText("Fotos y vídeos: sí · WhatsApp, SMS o correo: no");
  });

  test("PD4 la hoja de protección de datos (fotos, WhatsApp, docencia) se firma en la pantalla y se guarda tal cual", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await createPatient(page, { name: "Nora Firma" });
    await page.getByRole("link", { name: /^Protección de datos \(RGPD\).*Sin entregar/ }).click();
    await page.getByRole("group", { name: "Fotos y vídeos" }).getByText("Sí", { exact: true }).click();
    await page.getByRole("group", { name: "WhatsApp, SMS o correo" }).getByText("No", { exact: true }).click();
    await page.getByRole("button", { name: "Firmar en la pantalla" }).click();
    // Sin firma no se guarda.
    await page.getByRole("button", { name: "Guardar la hoja firmada" }).click();
    await expect(page.getByText("Falta la firma de Nora Firma.")).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expectAccessible(page);
    await scribble(page, page.getByRole("img", { name: "Firma de Nora Firma" }));
    await page.getByRole("button", { name: "Guardar la hoja firmada" }).click();
    await expect(page.getByText(/^Firmada en la pantalla el /)).toBeVisible();
    const notice = page.getByRole("article", { name: "Información sobre protección de datos" });
    const history = page.getByRole("region", { name: "Hojas firmadas en la pantalla" });
    await expect(history.getByRole("button", { name: /Firmada el .*Fotos y vídeos: sí · WhatsApp, SMS o correo: no/ })).toBeVisible();

    // Cambia un permiso de palabra: se avisa de que firme otra; la firmada sigue como se firmó.
    await page.getByRole("group", { name: "WhatsApp, SMS o correo" }).getByText("Sí", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(/pero sus permisos han cambiado/)).toBeVisible();
    await history.getByRole("button", { name: /Firmada el / }).click();
    await expect(page.getByText(/Hoja firmada en la pantalla el .*tal como se firmó/)).toBeVisible();
    await expect(notice.getByRole("img", { name: "Firma: Nora Firma" })).toBeVisible();
    await page.getByRole("button", { name: "Volver a la hoja de ahora" }).click();
    await expect(notice.getByRole("img", { name: "Firma: Nora Firma" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    // En la ficha, firmada en la pantalla, con sus permisos de ahora.
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("link", { name: /^Protección de datos \(RGPD\).*Firmada en la pantalla el .*WhatsApp, SMS o correo: sí/ })).toBeVisible();
  });

  test("PD2 borrar un paciente con historia avisa del plazo de conservación", async ({ page }) => {
    await createPatient(page, { name: "Con Historia" });
    await add(page, "Sesión").click();
    await page.getByLabel("Tratamiento").fill("Terapia manual");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Terapia manual")).toBeVisible();
    await page.goto("./");
    await page.getByRole("link", { name: /Con Historia/ }).click();
    await page.getByRole("link", { name: "Editar datos", exact: true }).click();
    await page.getByRole("button", { name: "Borrar paciente" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Borrar este paciente?" });
    await expect(dialog.getByText(/Hay que conservar su historia clínica hasta el/)).toBeVisible();
    await expectAccessible(page);
    const remove = dialog.getByRole("button", { name: "Borrar para siempre" });
    await expect(remove).toBeDisabled();
    await dialog.getByText(/Lo borro igualmente/).click();
    await remove.click();
    await expect(page.getByText("Todavía no hay pacientes")).toBeVisible();
  });

  test("PD3 bloqueo con PIN: al bloquear, al volver a abrir y para quitarlo", async ({ page }) => {
    await createPatient(page, { name: "Paciente Secreto" });
    await page.goto("./ajustes/bloqueo");
    await page.getByRole("button", { name: "Activar el bloqueo" }).click();
    const sheet = page.getByRole("dialog", { name: "Activar el bloqueo" });
    await sheet.getByLabel("PIN", { exact: true }).fill("12");
    await sheet.getByLabel("Repite el PIN").fill("12");
    await sheet.getByRole("button", { name: "Activar el bloqueo" }).click();
    await expect(sheet.getByText("De 4 a 8 cifras.")).toBeVisible();
    await sheet.getByLabel("PIN", { exact: true }).fill("2468");
    await sheet.getByLabel("Repite el PIN").fill("2468");
    await sheet.getByRole("button", { name: "Activar el bloqueo" }).click();
    await expect(page.getByText("Esta app pide PIN en este dispositivo")).toBeVisible();

    // Bloquear ahora: la pantalla se tapa sin perder dónde se estaba. Teclado como el del móvil.
    await page.getByRole("button", { name: "Bloquear ahora" }).click();
    await expect(page.getByRole("heading", { name: "Introduce tu PIN" })).toBeVisible();
    await expectAccessible(page);
    const keypad = page.getByRole("group", { name: "Teclado del PIN" });
    for (const d of "1111") await keypad.getByRole("button", { name: d, exact: true }).click();
    await expect(page.getByText("PIN incorrecto.")).toBeVisible();
    for (const d of "2468") await keypad.getByRole("button", { name: d, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Introduce tu PIN" })).toBeHidden();
    await expect(page.getByText("Esta app pide PIN en este dispositivo")).toBeVisible();

    // Recargar dentro del tiempo elegido no lo pide (como el móvil); con «en cuanto salgo», sí.
    // Al recargar, la base vuelve a arrancar: con la máquina ocupada por otra prueba tarda más de 5 s.
    await page.reload();
    await expect(page.getByText("Esta app pide PIN en este dispositivo")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Pedir el PIN al volver").selectOption({ label: "En cuanto salgo de la app" });
    // Al volver a abrir la app no se ve nada de los pacientes hasta poner el PIN (con el teclado del ordenador).
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Introduce tu PIN" })).toBeVisible();
    await expect(page.getByText("Paciente Secreto")).toBeHidden();
    await page.keyboard.type("2468");
    await expect(page.getByRole("link", { name: /Paciente Secreto/ })).toBeVisible();

    // Quitarlo pide el PIN actual.
    await page.goto("./ajustes/bloqueo");
    await expect(page.getByRole("heading", { name: "Introduce tu PIN" })).toBeVisible();
    await page.keyboard.type("2468");
    await page.getByRole("button", { name: "Quitar el bloqueo" }).click();
    const remove = page.getByRole("dialog", { name: "Quitar el bloqueo" });
    await remove.getByLabel("PIN actual").fill("2468");
    await remove.getByRole("button", { name: "Quitar el bloqueo" }).click();
    await expect(page.getByRole("button", { name: "Activar el bloqueo" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bloqueo con PIN" })).toBeVisible();
  });
});

test("PD5 la política de privacidad pública (la que pide Google) se abre sin entrar en la app y se lee en el móvil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("./politica-de-privacidad.html");
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidad de OmniClin" })).toBeVisible();
  for (const scope of ["drive.file", "drive.appdata", "calendar.app.created"]) await expect(page.getByText(scope, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "cenitfisiolab@gmail.com" }).first()).toHaveAttribute("href", "mailto:cenitfisiolab@gmail.com");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(await smallTargets(page)).toEqual([]);
});
