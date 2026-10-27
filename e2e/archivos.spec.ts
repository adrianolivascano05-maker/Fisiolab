// Archivos del paciente (src/documents, cloudflare/worker.js con R2, simulado en fakeGoogle.ts): añadir PDF y fotos en
// la ficha, que lleguen cifrados al servidor, abrirlos, cambiarles el nombre, borrarlos y descargarlos con todo; y el
// enlace para que el paciente suba los suyos desde su móvil, que llegan solos a su ficha.
import type { Browser, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

const users = {
  ana: { sub: "1001", email: "ana@clinica.test", name: "Ana Ruiz" },
  nora: { sub: "1009", email: "nora@paciente.test", name: "Nora Archivos" },
};
test.use({ serviceWorkers: "block" });

/** Un PDF pequeño (lo justo para que la app lo reconozca). */
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
/** Una foto (PNG de verdad): un trozo de la pantalla. */
const photo = (page: Page) => page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 60 } });

async function enterClinic(page: Page, google: FakeGoogle) {
  await google.install(page.context(), () => "ana", { server: true });
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  await page.getByLabel("En una clínica con equipo").check();
  await page.getByLabel("Nombre de la clínica").fill("Fisiolab Centro");
  await page.getByRole("button", { name: "Crear la clínica" }).click();
  const list = page.getByRole("heading", { name: "Pacientes", exact: true });
  const choose = page.getByRole("heading", { name: "Elige tu PIN" });
  await expect(list.or(choose)).toBeVisible({ timeout: 15_000 });
  if (await choose.isVisible()) {
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Guardar el PIN" }).click();
  }
  await expect(list).toBeVisible({ timeout: 15_000 });
}

/** El móvil del paciente: sin cuenta, solo el enlace. */
async function patientPhone(browser: Browser, google: FakeGoogle, errors: string[]) {
  const { viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ viewport, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
  await google.install(ctx, () => "nora", { server: true });
  const phone = await ctx.newPage();
  phone.on("pageerror", (e) => errors.push(`paciente: ${e.message}`));
  return phone;
}

const files = (page: Page) => page.getByRole("list", { name: "Archivos" });

test.describe("Archivos del paciente", () => {
  test("AR1 añadir PDF y fotos: van cifrados al servidor; abrir, cambiar el nombre, borrar y descargar con todo", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await enterClinic(page, google);
    await createPatient(page, { name: "Nora Archivos" });
    const ficha = page.url();
    await page.getByRole("link", { name: /Archivos del paciente/ }).click();
    await expect(page.getByRole("heading", { name: "Archivos del paciente" })).toBeVisible();
    await expect(page.getByText("Aún no tiene archivos.")).toBeVisible();

    // Un PDF.
    await page.getByLabel("Elegir archivos (PDF o fotos)").setInputFiles({ name: "Informe resonancia.pdf", mimeType: "application/pdf", buffer: pdf("RM rodilla") });
    await expect(page.getByText("Archivo añadido")).toBeVisible();
    await expect(files(page)).toContainText("Informe resonancia");
    await expect(files(page)).not.toContainText("Pendiente de subir");
    // En el servidor, cifrado: ni el nombre ni el contenido se ven.
    expect(google.docs.size).toBe(1);
    const [stored] = [...google.docs.values()];
    expect(stored!.bytes.subarray(0, 9).toString()).toBe("CENITDOC1");
    expect(stored!.bytes.includes(Buffer.from("RM rodilla"))).toBe(false);

    // Dos fotos a la vez (un PDF) y algo que no vale.
    const shot = await photo(page);
    await page.getByLabel("Elegir archivos (PDF o fotos)").setInputFiles([
      { name: "foto1.png", mimeType: "image/png", buffer: shot },
      { name: "foto2.png", mimeType: "image/png", buffer: shot },
      { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") },
    ]);
    await expect(page.getByText("«notas.txt»: solo se pueden añadir PDF o fotos.")).toBeVisible();
    await expect(files(page).getByRole("button")).toHaveCount(2);
    await expect(files(page)).toContainText(/Fotos del \d{1,2} \p{L}+ \d{4}/u);
    expect(google.docs.size).toBe(2);
    await expect(page.getByText(/Archivos de la clínica: .* · Almacén: .* de 10 GB/)).toBeVisible();

    // En el móvil: sin desbordar a 360 px y todo lo que se toca, de 44 px.
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    // Abrirlo: el mismo PDF que se añadió.
    await files(page).getByRole("button", { name: /Informe resonancia/ }).click();
    const sheet = page.getByRole("dialog", { name: "Informe resonancia" });
    const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Abrir (se guarda en el dispositivo)" }).click()]);
    expect(dl.suggestedFilename()).toBe("Informe resonancia.pdf");
    expect(readFileSync((await dl.path())!)).toEqual(pdf("RM rodilla"));
    // Cambiarle el nombre.
    await sheet.getByRole("button", { name: "Cambiar el nombre" }).click();
    await sheet.getByLabel("Nombre del archivo").fill("Resonancia rodilla derecha");
    await sheet.getByRole("button", { name: "Guardar el nombre" }).click();
    await expect(files(page)).toContainText("Resonancia rodilla derecha");

    // En la ficha, cuántos tiene.
    await page.goto(ficha);
    await expect(page.getByRole("link", { name: /Archivos del paciente/ })).toContainText("2 archivos");

    // Descargar todo: con sus archivos en PDF.
    await page.goto("./ajustes/datos");
    await expect(page.getByText(/2 archivos de esta clínica/)).toBeVisible();
    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar todo (historias, Excel y copia)" }).click()]);
    const names = readFileSync((await zip.path())!).toString("latin1");
    expect(names).toContain("Archivos de pacientes/Nora Archivos/Resonancia rodilla derecha.pdf");

    // Borrar uno: también del servidor.
    await page.goto(`${ficha}/archivos`);
    await files(page).getByRole("button", { name: /Resonancia rodilla derecha/ }).click();
    const del = page.getByRole("dialog", { name: "Resonancia rodilla derecha" });
    await del.getByRole("button", { name: "Borrar" }).click();
    await del.getByRole("button", { name: "Sí, borrar el archivo" }).click();
    await expect(page.getByText("Archivo borrado")).toBeVisible();
    await expect(files(page).getByRole("button")).toHaveCount(1);
    await expect.poll(() => google.docs.size).toBe(1);
  });

  test("AR2 pedírselos al paciente: los sube desde su móvil (PDF o fotos) y llegan solos a su ficha", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    // Un servidor de una versión anterior, que no dice en la consulta de cada minuto si hay respuestas: la app las
    // pregunta aparte, como antes (CL12 prueba el servidor de ahora).
    google.formsInInfo = false;
    const errors: string[] = [];
    await enterClinic(page, google);
    await createPatient(page, { name: "Nora Archivos" });
    const ficha = page.url();
    await page.goto(`${ficha}/archivos`);
    await page.getByRole("link", { name: "Pedírselos al paciente" }).click();
    const choose = page.getByRole("dialog", { name: "Enviar un formulario" });
    await expect(choose.getByLabel("Qué le mandas")).toHaveValue("documentos");
    await expect(choose.getByText(/hasta 5 informes o pruebas/)).toBeVisible();
    await choose.getByRole("button", { name: "Crear el enlace" }).click();
    const share = page.getByRole("dialog", { name: "Mandar el enlace" });
    await expect(share.getByText(/^Hola Nora: desde Fisiolab Centro te pedimos que nos envíes tus informes o pruebas/)).toBeVisible();
    const link = /https?:\/\/\S+\/formulario\/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+/.exec((await share.locator("pre").textContent())!)![0];
    await share.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("list", { name: "Formularios enviados" })).toContainText("Sus informes y pruebas");

    // El paciente, en su móvil.
    const phone = await patientPhone(browser, google, errors);
    await phone.goto(link);
    await expect(phone.getByRole("heading", { name: "Hola, Nora" })).toBeVisible({ timeout: 15_000 });
    await expect(phone.getByText(/Fisiolab Centro te pide tus informes o pruebas/)).toBeVisible();
    await phone.getByRole("button", { name: "Enviar" }).click();
    await expect(phone.getByText("Sube al menos un archivo.")).toBeVisible();
    const pick = phone.getByLabel("Elegir archivos (PDF o fotos)");
    const mine = phone.getByRole("list", { name: "Tus archivos" });
    await pick.setInputFiles({ name: "Analítica marzo.pdf", mimeType: "application/pdf", buffer: pdf("analítica") });
    await expect(mine.getByRole("listitem")).toHaveCount(1);
    // Dos seguidos, sin esperar: van en fila, cada uno a su número.
    await pick.setInputFiles({ name: "Informe traumatólogo.pdf", mimeType: "application/pdf", buffer: pdf("traumatólogo") });
    await pick.setInputFiles({ name: "IMG_2034.png", mimeType: "image/png", buffer: await photo(phone) });
    await expect(mine.getByRole("listitem")).toHaveCount(3);
    expect(google.docs.size).toBe(3);
    // Se arrepiente de uno.
    await mine.getByRole("button", { name: "Quitar Informe traumatólogo" }).click();
    await expect(mine.getByRole("listitem")).toHaveCount(2);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.viewportSize()!.width);
    // Lo que sube va cifrado: el servidor no ve ni el nombre ni el contenido.
    expect([...google.docs.values()].every((d) => d.bytes.subarray(0, 9).toString() === "CENITDOC1" && !d.bytes.includes(Buffer.from("analítica")))).toBe(true);
    await phone.getByRole("button", { name: "Enviar" }).click();
    await expect(phone.getByText("¡Gracias! Ya lo tiene tu fisioterapeuta")).toBeVisible();

    // En la clínica: llegan solos (o con «Buscar respuestas»).
    await page.goto(`${ficha}/formularios`);
    await page.getByRole("button", { name: "Buscar respuestas" }).click();
    await expect(page.getByText("Nora Archivos ha enviado 2 archivos: están en sus archivos")).toBeVisible();
    await page.getByRole("link", { name: /Envió 2 archivos: ver sus archivos/ }).click();
    await expect(files(page).getByRole("button")).toHaveCount(2);
    await expect(files(page)).toContainText("Analítica marzo");
    await expect(files(page)).toContainText("Lo envió el paciente");
    // El que quitó no se queda en el servidor; los otros dos, sí (ya de la clínica).
    expect(google.docs.size).toBe(2);
    expect([...google.docs.values()].every((d) => !d.formId)).toBe(true);
    // Se abre con la clave de su enlace.
    await files(page).getByRole("button", { name: /Analítica marzo/ }).click();
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("dialog", { name: "Analítica marzo" }).getByRole("button", { name: "Abrir (se guarda en el dispositivo)" }).click(),
    ]);
    expect(readFileSync((await dl.path())!)).toEqual(pdf("analítica"));
    // El enlace ya no admite más.
    await phone.reload();
    await expect(phone.getByText("Este formulario ya se envió")).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("AR3 sin el almacén de archivos (R2) en el servidor: se explica y no se ofrece pedirlos", async ({ page }) => {
    const google = new FakeGoogle(users);
    google.docsEnabled = false;
    await enterClinic(page, google);
    await createPatient(page, { name: "Nora Archivos" });
    const ficha = page.url();
    await page.goto(`${ficha}/archivos`);
    await expect(page.getByText("El servidor aún no guarda archivos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir PDF o fotos" })).toHaveCount(0);
    await page.goto(`${ficha}/formularios?enviar=documentos`);
    const choose = page.getByRole("dialog", { name: "Enviar un formulario" });
    await expect(choose.getByLabel("Qué le mandas").locator("option[value=documentos]")).toHaveCount(1); // la elegida al llegar
    await choose.getByLabel("Qué le mandas").selectOption("anamnesis");
    await expect(choose.getByLabel("Qué le mandas").locator("option[value=documentos]")).toHaveCount(0);
  });
  test("AR4 compartir → Cénit (Android): lo que llega de otra app se guarda en la ficha del paciente elegido", async ({ page }) => {
    const google = new FakeGoogle(users);
    await enterClinic(page, google);
    await createPatient(page, { name: "Nora Archivos" });
    await createPatient(page, { name: "Pablo Otro" });
    // Lo que deja el service worker al compartir (public/compartir-sw.js): un PDF de WhatsApp.
    await page.evaluate(async (text) => {
      const cache = await caches.open("cenit-compartidos");
      await cache.put(
        new Request(new URL("compartido/0", location.href).href),
        new Response(new Blob([text], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf", "X-Nombre": encodeURIComponent("Informe de urgencias.pdf") } }),
      );
    }, pdf("urgencias").toString("latin1"));
    await page.goto("./compartir?n=1");
    await expect(page.getByRole("heading", { name: "Guardar en la ficha" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Lo que has compartido" })).toContainText("Informe de urgencias.pdf");
    await page.getByLabel("Buscar paciente").fill("Nora");
    const list = page.getByRole("list", { name: "Pacientes" });
    await expect(list.getByRole("button")).toHaveCount(1);
    expect(await smallTargets(page)).toEqual([]);
    await list.getByRole("button", { name: "Nora Archivos" }).click();
    await expect(page.getByText("Archivo guardado en la ficha de Nora Archivos")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Archivos del paciente" })).toBeVisible();
    await expect(files(page)).toContainText("Informe de urgencias");
    expect(google.docs.size).toBe(1);
    // Ya no queda nada compartido en el navegador.
    expect(await page.evaluate(async () => (await caches.has("cenit-compartidos")) && (await (await caches.open("cenit-compartidos")).keys()).length)).toBeFalsy();
  });
});
