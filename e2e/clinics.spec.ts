// Clínicas en el servidor de Cloudflare (src/cloud/clinic.ts y cloudflare/worker.js, simulado en fakeGoogle.ts): dar
// de alta la clínica, añadir al equipo, compartir pacientes, que nadie de fuera los vea y llevar a la clínica lo que
// había en el dispositivo.
import type { Browser, Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

const users = {
  ana: { sub: "1001", email: "ana@clinica.test", name: "Ana Ruiz" },
  bruno: { sub: "1002", email: "bruno@clinica.test", name: "Bruno Gil" },
  carla: { sub: "1003", email: "carla@otra.test", name: "Carla Sanz" },
};
const enc = FakeGoogle.enc;
const PASSWORD = "frase de la clínica 2026";
// Sin service worker: así cada carga lee cloud.json de la red (simulada).
test.use({ serviceWorkers: "block" });

/**
 * Otro dispositivo con el servidor de la clínica, con sus errores de consola vigilados. `expected`: errores que ese
 * dispositivo puede ver (p. ej., el 403 del servidor al quitarle de la clínica).
 */
async function device(browser: Browser, google: FakeGoogle, who: keyof typeof users, errors: string[], expected: RegExp[] = []) {
  const { baseURL, viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ baseURL, viewport, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
  await google.install(ctx, () => who, { server: true });
  const page = await ctx.newPage();
  // Como en fixtures.ts: en GitHub Pages, abrir una ruta interna directamente da 404 (y la app funciona igual).
  let nav404 = 0;
  const ghPages = (process.env.E2E_BASE ?? "/") !== "/";
  page.on("response", (r) => ghPages && r.status() === 404 && r.request().isNavigationRequest() && nav404++);
  page.on("console", (m) => {
    if (m.type() !== "error" || (m.text().includes("status of 404") && nav404-- > 0) || expected.some((re) => re.test(m.text()))) return;
    errors.push(`${who}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  return page;
}

const patients = (page: Page) => expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });

/** Entrar con Google desde la pantalla de entrada (y, si hace falta, elegir la clínica). */
async function enter(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
}

/** Da de alta la clínica desde la pantalla de elegirla. */
async function createClinic(page: Page, name: string) {
  await page.getByLabel("Nombre de la clínica").fill(name);
  await page.getByRole("button", { name: "Crear la clínica" }).click();
}

/** La primera vez en la clínica: elegir la contraseña de cifrado desde el aviso. */
async function choosePassword(page: Page) {
  const notice = page.getByRole("status").filter({ hasText: "va siempre cifrada" });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await notice.getByRole("link", { name: "Elegir contraseña" }).click();
  await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
  const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
  await sheet.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await sheet.getByLabel("Repite la contraseña").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
  await expect(page.getByText("La copia del servidor de la clínica va cifrada")).toBeVisible();
}

/** En un dispositivo nuevo: escribir la contraseña de la clínica y ver lo que trae. */
async function unlock(page: Page) {
  await expect(page.getByRole("status").getByText("La copia del servidor de la clínica está cifrada: escribe su contraseña para sincronizar.")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Escribir la contraseña" }).click();
  const ask = page.getByRole("dialog", { name: "Contraseña de la copia del servidor" });
  await expect(ask.getByText("Escribe la contraseña de «Fisiolab Centro» (te la da quien la administra).")).toBeVisible();
  await ask.getByLabel("Contraseña").fill(PASSWORD);
  await ask.getByRole("button", { name: "Abrir la copia" }).click();
  await page.getByRole("button", { name: "Mostrar" }).click();
}

/** Espera a que un texto esté en la copia de la clínica (descifrada con su contraseña). */
const inServer = (google: FakeGoogle, text: string) =>
  expect.poll(async () => (await FakeGoogle.open(google.clinicCopy("Fisiolab Centro")?.bytes ?? Buffer.alloc(0), PASSWORD)).includes(enc(text)), { timeout: 20_000 }).toBe(true);

test.describe("Nube: clínicas en el servidor de Cloudflare", () => {
  test("CL1 dar de alta la clínica: solo copias cifradas en el servidor, nada en Drive; otro dispositivo la elige", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await page.goto("./");
    await expect(page.getByText("cifrados, en el servidor de la clínica")).toBeVisible();
    await expect(page.getByText("Cada clínica tiene sus pacientes: solo los ve su equipo.")).toBeVisible();
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByRole("heading", { name: "Tu clínica", exact: true })).toBeVisible({ timeout: 15_000 });
    await expectAccessible(page);
    await page.getByRole("button", { name: "Crear la clínica" }).click();
    await expect(page.getByText("Escribe el nombre de la clínica.")).toBeVisible();
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Servidor" });

    // Sin contraseña de cifrado no sube nada: lo pide.
    await expect(page.getByRole("status").filter({ hasText: "va siempre cifrada" })).toBeVisible({ timeout: 15_000 });
    expect(google.server.size).toBe(0);
    await choosePassword(page);
    await expect(page.getByText("Es la contraseña de «Fisiolab Centro»", { exact: false })).toBeVisible();
    await expectAccessible(page);

    // En el servidor, solo bytes cifrados y en la copia de la clínica (no en una personal); en Drive, nada.
    await inServer(google, "Paciente Servidor");
    expect(google.clinicCopy("Fisiolab Centro")!.bytes.toString("latin1").includes(enc("Paciente Servidor"))).toBe(false);
    expect(google.server.has(users.ana.sub)).toBe(false);
    expect(google.appData("ana")).toHaveLength(0);
    await expect(page.getByText(/Guardado en el servidor de la clínica/)).toBeVisible();
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Equipo de la clínica.*Fisiolab Centro · Administra/ })).toBeVisible();
    await page.getByRole("link", { name: /Equipo de la clínica/ }).click();
    await expectAccessible(page);

    // Otro dispositivo de Ana: elige su clínica, escribe la contraseña y trae los pacientes.
    const tablet = await device(browser, google, "ana", errors);
    await enter(tablet);
    await expect(tablet.getByRole("heading", { name: "Elige tu clínica" })).toBeVisible({ timeout: 15_000 });
    await expectAccessible(tablet);
    await tablet.getByRole("list", { name: "Tus clínicas" }).getByRole("button", { name: /Fisiolab Centro/ }).click();
    await patients(tablet);
    await unlock(tablet);
    await expect(tablet.getByRole("link", { name: /Paciente Servidor/ })).toBeVisible();

    // Ana cambia el nombre de la clínica; la tablet lo ve al volver a abrir la app.
    await page.getByRole("button", { name: "Cambiar el nombre" }).click();
    await page.getByRole("dialog", { name: "Nombre de la clínica" }).getByLabel("Nombre").fill("Fisiolab Norte");
    await page.getByRole("button", { name: "Guardar el nombre" }).click();
    await expect(page.getByText("Fisiolab Norte", { exact: true })).toBeVisible();
    await tablet.goto("./ajustes");
    await expect(tablet.getByRole("link", { name: /Equipo de la clínica.*Fisiolab Norte/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("CL2 equipo: Ana añade a Bruno y comparten pacientes; Carla, de fuera, no ve nada; al quitar a Bruno se borran de su móvil", async ({
    page,
    browser,
  }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"]; // ALLOWED_EMAILS: solo Ana puede dar de alta clínicas
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Lucía Equipo" });
    await choosePassword(page);
    await inServer(google, "Lucía Equipo");

    // Ana añade a Bruno por su correo.
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Equipo de la clínica/ }).click();
    await expect(page.getByRole("heading", { name: "Equipo de la clínica" })).toBeVisible();
    const team = page.getByRole("region", { name: "Equipo" });
    await expect(team.getByText("ana@clinica.test (tú)")).toBeVisible();
    await page.getByLabel("Su correo de Google").fill("bruno@");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByText("Escribe su correo de Google")).toBeVisible();
    await page.getByLabel("Su correo de Google").fill(" Bruno@Clinica.test ");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(team.getByRole("button", { name: /bruno@clinica\.test.*Equipo/ })).toBeVisible();
    await expectAccessible(page);

    // Bruno entra: tiene una sola clínica y nada que llevar, así que entra directo; con la contraseña ve a Lucía.
    const bruno = await device(browser, google, "bruno", errors, [/status of 403/]);
    await enter(bruno);
    await patients(bruno);
    await unlock(bruno);
    await expect(bruno.getByRole("link", { name: /Lucía Equipo/ })).toBeVisible();
    // La contraseña de la clínica solo la cambia quien la administra.
    await bruno.goto("./ajustes/cuenta");
    await expect(bruno.getByText("La contraseña de la clínica la cambia quien la administra.")).toBeVisible();
    await expect(bruno.getByRole("button", { name: "Cambiar la contraseña" })).toHaveCount(0);
    // Lo que apunta Bruno lo ve Ana al abrir la app.
    await createPatient(bruno, { name: "Paciente de Bruno" });
    await inServer(google, "Paciente de Bruno");
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Paciente de Bruno/ })).toBeVisible();

    // Carla no es del equipo ni puede dar de alta clínicas: no ve nada.
    const carla = await device(browser, google, "carla", errors);
    await enter(carla);
    await expect(carla.getByText("aún no está en ninguna clínica")).toBeVisible({ timeout: 15_000 });
    await expect(carla.getByRole("button", { name: "Crear la clínica" })).toHaveCount(0);
    await expectAccessible(carla);

    // Ana quita a Bruno: al volver a abrir la app, los pacientes de la clínica se borran de su móvil.
    await page.goto("./ajustes/equipo");
    await page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ }).click();
    await page.getByRole("dialog", { name: "bruno@clinica.test" }).getByRole("button", { name: "Quitar del equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByText("bruno@clinica.test")).toHaveCount(0);
    await bruno.goto("./");
    await expect(bruno.getByText("Ya no formas parte de «Fisiolab Centro»: sus pacientes se han borrado de este dispositivo.")).toBeVisible({ timeout: 15_000 });
    await expect(bruno.getByText("aún no está en ninguna clínica")).toBeVisible();
    // Si Ana vuelve a añadirle, la clínica le llega de nuevo desde el servidor (en su móvil no quedaba nada).
    await page.getByLabel("Su correo de Google").fill("bruno@clinica.test");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();
    await bruno.getByRole("button", { name: "Volver a comprobar" }).click();
    await patients(bruno);
    await expect(bruno.getByText("Lucía Equipo")).toHaveCount(0);
    await unlock(bruno);
    await expect(bruno.getByRole("link", { name: /Lucía Equipo/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("CL3 lo que había en el dispositivo se lleva a la clínica al entrar", async ({ page }) => {
    // Antes de activar la nube: un paciente guardado solo en el dispositivo.
    await createPatient(page, { name: "Previo Local" });
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await expect(page.getByText("1 paciente guardado")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Pasarlos a mi cuenta" }).click();
    await createClinic(page, "Fisiolab Centro");
    await expect(page.getByRole("heading", { name: "Entrar en Fisiolab Centro" })).toBeVisible();
    await expect(page.getByText("1 paciente guardado")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Llevarlos a la clínica" }).click();
    await expect(page.getByRole("link", { name: /Previo Local/ })).toBeVisible({ timeout: 15_000 });
    await choosePassword(page);
    await inServer(google, "Previo Local");
  });

  test("CL4 con el servidor de antes (sin clínicas), la cuenta sigue con su copia hasta que se actualice", async ({ browser }) => {
    const google = new FakeGoogle(users);
    google.oldServer = true;
    const errors: string[] = [];
    // El servidor de antes responde 404 a /v1/yo: es lo que se espera.
    const page = await device(browser, google, "ana", errors, [/status of 404/]);
    await enter(page);
    await patients(page);
    await createPatient(page, { name: "Copia de Antes" });
    await choosePassword(page);
    await expect.poll(async () => (await FakeGoogle.open(google.server.get(users.ana.sub)?.bytes ?? Buffer.alloc(0), PASSWORD)).includes(enc("Copia de Antes")), { timeout: 20_000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test("CL5 agenda: Ana pone el turno de Bruno y le asigna una cita; Bruno lo ve en su móvil", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    const errors: string[] = [];
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Horario" });
    await choosePassword(page);
    await page.goto("./ajustes/equipo");
    await page.getByLabel("Su correo de Google").fill("bruno@clinica.test");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();

    // El turno de Bruno, hoy y la semana que viene (en la vista de un día, una columna por persona).
    const nav = page.getByRole("navigation", { name: "Principal" });
    await nav.getByRole("link", { name: "Agenda" }).click();
    await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
    await page.getByRole("button", { name: "Añadir turno" }).click();
    const sheet = page.getByRole("dialog", { name: "Nuevo turno" });
    await sheet.getByLabel("Persona").selectOption({ label: "bruno" });
    await sheet.getByLabel("Día").fill(today);
    await sheet.getByLabel("Entrada").fill("09:00");
    await sheet.getByLabel("Salida").fill("14:00");
    await sheet.getByLabel("Repetir").selectOption({ label: "También la semana siguiente" });
    await sheet.getByRole("button", { name: "Guardar el turno" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Turno de bruno, 09:00–14:00" })).toBeVisible();
    await expectAccessible(page);

    // Una cita del paciente con Bruno, a las 10:00, desde su ficha.
    await nav.getByRole("link", { name: "Pacientes" }).click();
    await page.getByRole("link", { name: /Paciente Horario/ }).click();
    await page.getByRole("button", { name: "Dar cita" }).click();
    const give = page.getByRole("dialog", { name: "Dar cita a Paciente Horario" });
    await give.getByLabel("Día y hora").fill(`${today}T10:00`);
    await expect(give.getByLabel("Con quién")).toHaveValue("ana@clinica.test");
    await give.getByLabel("Con quién").selectOption({ label: "bruno" });
    await give.getByRole("button", { name: "Dar la cita" }).click();
    await expect(give).toBeHidden();
    await nav.getByRole("link", { name: "Agenda" }).click();
    await expect(page.getByRole("button", { name: /^Paciente Horario\s*,\s*10:00–10:45\s*,\s*con bruno/ })).toBeVisible();

    // Bruno entra en su móvil: ve su turno y su cita, con su nombre de Google; sus turnos solo los pone él.
    const bruno = await device(browser, google, "bruno", errors);
    await enter(bruno);
    await patients(bruno);
    await unlock(bruno);
    await bruno.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Agenda" }).click();
    await bruno.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Día", exact: true }).click();
    await expect(bruno.getByRole("button", { name: "Turno de Bruno Gil, 09:00–14:00" })).toBeVisible();
    await expect(bruno.getByRole("button", { name: /^Paciente Horario\s*,\s*10:00–10:45\s*,\s*con Bruno Gil/ })).toBeVisible();
    await bruno.getByRole("button", { name: "Añadir turno" }).click();
    await expect(bruno.getByRole("dialog", { name: "Nuevo turno" }).getByLabel("Persona")).toBeDisabled();
    await bruno.keyboard.press("Escape");
    await bruno.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
    await expect(bruno.getByRole("button", { name: "Repetir los turnos la semana siguiente" })).toHaveCount(0);
    await expectAccessible(bruno);
    expect(errors).toEqual([]);
  });
});
