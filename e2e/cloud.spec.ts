// Cuenta de Google y copia en Drive (src/cloud), con Google simulado (fakeGoogle.ts): dos dispositivos de la
// misma cuenta, un compañero con la suya, pasar a la cuenta lo que había sin cuenta y volver a entrar.
import type { Browser, Page } from "@playwright/test";
import { add, createPatient, expect, expectAccessible, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

const users = {
  ana: { sub: "1001", email: "ana@clinica.test", name: "Ana Ruiz" },
  bruno: { sub: "1002", email: "bruno@clinica.test", name: "Bruno Gil" },
};
const enc = FakeGoogle.enc;
// Sin service worker: así cada carga lee cloud.json de la red (simulada).
test.use({ serviceWorkers: "block" });

/** Otro dispositivo: navegador limpio, con la nube activada y sus errores de consola vigilados. */
async function device(browser: Browser, google: FakeGoogle, who: keyof typeof users, errors: string[]) {
  const { baseURL, viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ baseURL, viewport, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
  await google.install(ctx, () => who);
  const page = await ctx.newPage();
  // Como en fixtures.ts: en GitHub Pages, abrir una ruta interna directamente da 404 (y la app funciona igual).
  let nav404 = 0;
  const ghPages = (process.env.E2E_BASE ?? "/") !== "/";
  page.on("response", (r) => ghPages && r.status() === 404 && r.request().isNavigationRequest() && nav404++);
  page.on("console", (m) => {
    if (m.type() !== "error" || (m.text().includes("status of 404") && nav404-- > 0)) return;
    errors.push(`${who}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  return page;
}

/** Desde la pantalla de entrada. */
async function enter(page: Page) {
  await expect(page.getByRole("heading", { name: "Entra con tu cuenta de Google" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });
}

async function login(page: Page) {
  await page.goto("./");
  await enter(page);
}

const PASSWORD = "frase de la clínica 2026";

/** La copia de la nube va siempre cifrada: la primera vez en la cuenta se elige la contraseña, desde el aviso. */
async function choosePassword(page: Page) {
  const notice = page.getByRole("status").filter({ hasText: "va siempre cifrada" });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await notice.getByRole("link", { name: "Elegir contraseña" }).click();
  await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
  const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
  await sheet.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await sheet.getByLabel("Repite la contraseña").fill(PASSWORD);
  await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
  await expect(page.getByText(/va cifrada$/)).toBeVisible();
}

/** En otro dispositivo de la cuenta: escribir la contraseña de la copia y ver lo que trae. */
async function unlock(page: Page) {
  await page.getByRole("button", { name: "Escribir la contraseña" }).click();
  const ask = page.getByRole("dialog", { name: /^Contraseña de la copia/ });
  await ask.getByLabel("Contraseña").fill(PASSWORD);
  await ask.getByRole("button", { name: "Abrir la copia" }).click();
  await page.getByRole("button", { name: "Mostrar" }).click();
}

/** Espera a que un texto esté en la copia de Drive de la cuenta (descifrada con la contraseña). */
const inDrive = (google: FakeGoogle, who: keyof typeof users, text: string) =>
  expect.poll(async () => (await google.drivePlain(who, PASSWORD)).includes(enc(text)), { timeout: 20_000 }).toBe(true);

test.describe("Nube: cuenta de Google y Google Drive", () => {
  test("NB1 dos dispositivos de la misma cuenta comparten pacientes; un compañero no los ve", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana");

    // Móvil de Ana: entra y crea un paciente; en unos segundos está en su Drive.
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Entra con tu cuenta de Google" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });
    // Sin contraseña de cifrado no se sube nada.
    await createPatient(page, { name: "Lucía Nube" });
    await choosePassword(page);
    await inDrive(google, "ana", "Lucía Nube");
    expect(google.driveText("ana").includes(enc("Lucía Nube"))).toBe(false);
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Ana Ruiz.*ana@clinica\.test.*Guardado en tu Drive/ })).toBeVisible();
    await page.goto("./ajustes/cuenta");
    await expect(page.getByText("ana@clinica.test")).toBeVisible();
    await expect(page.getByText(/Guardado en tu Drive/)).toBeVisible();
    await expectAccessible(page);

    // Tablet de Ana: al entrar escribe la contraseña y ya tiene a Lucía; apunta una sesión.
    const tablet = await device(browser, google, "ana", errors);
    await login(tablet);
    await unlock(tablet);
    await tablet.getByRole("link", { name: /Lucía Nube/ }).click();
    await add(tablet, "Sesión").click();
    await tablet.getByLabel("Tratamiento").fill("Desde la tablet");
    await tablet.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(tablet.getByText("Desde la tablet")).toBeVisible();
    await inDrive(google, "ana", "Desde la tablet");

    // El móvil, que sigue abierto, la trae al sincronizar y avisa de que hay datos nuevos.
    await page.getByRole("button", { name: "Sincronizar ahora" }).click();
    await page.getByRole("button", { name: "Mostrar" }).click();
    await page.goto("./");
    await page.getByRole("link", { name: /Lucía Nube/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Sesiones" }).click();
    await expect(page.getByText("Desde la tablet")).toBeVisible();

    // Bruno, compañero de la clínica, entra con su cuenta: no ve a los pacientes de Ana.
    const colleague = await device(browser, google, "bruno", errors);
    await login(colleague);
    await expect(colleague.getByText("Todavía no hay pacientes")).toBeVisible();
    await expect(colleague.getByText("Lucía Nube")).toHaveCount(0);

    // La tablet cierra sesión borrando sus datos (también la clave); al volver a entrar, Lucía vuelve desde Drive.
    await tablet.goto("./ajustes/cuenta");
    await tablet.getByRole("button", { name: "Cerrar sesión y borrar los datos de este dispositivo" }).click();
    await tablet.getByRole("dialog", { name: "¿Borrar los datos de este dispositivo?" }).getByRole("button", { name: "Borrar y cerrar sesión" }).click();
    await enter(tablet);
    await unlock(tablet);
    await expect(tablet.getByRole("link", { name: /Lucía Nube/ })).toBeVisible();
    // Borrar en el dispositivo no ha borrado nada en la nube.
    expect((await google.drivePlain("ana", PASSWORD)).includes(enc("Desde la tablet"))).toBe(true);
    expect(errors).toEqual([]);
  });

  test("NB2 lo que había en el dispositivo sin cuenta pasa a la cuenta al entrar", async ({ page }) => {
    // Antes de activar la nube: un paciente guardado solo en el dispositivo.
    await createPatient(page, { name: "Previo Local" });
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana");
    await page.goto("./");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByText("1 paciente guardado")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Pasarlos a mi cuenta" }).click();
    await expect(page.getByRole("link", { name: /Previo Local/ })).toBeVisible({ timeout: 15_000 });
    await choosePassword(page);
    await inDrive(google, "ana", "Previo Local");
  });

  test("NB4 desde Ajustes: pegar el ID de cliente en el dispositivo y entrar", async ({ page }) => {
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { publish: false });
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Cuenta de Google.*Sin conectar/ }).click();
    await page.getByRole("link", { name: "Iniciar sesión con Google" }).click();
    await expect(page.getByRole("heading", { name: "Iniciar sesión con Google" })).toBeVisible();
    // Quien no lo activa solo ve que falta activarlo y puede mandar los pasos (con los enlaces directos).
    await expect(page.getByRole("heading", { name: "Aún no está activado" })).toBeVisible();
    await expect(page.getByLabel("ID de cliente")).toBeHidden();
    await expectAccessible(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copiar los pasos" }).click();
    await expect(page.getByRole("button", { name: "Pasos copiados" })).toBeVisible();
    const steps = await page.evaluate(() => navigator.clipboard.readText());
    expect(steps).toContain("https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com");
    expect(steps).toContain(`URI de redirección ${new URL(test.info().project.use.baseURL!).href}`);
    // Quien lo activa abre el desplegable, pega el ID y entra.
    await page.getByText("Lo activo yo, o ya tengo el ID de cliente").click();
    await expectAccessible(page);
    await page.getByLabel("ID de cliente").fill("mi-contraseña");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByText("Eso no parece un ID de cliente")).toBeVisible();
    await page.getByLabel("ID de cliente").fill(" 123456789012-abcdef.apps.googleusercontent.com ");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    // Vuelve de Google con la sesión iniciada, a Pacientes; la cuenta sale en Ajustes.
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: /Ajustes/ }).click();
    await expect(page.getByRole("link", { name: /Ana Ruiz/ })).toBeVisible({ timeout: 15_000 });
    await createPatient(page, { name: "Desde el Inicio" });
    await choosePassword(page);
    await inDrive(google, "ana", "Desde el Inicio");
  });

  test("NB3 con la sesión de Google cerrada pide volver a entrar, o deja seguir sin conexión", async ({ page }) => {
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana");
    await login(page);
    await createPatient(page, { name: "Sin Sesión" });
    await choosePassword(page);
    await inDrive(google, "ana", "Sin Sesión");

    // Otra pestaña (sin token) con la sesión de Google cerrada: no puede entrar sin preguntar. (La base solo se
    // abre en una pestaña a la vez: la primera se va a otra página.)
    google.sessionOpen = false;
    await page.goto("about:blank");
    const other = await page.context().newPage();
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto("./");
    await expect(other.getByText("Entrarás como ana@clinica.test")).toBeVisible();
    await expect(other.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
    await expectAccessible(other);
    await other.getByRole("button", { name: "Seguir sin conexión" }).click();
    await expect(other.getByRole("link", { name: /Sin Sesión/ })).toBeVisible();
    await other.close();
    // Volver a entrar sí funciona (Google pregunta y la persona acepta).
    const again = await page.context().newPage();
    await again.goto("./");
    await again.getByRole("button", { name: "Continuar con Google" }).click();
    await expect(again.getByRole("link", { name: /Sin Sesión/ })).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("NB5 copia de Drive cifrada: contraseña corta, otro dispositivo la pide y lo nuevo se sube cifrado", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana");
    await login(page);
    await createPatient(page, { name: "Paciente Cifrado" });

    // Sin contraseña no sube nada, y no se puede dejar de cifrar.
    const notice = page.getByRole("status").filter({ hasText: "La copia de tu Drive va siempre cifrada" });
    await expect(notice).toBeVisible({ timeout: 15_000 });
    expect(google.appData("ana")).toHaveLength(0);
    await notice.getByRole("link", { name: "Elegir contraseña" }).click();
    await expect(page.getByRole("button", { name: "Dejar de cifrar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
    const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
    await sheet.getByLabel("Contraseña", { exact: true }).fill("corta");
    await sheet.getByLabel("Repite la contraseña").fill("corta");
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    await expect(sheet.getByText("Al menos 10 caracteres.")).toBeVisible();
    await sheet.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await sheet.getByLabel("Repite la contraseña").fill(PASSWORD);
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    await expect(page.getByText("La copia de tu Drive va cifrada")).toBeVisible();
    await expectAccessible(page);
    // En Drive no se lee nada sin la contraseña: solo bytes cifrados.
    await inDrive(google, "ana", "Paciente Cifrado");
    expect(google.driveText("ana").startsWith("CENITENC1")).toBe(true);
    expect(google.driveText("ana").includes(enc("Paciente Cifrado"))).toBe(false);
    // La clave se guarda en el dispositivo sin poder sacarla (ni en localStorage).
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fisiolab.crypt.")))).toEqual([]);

    // La tablet de Ana no tiene la contraseña: entra, pero no ve nada hasta escribirla.
    const tablet = await device(browser, google, "ana", errors);
    await login(tablet);
    await expect(tablet.getByRole("status").getByText("La copia de tu Drive está cifrada: escribe su contraseña para sincronizar.")).toBeVisible();
    await expect(tablet.getByText("Paciente Cifrado")).toHaveCount(0);
    await tablet.getByRole("button", { name: "Escribir la contraseña" }).click();
    const ask = tablet.getByRole("dialog", { name: "Contraseña de la copia de Drive" });
    await ask.getByLabel("Contraseña").fill("otra contraseña cualquiera");
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await expect(ask.getByText("No es la contraseña de esta copia.")).toBeVisible();
    await ask.getByLabel("Contraseña").fill(PASSWORD);
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await tablet.getByRole("button", { name: "Mostrar" }).click();
    await expect(tablet.getByRole("link", { name: /Paciente Cifrado/ })).toBeVisible();
    // Al recargar, la tablet recuerda la clave: no vuelve a pedirla.
    await tablet.reload();
    await expect(tablet.getByRole("link", { name: /Paciente Cifrado/ })).toBeVisible();
    await expect(tablet.getByRole("button", { name: "Escribir la contraseña" })).toHaveCount(0);

    // Lo que apunta la tablet se sube cifrado y llega al móvil.
    await createPatient(tablet, { name: "Desde la Tablet" });
    await inDrive(google, "ana", "Desde la Tablet");
    expect(google.appData("ana")).toHaveLength(1);
    await page.getByRole("button", { name: "Sincronizar ahora" }).click();
    await page.getByRole("button", { name: "Mostrar" }).click();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Desde la Tablet/ })).toBeVisible();
    expect(google.driveText("ana").includes(enc("Desde la Tablet"))).toBe(false);
    expect(errors).toEqual([]);
  });

  test("NB6 servidor de la clínica en Cloudflare: solo copias cifradas, nada en Drive", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana", { server: true });
    await page.goto("./");
    await expect(page.getByText("cifrados, en el servidor de la clínica")).toBeVisible();
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });
    await createPatient(page, { name: "Paciente Servidor" });

    // Sin contraseña de cifrado no sube nada: lo pide.
    const notice = page.getByRole("status").filter({ hasText: "va siempre cifrada" });
    await expect(notice).toBeVisible({ timeout: 15_000 });
    expect(google.server.size).toBe(0);
    await notice.getByRole("link", { name: "Elegir contraseña" }).click();
    await expect(page.getByRole("button", { name: "Dejar de cifrar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
    const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
    await sheet.getByLabel("Contraseña", { exact: true }).fill("frase de la clínica 2026");
    await sheet.getByLabel("Repite la contraseña").fill("frase de la clínica 2026");
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    await expect(page.getByText("La copia del servidor de la clínica va cifrada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dejar de cifrar" })).toHaveCount(0);
    await expectAccessible(page);

    // En el servidor, solo bytes cifrados; en Drive, nada.
    await expect.poll(() => google.server.get(users.ana.sub)?.bytes.subarray(0, 9).toString() ?? "", { timeout: 15_000 }).toBe("CENITENC1");
    expect(google.server.get(users.ana.sub)!.bytes.toString("latin1").includes(enc("Paciente Servidor"))).toBe(false);
    expect(google.appData("ana")).toHaveLength(0);
    await expect(page.getByText(/Guardado en el servidor de la clínica/)).toBeVisible();

    // Otro dispositivo: pide la contraseña y trae los pacientes.
    const { baseURL, viewport, locale, timezoneId } = test.info().project.use;
    const ctx = await browser.newContext({ baseURL, viewport, locale, timezoneId, serviceWorkers: "block" });
    await google.install(ctx, () => "ana", { server: true });
    const tablet = await ctx.newPage();
    tablet.on("pageerror", (e) => errors.push(e.message));
    await login(tablet);
    await expect(tablet.getByRole("status").getByText("La copia del servidor de la clínica está cifrada: escribe su contraseña para sincronizar.")).toBeVisible();
    await tablet.getByRole("button", { name: "Escribir la contraseña" }).click();
    const ask = tablet.getByRole("dialog", { name: "Contraseña de la copia del servidor" });
    await ask.getByLabel("Contraseña").fill("frase de la clínica 2026");
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await tablet.getByRole("button", { name: "Mostrar" }).click();
    await expect(tablet.getByRole("link", { name: /Paciente Servidor/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
