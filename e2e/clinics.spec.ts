// Clínicas en el servidor de Cloudflare (src/cloud/clinic.ts y cloudflare/worker.js, simulado en fakeGoogle.ts): dar
// de alta la clínica, añadir al equipo, compartir pacientes, que nadie de fuera los vea y llevar a la clínica lo que
// había en el dispositivo.
import type { Browser, Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";
import { EXPECTED_SERVER_VERSION } from "../src/cloud/serverStatus";

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

/** Ya dentro de la clínica: la primera vez en el dispositivo se elige el PIN (obligatorio en una clínica). */
async function patients(page: Page) {
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

/** Entrar con Google desde la pantalla de entrada (y, si hace falta, elegir la clínica). */
async function enter(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
}

/** Da de alta la clínica desde la pantalla de elegirla. */
async function createClinic(page: Page, name: string) {
  await page.getByLabel("En una clínica con equipo").check();
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
  // Quien administra recibe el kit de recuperación: hay que confirmar que se ha guardado.
  const kit = page.getByRole("dialog", { name: "Kit de recuperación de la clínica" });
  if (await kit.isVisible().catch(() => false)) {
    const code = (await kit.getByTestId("recovery-code").textContent())!;
    await kit.getByLabel(/He guardado el código/).check();
    await kit.getByRole("button", { name: "Hecho" }).click();
    return code;
  }
  return null;
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
  expect.poll(async () => (await google.clinicText("Fisiolab Centro", PASSWORD)).includes(enc(text)), { timeout: 20_000 }).toBe(true);

test.describe("Nube: clínicas en el servidor de Cloudflare", () => {
  test("CL0 fisio por su cuenta: sin equipo ni repartos, y puede abrir una clínica con equipo cuando quiera", async ({ page }) => {
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { server: true });
    await page.goto("./");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByLabel("Por mi cuenta")).toBeChecked({ timeout: 15_000 });
    await page.getByLabel("Nombre de tu consulta (o el tuyo)").fill("Ana Fisio");
    await page.getByRole("button", { name: "Empezar" }).click();
    await patients(page);
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Mi consulta/ }).click();
    await expect(page.getByRole("heading", { name: "Mi consulta" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Abrir una clínica con equipo" }).click();
    await expect(page.getByRole("heading", { name: "Equipo de la clínica" })).toBeVisible();
    await page.getByRole("button", { name: "Trabajar por mi cuenta" }).click();
    await expect(page.getByRole("heading", { name: "Mi consulta" })).toBeVisible();
  });
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
    await page.getByLabel("En una clínica con equipo").check();
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
    // Por cambios: lo de Bruno sube solo, en un lote cifrado; la copia entera no se vuelve a subir.
    expect((await FakeGoogle.open(google.clinicCopy("Fisiolab Centro")!.bytes, PASSWORD)).includes(enc("Paciente de Bruno"))).toBe(false);
    expect(google.clinicDeltas("Fisiolab Centro").every((d) => d.data.subarray(0, 9).toString("latin1") === "CENITENC1")).toBe(true);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Paciente de Bruno/ })).toBeVisible();
    // «Editado por»: en la ficha, quién la cambió por última vez.
    await page.getByRole("link", { name: /Paciente de Bruno/ }).click();
    await expect(page.getByText(/^Última modificación: Bruno Gil, hace/)).toBeVisible();
    await page.goto("./");

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

  test("CL9 con un servidor anterior, la copia entera; al actualizarlo, la clínica pasa a sincronizar por cambios sin perder nada", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.deltaServer = false;
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Primera Paciente" });
    await choosePassword(page);
    await inServer(google, "Primera Paciente");
    await page.goto("./");
    await createPatient(page, { name: "Segunda Paciente" });
    await expect
      .poll(async () => (await FakeGoogle.open(google.clinicCopy("Fisiolab Centro")?.bytes ?? Buffer.alloc(0), PASSWORD)).includes(enc("Segunda Paciente")), { timeout: 20_000 })
      .toBe(true);
    expect(google.clinicDeltas("Fisiolab Centro")).toEqual([]);
    // Otro dispositivo la trae igual.
    const tablet = await device(browser, google, "ana", errors);
    await enter(tablet);
    await tablet.getByRole("list", { name: "Tus clínicas" }).getByRole("button", { name: /Fisiolab Centro/ }).click();
    await patients(tablet);
    await unlock(tablet);
    await expect(tablet.getByRole("link", { name: /Segunda Paciente/ })).toBeVisible();

    // Se actualiza el servidor: el primer dispositivo que sincroniza pasa la clínica a cambios, sin perder nada.
    google.deltaServer = true;
    await createPatient(tablet, { name: "Tercera Paciente" });
    await inServer(google, "Tercera Paciente");
    expect(google.deltaBase.size).toBe(1);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Tercera Paciente/ })).toBeVisible({ timeout: 15_000 });
    // Desde ahora, lo nuevo viaja en lotes de cambios.
    await createPatient(page, { name: "Cuarta Paciente" });
    await expect.poll(() => google.clinicDeltas("Fisiolab Centro").length, { timeout: 20_000 }).toBeGreaterThan(0);
    await inServer(google, "Cuarta Paciente");
    await tablet.goto("./");
    await expect(tablet.getByRole("link", { name: /Cuarta Paciente/ })).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("CL10 Ana cambia la contraseña: la copia se vuelve a cifrar con la nueva y Bruno, al escribirla, sigue sincronizando", async ({ page, browser }) => {
    test.slow();
    const NEW = "otra frase larga 2026";
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Antes Del Cambio" });
    await choosePassword(page);
    await inServer(google, "Antes Del Cambio");
    await page.goto("./ajustes/equipo");
    await page.getByLabel("Su correo de Google").fill("bruno@clinica.test");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();
    const bruno = await device(browser, google, "bruno", errors);
    await enter(bruno);
    await patients(bruno);
    await unlock(bruno);
    await expect(bruno.getByRole("link", { name: /Antes Del Cambio/ })).toBeVisible();

    // Ana cambia la contraseña: la copia entera del servidor pasa a ir con la nueva.
    await page.goto("./ajustes/cuenta");
    await page.getByRole("button", { name: "Cambiar la contraseña" }).click();
    const sheet = page.getByRole("dialog", { name: "Cambiar la contraseña" });
    await sheet.getByLabel("Contraseña nueva").fill(NEW);
    await sheet.getByLabel("Repite la contraseña").fill(NEW);
    await sheet.getByRole("button", { name: "Cambiar la contraseña" }).click();
    const kit = page.getByRole("dialog", { name: "Kit de recuperación de la clínica" });
    await expect(kit).toBeVisible({ timeout: 15_000 });
    await kit.getByLabel(/He guardado el código/).check();
    await kit.getByRole("button", { name: "Hecho" }).click();
    await expect
      .poll(async () => (await FakeGoogle.open(google.clinicCopy("Fisiolab Centro")!.bytes, NEW)).includes(enc("Antes Del Cambio")), { timeout: 20_000 })
      .toBe(true);
    await page.goto("./");
    await createPatient(page, { name: "Con La Nueva" });
    await expect.poll(async () => (await google.clinicText("Fisiolab Centro", NEW)).includes(enc("Con La Nueva")), { timeout: 20_000 }).toBe(true);

    // Bruno: al abrir la app se le pide la contraseña nueva; con ella, llega lo de Ana y lo suyo sube.
    await bruno.goto("./");
    await expect(bruno.getByRole("status").getByText(/está cifrada: escribe su contraseña/)).toBeVisible({ timeout: 15_000 });
    await bruno.getByRole("button", { name: "Escribir la contraseña" }).click();
    const ask = bruno.getByRole("dialog", { name: "Contraseña de la copia del servidor" });
    await ask.getByLabel("Contraseña").fill(PASSWORD);
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await expect(ask.getByText("No es la contraseña de esta copia.")).toBeVisible();
    await ask.getByLabel("Contraseña").fill(NEW);
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await bruno.getByRole("button", { name: "Mostrar" }).click();
    await expect(bruno.getByRole("link", { name: /Con La Nueva/ })).toBeVisible();
    await createPatient(bruno, { name: "Bruno Tras El Cambio" });
    await expect.poll(async () => (await google.clinicText("Fisiolab Centro", NEW)).includes(enc("Bruno Tras El Cambio")), { timeout: 20_000 }).toBe(true);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Bruno Tras El Cambio/ })).toBeVisible({ timeout: 15_000 });
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
    await patients(page);
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

  test("CL6 PIN de la clínica: obligatorio; tras 5 fallos se vuelve a entrar con Google y se elige otro", async ({ page }) => {
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await expect(page.getByRole("heading", { name: "Elige tu PIN" })).toBeVisible({ timeout: 15_000 });
    await expectAccessible(page);
    await patients(page);
    await createPatient(page, { name: "Paciente Bloqueo" });
    await page.goto("./ajustes/bloqueo");
    await expect(page.getByText("En una clínica el PIN es obligatorio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar el bloqueo" })).toHaveCount(0);
    await page.getByRole("button", { name: "Bloquear ahora" }).click();
    await expect(page.getByRole("button", { name: "Cambiar de cuenta de Google" })).toBeVisible();
    for (const left of ["Quedan 4 intentos", "Quedan 3 intentos", "Quedan 2 intentos", "Queda 1 intento"]) {
      await page.keyboard.type("0000");
      await expect(page.getByText(`PIN incorrecto. ${left}.`)).toBeVisible();
    }
    await page.keyboard.type("0000");
    await expect(page.getByRole("heading", { name: "Demasiados intentos" })).toBeVisible();
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    // Vuelve de Google a su clínica: elige un PIN nuevo y sus pacientes siguen ahí.
    await expect(page.getByRole("heading", { name: "Elige tu PIN" })).toBeVisible({ timeout: 15_000 });
    await patients(page);
    await expect(page.getByRole("link", { name: /Paciente Bloqueo/ })).toBeVisible();
  });

  test("CL7 contraseña olvidada: quien administra recupera la copia con el código del kit en un dispositivo nuevo", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Recuperado" });
    await expect(page.getByRole("dialog", { name: "Kit de recuperación de la clínica" })).toBeHidden();
    const notice = page.getByRole("status").filter({ hasText: "va siempre cifrada" });
    await notice.getByRole("link", { name: "Elegir contraseña" }).click();
    await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
    const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
    await sheet.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await sheet.getByLabel("Repite la contraseña").fill(PASSWORD);
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    const kit = page.getByRole("dialog", { name: "Kit de recuperación de la clínica" });
    await expect(kit).toBeVisible();
    await expectAccessible(page);
    const code = (await kit.getByTestId("recovery-code").textContent())!;
    expect(code).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
    expect(google.recovery.size).toBe(1);
    expect([...google.recovery.values()][0]).not.toContain(code);
    await expect(kit.getByRole("button", { name: "Hecho" })).toBeDisabled();
    // Sin confirmar que está guardado, se le recuerda.
    await page.keyboard.press("Escape");
    await page.goto("./");
    await expect(page.getByRole("status").filter({ hasText: "Guarda el código de recuperación de la clínica" })).toBeVisible();
    await inServer(google, "Paciente Recuperado");

    // Otro dispositivo de Ana, sin la contraseña: la recupera con el código (escrito en minúsculas y con espacios).
    const tablet = await device(browser, google, "ana", errors);
    await enter(tablet);
    await tablet.getByRole("list", { name: "Tus clínicas" }).getByRole("button", { name: /Fisiolab Centro/ }).click();
    await patients(tablet);
    await tablet.getByRole("button", { name: "Escribir la contraseña" }).click();
    await tablet.getByRole("button", { name: "He olvidado la contraseña" }).click();
    const forgot = tablet.getByRole("dialog", { name: "Contraseña olvidada" });
    await forgot.getByLabel("Código de recuperación").fill("AAAAA-BBBBB-CCCCC-DDDDD");
    await forgot.getByRole("button", { name: "Recuperar con el código" }).click();
    await expect(forgot.getByText("No es el código de recuperación de esta clínica.")).toBeVisible();
    await forgot.getByLabel("Código de recuperación").fill(code.toLowerCase().replace(/-/g, " "));
    await forgot.getByRole("button", { name: "Recuperar con el código" }).click();
    await expect(forgot).toBeHidden();
    await tablet.getByRole("button", { name: "Mostrar" }).click();
    await expect(tablet.getByRole("link", { name: /Paciente Recuperado/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("CL11 solicitud de acceso: Carla lo pide desde la app y Ana, la proveedora, lo acepta; a Bruno se le rechaza", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    google.operators = ["ana"];
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);

    // Carla entra con Google sin permiso: lo pide.
    const carla = await device(browser, google, "carla", errors);
    await enter(carla);
    await expect(carla.getByRole("heading", { name: "¿Quieres usar OmniClin en tu clínica?" })).toBeVisible({ timeout: 15_000 });
    await carla.getByRole("button", { name: "Solicitar acceso" }).click();
    await expect(carla.getByText("Escribe el nombre de la clínica.")).toBeVisible();
    await carla.getByLabel("Nombre de la clínica").fill("Clínica Carla");
    await carla.getByLabel("Mensaje (opcional)").fill("Somos tres en Zaragoza");
    await carla.getByRole("button", { name: "Solicitar acceso" }).click();
    await expect(carla.getByRole("status").getByText(/Has pedido dar de alta «Clínica Carla»/)).toBeVisible();
    await expectAccessible(carla);

    // Ana lo ve en Ajustes y lo acepta desde su panel.
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Proveedor.*1 solicitud de acceso por atender/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /Proveedor/ }).click();
    const requests = page.getByRole("region", { name: "Solicitudes de acceso" });
    await expect(requests.getByText("Somos tres en Zaragoza")).toBeVisible();
    await expectAccessible(page);
    await requests.getByRole("button", { name: "Aceptar" }).click();
    await expect(requests.getByText("No hay solicitudes pendientes.")).toBeVisible();

    // Carla ya puede dar de alta su clínica.
    await carla.getByRole("button", { name: "Volver a comprobar" }).first().click();
    await expect(carla.getByRole("heading", { name: "Da de alta tu clínica" })).toBeVisible({ timeout: 15_000 });
    await createClinic(carla, "Clínica Carla");
    await patients(carla);

    // Bruno también lo pide; Ana lo rechaza y él lo ve al volver a comprobar.
    const bruno = await device(browser, google, "bruno", errors);
    await enter(bruno);
    await bruno.getByLabel("Nombre de la clínica").fill("Otra Clínica");
    await bruno.getByRole("button", { name: "Solicitar acceso" }).click();
    await expect(bruno.getByRole("heading", { name: "Solicitud enviada" })).toBeVisible();
    await page.reload();
    await requests.getByRole("button", { name: "Rechazar" }).click();
    await expect(page.getByRole("region", { name: "Rechazadas" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();
    await bruno.getByRole("button", { name: "Volver a comprobar" }).first().click();
    await expect(bruno.getByText("Tu solicitud para dar de alta una clínica no se ha aceptado")).toBeVisible({ timeout: 15_000 });
    await expect(bruno.getByText("Si crees que es un error, escríbenos a cenitfisiolab@gmail.com.")).toBeVisible();
    await expect(bruno.getByRole("button", { name: "Solicitar acceso" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("CL8 proveedor: altas, suspender, contrato; borrar la clínica con copia y declaración, y recuperarla de la papelera", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    google.operators = ["ana"];
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Papelera" });
    await choosePassword(page);
    await inServer(google, "Paciente Papelera");

    // Lo pendiente en Cloudflare, a la vista: con el servidor de antes (no dice su versión), actualizarlo; sin R2, activarlo.
    google.serverVersion = null;
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Proveedor.*Pendiente en Cloudflare: actualizar el servidor/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /Proveedor/ }).click();
    await expect(page.getByText("Falta actualizar el servidor en Cloudflare")).toBeVisible();
    await expect(page.getByText("Falta activar el almacén R2")).toHaveCount(0);
    google.serverVersion = EXPECTED_SERVER_VERSION;
    google.docsEnabled = false;
    await page.reload();
    await expect(page.getByText("Falta activar el almacén R2")).toBeVisible();
    await expect(page.getByText("Falta actualizar el servidor en Cloudflare")).toHaveCount(0);
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Proveedor.*Pendiente en Cloudflare: activar R2/ })).toBeVisible({ timeout: 15_000 });
    google.docsEnabled = true;

    // El panel del proveedor: da de alta a Carla sin tocar Cloudflare.
    await page.reload();
    await expect(page.getByRole("link", { name: /Proveedor.*Solicitudes, clínicas, altas, bajas y contrato/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /Proveedor/ }).click();
    await expect(page.getByRole("heading", { name: "Proveedor" })).toBeVisible();
    await expect(page.getByText(/^Falta /)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Clínicas" }).getByRole("button", { name: /Fisiolab Centro/ })).toBeVisible();
    // Lo que ocupa el servidor; al 70 % de un límite, el aviso con qué hacer.
    const summary = page.getByRole("region", { name: "Resumen" });
    await expect(summary.getByText("Almacén R2 (archivos y copias)")).toBeVisible();
    await expect(summary.getByText("2 MB de 500 MB")).toBeVisible();
    await expect(page.getByText(/La base de datos va por el/)).toHaveCount(0);
    google.databaseBytes = 400_000_000;
    await page.reload();
    await expect(page.getByText("La base de datos va por el 80 % (400 MB de 500 MB)")).toBeVisible();
    google.databaseBytes = 2_000_000;
    // Las peticiones de hoy (solo las ve el proveedor): cuántas van y, al 70 %, el aviso aquí y en Ajustes.
    const today = (n: number) => n.toLocaleString("es-ES");
    await expect(summary.getByText(`${today(6200)} de ${today(100_000)} (6 %)`, { exact: false })).toBeVisible();
    google.requestsToday = 85_000;
    await page.reload();
    await expect(page.getByText(/Las peticiones de hoy van por el 85 %/)).toBeVisible();
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Proveedor.*Peticiones de hoy al 85 % del límite/ })).toBeVisible({ timeout: 15_000 });
    google.requestsToday = null;
    await page.getByRole("link", { name: /Proveedor/ }).click();
    await expect(summary.getByText(/Sin configurar: añade CF_ACCOUNT_ID/)).toBeVisible();
    await expect(page.getByText(/Las peticiones de hoy van por/)).toHaveCount(0);
    google.requestsToday = 6200;
    await page.getByLabel("Correo del responsable").fill("carla@otra.test");
    await page.getByRole("button", { name: "Dar de alta" }).click();
    await expect(page.getByRole("region", { name: "Pueden crear clínicas" }).getByRole("button", { name: /carla@otra\.test/ })).toBeVisible();
    await expectAccessible(page);
    const carla = await device(browser, google, "carla", errors, [/status of 423/]);
    await enter(carla);
    await createClinic(carla, "Clínica Carla");
    await patients(carla);

    // Suspender la clínica de Carla: no sube nada (lo dice), pero sigue funcionando en su dispositivo.
    await page.reload();
    // Un toque en la fila no suspende: pide confirmación (y Cancelar no toca nada).
    await page.getByRole("region", { name: "Clínicas" }).getByRole("button", { name: /Clínica Carla/ }).click();
    const suspend = page.getByRole("dialog", { name: "¿Suspender «Clínica Carla»?" });
    await suspend.getByRole("button", { name: "Cancelar" }).click();
    await expect(suspend).toBeHidden();
    expect([...google.clinics.values()].find((c) => c.name === "Clínica Carla")!.suspended).toBeFalsy();
    await page.getByRole("region", { name: "Clínicas" }).getByRole("button", { name: /Clínica Carla/ }).click();
    await expect(suspend.getByRole("button", { name: "Suspender «Clínica Carla»" })).toBeDisabled();
    await suspend.getByRole("checkbox", { name: /Sí, quiero suspender «Clínica Carla»/ }).check();
    await expectAccessible(page);
    await suspend.getByRole("button", { name: "Suspender «Clínica Carla»" }).click();
    await expect(page.getByRole("region", { name: "Clínicas" }).getByRole("button", { name: /Clínica Carla · suspendida/ })).toBeVisible();
    await createPatient(carla, { name: "Paciente Suspendido" });
    await choosePassword(carla).catch(() => {});
    await carla.goto("./ajustes/cuenta");
    await carla.getByRole("button", { name: "Sincronizar ahora" }).click();
    await expect(carla.getByText(/La clínica está suspendida/).first()).toBeVisible({ timeout: 15_000 });

    // El contrato: solo para el proveedor, y en PDF.
    await page.getByRole("button", { name: "Ver el borrador del contrato" }).click();
    await expect(page.getByRole("article", { name: "Borrador del contrato" })).toContainText("BORRADOR");
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar en PDF" }).click()]);
    expect(pdf.suggestedFilename()).toBe("OmniClin-contrato-encargado-BORRADOR.pdf");

    // Borrar su clínica: primero la copia de seguridad, luego la declaración.
    await page.goto("./ajustes/equipo");
    await page.getByRole("button", { name: /Borrar la clínica del servidor/ }).click();
    const sheet = page.getByRole("dialog", { name: "Borrar una clínica del servidor" });
    await expect(sheet.getByRole("button", { name: "Borrar «Fisiolab Centro»" })).toBeDisabled();
    const [backup] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Descargar todos los datos" }).click()]);
    expect(backup.suggestedFilename()).toMatch(/^OmniClin-Fisiolab-Centro-\d{4}-\d{2}-\d{2}\.zip$/);
    await sheet.getByRole("checkbox", { name: /Declaro que la clínica conserva/ }).check();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Borrar «Fisiolab Centro»" }).click();
    await expect(page.getByText(/«Fisiolab Centro» está en la papelera: puedes recuperarla aquí hasta el/)).toBeVisible({ timeout: 15_000 });
    const [entry] = [...google.clinics.values()].filter((c) => c.name === "Fisiolab Centro");
    expect(entry!.deleted).toMatchObject({ by: "ana@clinica.test", declaration: expect.stringContaining("Declaro que la clínica conserva") });

    // Recuperarla de la papelera: vuelve entera.
    await page.getByRole("button", { name: "Recuperar «Fisiolab Centro»" }).click();
    await page.getByRole("list", { name: "Tus clínicas" }).getByRole("button", { name: /Fisiolab Centro/ }).click();
    await patients(page);
    await expect(page.getByRole("button", { name: "Escribir la contraseña" }).or(page.getByRole("link", { name: /Paciente Papelera/ }))).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
  test("CL12 formularios para el paciente: la anamnesis y un cuestionario por enlace; lo rellena sin cuenta y llega solo a su ficha", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Nora Enlace" });
    const noraUrl = page.url();
    // La marca de la clínica: viaja dentro del sobre cifrado y viste la página del paciente.
    await page.goto("./ajustes/marca");
    await page.getByLabel("Nombre de la clínica").fill("Clínica Aurora");
    await page.getByLabel("Color principal en hexadecimal").fill("#7A1F3D");
    await page.getByLabel("Lema").fill("Fisioterapia de barrio");
    await page.getByLabel("Texto de bienvenida").fill("Gracias por rellenarlo antes de venir.");
    await page.getByRole("radio", { name: /^Rectas/ }).check();
    await page.getByRole("button", { name: "Guardar la marca" }).click();
    await expect(page.getByText("Marca guardada: ya se ve en toda la app")).toBeVisible();
    // El teléfono de la clínica, para el pie de la página del paciente.
    await page.goto("./ajustes/clinica");
    await page.getByLabel("Teléfono").fill("600 000 001");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText("Datos de la clínica guardados")).toBeVisible();
    // Privacidad, con el servidor de la clínica: dónde están los datos y quién puede verlos.
    await page.goto("./privacidad");
    await expect(page.getByText(/cifrados, en el servidor de la clínica \(Cloudflare, en la Unión Europea\)/)).toBeVisible();
    await expect(page.getByText(/encargado del tratamiento: la clínica tiene que firmar con él un contrato de encargado/)).toBeVisible();
    // Lo enviado y su estado: la pantalla de formularios del paciente.
    await page.goto(`${noraUrl}/formularios`);
    await expect(page.getByText("Todavía no le has mandado ninguno.")).toBeVisible();
    await expectAccessible(page);

    /** Crea el enlace en la hoja y lo devuelve (está en el mensaje). */
    const createLink = async () => {
      await page.getByRole("dialog", { name: "Enviar un formulario" }).getByRole("button", { name: "Crear el enlace" }).click();
      const share = page.getByRole("dialog", { name: "Mandar el enlace" });
      await expect(share.getByText(/^Hola Nora: desde Fisiolab Centro te pedimos que rellenes/)).toBeVisible();
      const text = (await share.locator("pre").textContent())!;
      await share.getByRole("button", { name: "Cerrar" }).click();
      return /https?:\/\/\S+\/formulario\/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+/.exec(text)![0];
    };
    /** El móvil del paciente: sin cuenta, solo el enlace. */
    const patientPhone = async () => {
      const { viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
      const ctx = await browser.newContext({ viewport, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
      await google.install(ctx, () => "carla", { server: true });
      const phone = await ctx.newPage();
      phone.on("pageerror", (e) => errors.push(`paciente: ${e.message}`));
      return phone;
    };

    // Su parte de la anamnesis.
    await page.getByRole("button", { name: "Enviar un formulario" }).click();
    await expect(page.getByRole("dialog", { name: "Enviar un formulario" }).getByLabel("Qué le mandas")).toHaveValue("anamnesis");
    const anamnesisLink = await createLink();
    await expect(page.getByRole("list", { name: "Formularios enviados" })).toContainText("Esperando respuesta");

    const phone = await patientPhone();
    await phone.goto(anamnesisLink);
    await expect(phone.getByRole("heading", { name: "Hola, Nora" })).toBeVisible({ timeout: 15_000 });
    await expect(phone.getByText("Fisiolab Centro te pide que rellenes unas preguntas sobre tu salud")).toBeVisible();
    // Con la marca de la clínica: su nombre en la cabecera, sus colores y su título; el servidor no la ve.
    await expect(phone.getByRole("banner")).toContainText("Clínica Aurora");
    expect(await phone.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim().toUpperCase())).not.toBe("#0E3B2E");
    await expect(phone).toHaveTitle("Formulario · Clínica Aurora");
    expect(JSON.stringify([...google.forms.values()])).not.toContain("Clínica Aurora");
    // El lema, el texto de bienvenida, el contacto al pie y las esquinas rectas viajan también en el sobre.
    await expect(phone.getByRole("banner")).toContainText("Fisioterapia de barrio");
    await expect(phone.getByText("Gracias por rellenarlo antes de venir.")).toBeVisible();
    await expect(phone.getByText("¿Dudas? Fisiolab Centro: 600 000 001")).toBeVisible();
    expect(await phone.getByRole("button", { name: "Enviar" }).evaluate((el) => getComputedStyle(el).borderRadius)).toBe("0px");
    // Lo del fisioterapeuta no se le pregunta.
    await expect(phone.getByText("Banderas rojas")).toHaveCount(0);
    await phone.getByLabel("¿Por qué vienes? Cuéntanos qué te pasa").fill("Me duele la rodilla al bajar escaleras");
    await phone.getByLabel("¿Tienes alguna alergia?").fill("Ninguna");
    await expectAccessible(phone);
    await phone.getByRole("button", { name: "Enviar" }).click();
    await expect(phone.getByText("¡Gracias! Ya lo tiene tu fisioterapeuta")).toBeVisible();
    // Si vuelve a abrir el enlace, ve que ya lo envió.
    await phone.reload();
    await expect(phone.getByText("Este formulario ya se envió")).toBeVisible();

    // Llega a su ficha.
    await page.getByRole("button", { name: "Buscar respuestas" }).click();
    await expect(page.getByText("Nora Enlace ha rellenado: Anamnesis (su parte)")).toBeVisible();
    await expect(page.getByRole("list", { name: "Formularios enviados" })).toContainText("Rellenado");
    await page.getByRole("link", { name: "Volver a Ficha" }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Anamnesis" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "Me duele la rodilla al bajar escaleras" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "Ninguna" })).toBeVisible();

    // Un cuestionario desde su pantalla: llega con la nota calculada.
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Resumen" }).click();
    await page.getByRole("button", { name: "Valorar" }).click();
    await page.getByRole("dialog", { name: "Valorar" }).getByRole("link", { name: /^Pasar un cuestionario/ }).click();
    await page.getByRole("button", { name: /GAD-7/ }).click();
    await page.getByRole("link", { name: "Que lo rellene en su móvil" }).click();
    await expect(page.getByRole("dialog", { name: "Enviar un formulario" }).getByLabel("Qué le mandas")).toHaveValue("gad7");
    const gadLink = await createLink();
    await phone.goto(gadLink);
    const qs = phone.getByRole("group").filter({ hasText: "Casi todos los días" });
    await expect(qs).toHaveCount(7, { timeout: 15_000 });
    for (let i = 0; i < 6; i++) await qs.nth(i).getByText("Varios días", { exact: true }).click();
    await phone.getByRole("button", { name: "Enviar" }).click();
    await expect(phone.getByRole("alert")).toContainText("Contéstalas para poder enviarlo");
    await qs.nth(6).getByText("Varios días", { exact: true }).click();
    await phone.getByRole("button", { name: "Enviar" }).click();
    await expect(phone.getByText("¡Gracias! Ya lo tiene tu fisioterapeuta")).toBeVisible();
    await page.getByRole("button", { name: "Buscar respuestas" }).click();
    await expect(page.getByText("Nora Enlace ha rellenado: GAD-7 (ansiedad)")).toBeVisible();
    await page.getByRole("link", { name: "Ver en sus cuestionarios" }).first().click();
    const list = page.getByRole("list", { name: "Cuestionarios" });
    await expect(list).toContainText("GAD-7");
    await expect(list).toContainText("7/21");
    // En el servidor no queda nada que leer: solo que ya se respondió.
    expect([...google.forms.values()].every((f) => !f.response && !f.request)).toBe(true);
    await phone.goto(anamnesisLink);
    await expect(phone.getByText("Este formulario ya se envió")).toBeVisible();
    await phone.context().close();
    expect(errors).toEqual([]);
  });

  test("CL13 sincronizar sin perder nada: datos distintos a la vez se juntan; lo mismo, se recupera; la ventana flotante avisa", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Sincro" });
    await choosePassword(page);
    await page.goto("./ajustes/equipo");
    await page.getByLabel("Su correo de Google").fill("bruno@clinica.test");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();
    await inServer(google, "Paciente Sincro");

    const bruno = await device(browser, google, "bruno", errors, [/status of 500/, /sincronización.*Fallo de prueba/]);
    await enter(bruno);
    await patients(bruno);
    await unlock(bruno);
    await expect(bruno.getByRole("link", { name: /Paciente Sincro/ })).toBeVisible();

    /** El formulario de los datos de la ficha, sin recargar la página (también sin conexión). */
    const openForm = async (p: Page) => {
      // En el formulario no está la barra de abajo: atrás, a la ficha.
      if (await p.getByRole("button", { name: "Guardar cambios" }).isVisible()) await p.goBack();
      await p.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Pacientes" }).click();
      await p.getByRole("link", { name: /Paciente Sincro/ }).click();
      await p.getByRole("link", { name: "Editar datos" }).click();
    };
    /** Cambia un dato de la ficha y guarda. */
    const edit = async (p: Page, label: string, value: string) => {
      await openForm(p);
      await p.getByLabel(label, { exact: true }).fill(value);
      await p.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(p.getByRole("button", { name: "Guardar cambios" })).toBeHidden();
    };
    const syncNow = async (p: Page) => {
      await p.goto("./ajustes/cuenta");
      await p.getByRole("button", { name: "Sincronizar ahora" }).click();
      await expect(p.getByText(/Guardado en el servidor de la clínica/)).toBeVisible({ timeout: 15_000 });
    };
    const value = async (p: Page, label: string) => {
      await openForm(p);
      return p.getByLabel(label, { exact: true }).inputValue();
    };

    // A la vez, Ana cambia el teléfono y Bruno las notas: se quedan los dos.
    await edit(page, "Teléfono", "612 000 111");
    await edit(bruno, "Notas", "Viene en bici");
    for (const p of [page, bruno, page]) await syncNow(p);
    for (const p of [page, bruno]) {
      expect(await value(p, "Teléfono")).toBe("612 000 111");
      expect(await value(p, "Notas")).toBe("Viene en bici");
    }

    // Ana, sin conexión, cambia el teléfono: la ventana flotante lo dice y no se va.
    await page.context().setOffline(true);
    await edit(page, "Teléfono", "611 111 111");
    const float = page.getByRole("status", { name: "Sincronización" });
    await expect(float).toContainText("Sin conexión: hay cambios esperando.", { timeout: 15_000 });
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const box = await float.getByRole("button", { name: "Pulsa para sincronizar" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
    await expectAccessible(page);

    // Mientras, Bruno pone otro teléfono (más tarde). Al volver la conexión, se queda el de Bruno y Ana puede recuperar el suyo.
    await edit(bruno, "Teléfono", "699 999 999");
    await syncNow(bruno);
    // Al volver la conexión se sube solo (y la ventana se va).
    await page.context().setOffline(false);
    await expect(float).toBeHidden({ timeout: 15_000 });
    const notice = page.getByRole("status").filter({ hasText: "Otra persona ha cambiado a la vez lo mismo" });
    await expect(notice).toContainText("los datos de Paciente Sincro (lo cambió Bruno Gil)");
    await notice.getByRole("link", { name: "Ver y recuperar lo mío" }).click();
    await expect(page.getByRole("heading", { name: "Cambios sustituidos" })).toBeVisible();
    const lost = page.getByRole("list", { name: "Cambios sustituidos" }).getByRole("listitem");
    await expect(lost).toHaveCount(1);
    await expect(lost).toContainText("Teléfono · Paciente Sincro");
    await expect(lost).toContainText("Lo tuyo611 111 111");
    await expect(lost).toContainText("Se quedó699 999 999 (de Bruno Gil,");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expectAccessible(page);
    await lost.getByRole("button", { name: "Recuperar lo mío" }).click();
    await expect(page.getByText("Teléfono: se ha vuelto a poner lo tuyo")).toBeVisible();
    await expect(lost).toHaveCount(0);
    await syncNow(page);
    await syncNow(bruno);
    expect(await value(bruno, "Teléfono")).toBe("611 111 111");

    // Cita doble: Ana y Bruno dan cita al mismo paciente a la misma hora, casi a la vez (cada uno sin ver la del otro);
    // al sincronizar, los dos lo ven.
    const giveAt = async (p: Page, when: string) => {
      if (await p.getByRole("button", { name: "Guardar cambios" }).isVisible()) await p.goBack();
      await p.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Pacientes" }).click();
      await p.getByRole("link", { name: /Paciente Sincro/ }).click();
      await p.getByRole("button", { name: "Dar cita" }).click();
      const give = p.getByRole("dialog", { name: "Dar cita a Paciente Sincro" });
      await give.getByLabel("Día y hora").fill(when);
      await give.getByRole("button", { name: "Dar la cita" }).click();
      await expect(give).toBeHidden();
    };
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    await giveAt(page, `${tomorrow}T10:00`);
    await giveAt(bruno, `${tomorrow}T10:15`);
    for (const p of [bruno, page]) await syncNow(p);
    const double = page.getByRole("status").filter({ hasText: "Cita doble." });
    await expect(double).toContainText("Paciente Sincro tiene dos citas a la vez", { timeout: 20_000 });
    await expect(double).toContainText("Se han dado a la vez en dos dispositivos.");
    await expectAccessible(page);
    await double.getByRole("link", { name: "Ver en la agenda" }).click();
    await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
    await expect(double).toBeHidden();

    // Si el servidor falla, la ventana flotante lo dice hasta que se arregla (en el móvil de Bruno).
    await bruno.route(`${FakeGoogle.SERVER}/**`, (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Fallo de prueba" }) }));
    await edit(bruno, "Notas", "Viene andando");
    const brunoFloat = bruno.getByRole("status", { name: "Sincronización" });
    await expect(brunoFloat).toContainText("No se ha podido sincronizar", { timeout: 15_000 });
    await expect(brunoFloat).toContainText("Fallo de prueba");
    await bruno.unroute(`${FakeGoogle.SERVER}/**`);
    await brunoFloat.getByRole("button", { name: "Pulsa para sincronizar" }).click();
    await expect(brunoFloat).toBeHidden({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("CL14 copia grande: con almacén R2 la copia entera viaja por trozos y en bytes; sin él, como antes", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    // Trozos pequeños: así una base de prueba ya va en varios.
    google.copyPartBytes = 4096;
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente Por Trozos" });
    await choosePassword(page);
    await inServer(google, "Paciente Por Trozos");
    const copy = google.clinicCopy("Fisiolab Centro")!;
    expect(copy.r2).toBe(true);
    expect(copy.bytes.subarray(0, 9).toString("latin1")).toBe("CENITENC2");
    expect(copy.bytes.length).toBeGreaterThan(2 * google.copyPartBytes);
    expect(copy.bytes.toString("latin1").includes(enc("Paciente Por Trozos"))).toBe(false);
    expect(google.uploads.size).toBe(0);
    // Otro dispositivo la baja en bytes y la abre con la contraseña.
    const tablet = await device(browser, google, "ana", errors);
    await enter(tablet);
    await tablet.getByRole("list", { name: "Tus clínicas" }).getByRole("button", { name: /Fisiolab Centro/ }).click();
    await patients(tablet);
    await unlock(tablet);
    await expect(tablet.getByRole("link", { name: /Paciente Por Trozos/ })).toBeVisible();
    // Lo nuevo sigue yendo en lotes de cambios.
    await createPatient(tablet, { name: "Paciente De La Tablet" });
    await inServer(google, "Paciente De La Tablet");
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Paciente De La Tablet/ })).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("CL16 fisios del paciente: se asignan uno o varios en su ficha, se filtra por ellos y llega al otro dispositivo", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    google.creators = ["ana"];
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Sin Fisio" });
    await choosePassword(page);
    await page.goto("./ajustes/equipo");
    await page.getByLabel("Su correo de Google").fill("bruno@clinica.test");
    await page.getByRole("button", { name: "Añadir al equipo" }).click();
    await expect(page.getByRole("region", { name: "Equipo" }).getByRole("button", { name: /bruno@clinica\.test/ })).toBeVisible();
    await createPatient(page, { name: "Lleva Bruno" });

    // En la cabecera de la ficha: «Asignar fisio», y en la hoja, uno o varios del equipo.
    await page.setViewportSize({ width: 360, height: 780 });
    await page.getByRole("button", { name: "Asignar fisio" }).click();
    const sheet = page.getByRole("dialog", { name: "Fisios que lo llevan" });
    await expect(sheet.getByText("Sin citas con este paciente").first()).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expectAccessible(page);
    await sheet.getByRole("checkbox", { name: /bruno/ }).check();
    await sheet.getByRole("checkbox", { name: /Ana Ruiz/ }).check();
    await sheet.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("button", { name: "Fisios: Ana Ruiz, bruno" })).toBeVisible();
    // Quitar a Ana: se queda Bruno.
    await page.getByRole("button", { name: "Fisios: Ana Ruiz, bruno" }).click();
    await sheet.getByRole("checkbox", { name: /Ana Ruiz/ }).uncheck();
    await sheet.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("button", { name: "Fisio: bruno" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    // En Pacientes, el filtro «Fisio» saca a los suyos.
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Pacientes" }).click();
    await page.getByRole("button", { name: "Filtros" }).click();
    const filters = page.getByRole("dialog", { name: "Filtros" });
    await filters.getByLabel("Fisio").selectOption({ label: "bruno" });
    await filters.getByRole("button", { name: "Ver 1 paciente" }).click();
    const list = page.getByRole("list", { name: "Pacientes" });
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByRole("link", { name: /Lleva Bruno/ })).toBeVisible();

    // Bruno, en su móvil, ve que lo lleva él.
    await inServer(google, "Lleva Bruno");
    const bruno = await device(browser, google, "bruno", errors);
    await enter(bruno);
    await patients(bruno);
    await unlock(bruno);
    await bruno.getByRole("link", { name: /Lleva Bruno/ }).click();
    await expect(bruno.getByRole("button", { name: "Fisio: Bruno Gil" })).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("CL15 sin almacén R2 la copia de la clínica sigue en base64, como antes", async ({ page }) => {
    const google = new FakeGoogle(users);
    google.docsEnabled = false;
    await google.install(page.context(), () => "ana", { server: true });
    await enter(page);
    await createClinic(page, "Fisiolab Centro");
    await patients(page);
    await createPatient(page, { name: "Paciente En Base" });
    await choosePassword(page);
    await inServer(google, "Paciente En Base");
    const copy = google.clinicCopy("Fisiolab Centro")!;
    expect(copy.r2).toBeFalsy();
    expect(copy.bytes.subarray(0, 9).toString("latin1")).toBe("CENITENC1");
  });
});
