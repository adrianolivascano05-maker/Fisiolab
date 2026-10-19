// Cuenta de Google y copia en Drive (src/cloud), con Google simulado (fakeGoogle.ts): dos dispositivos de la
// misma cuenta, un compañero con la suya, pasar a la cuenta lo que había sin cuenta y volver a entrar.
import type { Browser, Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";
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
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible({ timeout: 15_000 });
}

async function login(page: Page) {
  await page.goto("./");
  await enter(page);
}

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
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible({ timeout: 15_000 });
    await createPatient(page, { name: "Lucía Nube" });
    await expect.poll(() => google.driveText("ana").includes(enc("Lucía Nube")), { timeout: 15_000 }).toBe(true);
    await page.goto("./ajustes");
    await expect(page.getByText("ana@clinica.test")).toBeVisible();
    await expect(page.getByText(/Guardado en tu Drive/)).toBeVisible();
    await expectAccessible(page);

    // Tablet de Ana: al entrar ya tiene a Lucía; apunta una sesión.
    const tablet = await device(browser, google, "ana", errors);
    await login(tablet);
    await tablet.getByRole("link", { name: /Lucía Nube/ }).click();
    await tablet.getByRole("link", { name: "Nueva sesión" }).click();
    await tablet.getByLabel("Tratamiento").fill("Desde la tablet");
    await tablet.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(tablet.getByText("Desde la tablet")).toBeVisible();
    await expect.poll(() => google.driveText("ana").includes(enc("Desde la tablet")), { timeout: 15_000 }).toBe(true);

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

    // La tablet cierra sesión borrando sus datos; al volver a entrar, Lucía vuelve desde Drive.
    await tablet.goto("./ajustes");
    await tablet.getByRole("button", { name: "Cerrar sesión y borrar los datos de este dispositivo" }).click();
    await tablet.getByRole("dialog", { name: "¿Borrar los datos de este dispositivo?" }).getByRole("button", { name: "Borrar y cerrar sesión" }).click();
    await enter(tablet);
    await expect(tablet.getByRole("link", { name: /Lucía Nube/ })).toBeVisible();
    // Borrar en el dispositivo no ha borrado nada en la nube.
    expect(google.driveText("ana").includes(enc("Desde la tablet"))).toBe(true);
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
    await expect.poll(() => google.driveText("ana").includes(enc("Previo Local")), { timeout: 15_000 }).toBe(true);
  });

  test("NB4 desde la pantalla principal: pegar el ID de cliente en el dispositivo y entrar", async ({ page }) => {
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { publish: false });
    await page.goto("./");
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
    // Vuelve de Google con la sesión iniciada: la pantalla principal ya enseña la cuenta.
    await expect(page.getByRole("link", { name: /Ana Ruiz/ })).toBeVisible({ timeout: 15_000 });
    await createPatient(page, { name: "Desde el Inicio" });
    await expect.poll(() => google.driveText("ana").includes(enc("Desde el Inicio")), { timeout: 15_000 }).toBe(true);
  });

  test("NB3 con la sesión de Google cerrada pide volver a entrar, o deja seguir sin conexión", async ({ page }) => {
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana");
    await login(page);
    await createPatient(page, { name: "Sin Sesión" });
    await expect.poll(() => google.driveText("ana").includes(enc("Sin Sesión")), { timeout: 15_000 }).toBe(true);

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

  test("NB5 copia de Drive cifrada: otro dispositivo de la cuenta pide la contraseña", async ({ page, browser }) => {
    test.slow();
    const google = new FakeGoogle(users);
    const errors: string[] = [];
    await google.install(page.context(), () => "ana");
    await login(page);
    await createPatient(page, { name: "Paciente Cifrado" });
    await expect.poll(() => google.driveText("ana").includes(enc("Paciente Cifrado")), { timeout: 15_000 }).toBe(true);

    await page.goto("./ajustes");
    await page.getByRole("button", { name: "Cifrar la copia de Drive" }).click();
    const sheet = page.getByRole("dialog", { name: "Cifrar la copia de Drive" });
    await sheet.getByLabel("Contraseña", { exact: true }).fill("corta");
    await sheet.getByLabel("Repite la contraseña").fill("corta");
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    await expect(sheet.getByText("Al menos 10 caracteres.")).toBeVisible();
    await sheet.getByLabel("Contraseña", { exact: true }).fill("frase de la clínica 2026");
    await sheet.getByLabel("Repite la contraseña").fill("frase de la clínica 2026");
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    await expect(page.getByText("La copia de tu Drive va cifrada")).toBeVisible();
    await expectAccessible(page);
    // En Drive ya no se lee nada: solo bytes cifrados.
    await expect.poll(() => google.driveText("ana").startsWith("CENITENC1"), { timeout: 15_000 }).toBe(true);
    expect(google.driveText("ana").includes(enc("Paciente Cifrado"))).toBe(false);

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
    await ask.getByLabel("Contraseña").fill("frase de la clínica 2026");
    await ask.getByRole("button", { name: "Abrir la copia" }).click();
    await tablet.getByRole("button", { name: "Mostrar" }).click();
    await expect(tablet.getByRole("link", { name: /Paciente Cifrado/ })).toBeVisible();

    // Lo que apunta la tablet se sube cifrado y llega al móvil.
    const before = google.appData("ana")[0]!.version;
    await createPatient(tablet, { name: "Desde la Tablet" });
    await expect.poll(() => google.appData("ana").length === 1 && google.appData("ana")[0]!.version > before, { timeout: 15_000 }).toBe(true);
    expect(google.driveText("ana").startsWith("CENITENC1")).toBe(true);
    await page.getByRole("button", { name: "Sincronizar ahora" }).click();
    await page.getByRole("button", { name: "Mostrar" }).click();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Desde la Tablet/ })).toBeVisible();
    expect(google.driveText("ana").includes(enc("Desde la Tablet"))).toBe(false);
    expect(errors).toEqual([]);
  });
});
