// Protección de datos (src/privacy): texto informativo y consentimientos de cada paciente, datos de la clínica,
// aviso de conservación al borrar y bloqueo de la app con PIN.
import { add, createPatient, expect, expectAccessible, test } from "./fixtures";

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
    await page.getByRole("link", { name: /Protección de datos.*Pendiente/ }).click();
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
    const row = page.getByRole("link", { name: /Protección de datos.*Informado el/ });
    await expect(row).toContainText("Fotos y vídeos: sí · WhatsApp, SMS o correo: no");
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
    await page.reload();
    await expect(page.getByText("Esta app pide PIN en este dispositivo")).toBeVisible();
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
