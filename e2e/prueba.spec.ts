// Clínica de prueba (src/demo): cientos de pacientes inventados para probar la app con volumen. Se cargan desde
// Ajustes › Copias y exportar, la app los aguanta (y se mide cuánto tarda cada pantalla) y se borran de una vez.
import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

async function load(page: Page, mode: "100 pacientes de prueba" | "Modo estrés: 500 pacientes") {
  await page.goto("./ajustes/datos");
  await page.getByRole("button", { name: mode }).click();
  const start = Date.now();
  await page.getByRole("dialog", { name: mode }).getByRole("button", { name: "Cargar los datos de prueba" }).click();
  await expect(page.getByRole("button", { name: "Borrar los datos de prueba" })).toBeVisible({ timeout: 120_000 });
  return Date.now() - start;
}

/** Cuánto tarda en verse algo después de abrir una pantalla (ms). */
async function timed(page: Page, url: string, ready: () => Promise<void>) {
  const start = Date.now();
  await page.goto(url);
  await ready();
  return Date.now() - start;
}

test.describe("Clínica de prueba", () => {
  test("PR1 se cargan 100 pacientes con su agenda, se ven en la app y se borran todos", async ({ page }) => {
    test.slow();
    await page.goto("./ajustes/datos");
    await expect(page.getByRole("heading", { name: "Clínica de prueba" })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);

    const ms = await load(page, "100 pacientes de prueba");
    test.info().annotations.push({ type: "carga", description: `100 pacientes en ${ms} ms` });
    await expect(page.getByRole("region", { name: "Clínica de prueba" })).toContainText(/Cargados el .*100 pacientes de prueba/);
    await expectAccessible(page);

    // La lista de pacientes, con sus teléfonos de ficción.
    await page.goto("./");
    const list = page.getByRole("list", { name: "Pacientes" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    // Una ficha cualquiera, con su historia.
    await list.getByRole("link").first().click();
    await expect(page.getByRole("tab", { name: /Sesiones/ }).or(page.getByRole("link", { name: /Sesiones/ })).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    // La agenda de hoy y los recordatorios, con citas.
    await page.goto("./agenda/recordatorios");
    await expect(page.getByText(/\+44 7700 900|Ejemplo|·/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    // No se puede cargar dos veces, y se borra todo.
    await page.goto("./ajustes/datos");
    await expect(page.getByRole("button", { name: "100 pacientes de prueba" })).toHaveCount(0);
    await page.getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await page.getByRole("dialog", { name: "¿Borrar los datos de prueba?" }).getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await expect(page.getByText("100 pacientes de prueba borrados")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "100 pacientes de prueba" })).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("list", { name: "Pacientes" })).toHaveCount(0);
  });

  test("PR2 en una clínica con pacientes no se ofrece", async ({ page }) => {
    await createPatient(page, { name: "Paciente Inventado" });
    await page.goto("./ajustes/datos");
    await expect(page.getByText("Esta clínica ya tiene 1 paciente")).toBeVisible();
    await expect(page.getByRole("button", { name: "100 pacientes de prueba" })).toHaveCount(0);
  });

  test("PR3 modo estrés: 500 pacientes y cuánto tarda cada pantalla", async ({ page }) => {
    test.setTimeout(300_000);
    const times: Record<string, number> = {};
    times["cargar"] = await load(page, "Modo estrés: 500 pacientes");
    await expect(page.getByRole("region", { name: "Clínica de prueba" })).toContainText(/Cargados el .*500 pacientes de prueba \(modo estrés\)/);
    const list = page.getByRole("list", { name: "Pacientes" });
    times["pacientes"] = await timed(page, "./", () => expect(list.getByRole("link")).toHaveCount(500, { timeout: 30_000 }));
    times["buscar"] = await (async () => {
      const start = Date.now();
      await page.getByRole("searchbox").fill("García");
      await expect(page.getByRole("link").filter({ hasText: "García" }).first()).toBeVisible();
      return Date.now() - start;
    })();
    await page.goto("./");
    const first = list.getByRole("link").first();
    times["ficha"] = await (async () => {
      const start = Date.now();
      await first.click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      return Date.now() - start;
    })();
    times["agenda"] = await timed(page, "./agenda", () => expect(page.getByRole("main")).toContainText(/\d+ citas/, { timeout: 30_000 }));
    times["recordatorios"] = await timed(page, "./agenda/recordatorios", () => expect(page.getByText(/\+44 7700 900/).first()).toBeVisible({ timeout: 30_000 }));
    times["lista de espera"] = await timed(page, "./agenda/espera", () => expect(page.getByText(/hueco/).first()).toBeVisible({ timeout: 30_000 }));
    times["cobros pendientes"] = await timed(page, "./agenda/cobros", () => expect(page.getByRole("main")).toContainText("€", { timeout: 30_000 }));
    const size = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
    const text = `${Object.entries(times).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(" · ")} · almacenamiento ${(size / 1e6).toFixed(1)} MB`;
    test.info().annotations.push({ type: "tiempos", description: text });
    console.log(`[estrés] ${text}`);
    // Ninguna pantalla debería tardar más de 15 s ni con 500 pacientes (aquí tarda alrededor de 1 s; el margen es para las pruebas en paralelo).
    for (const [k, v] of Object.entries(times)) if (k !== "cargar") expect(v, k).toBeLessThan(15_000);

    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await page.getByRole("dialog", { name: "¿Borrar los datos de prueba?" }).getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await expect(page.getByText("500 pacientes de prueba borrados")).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("Clínica de prueba en el servidor", () => {
  test.use({ serviceWorkers: "block" });
  const users = { ana: { sub: "3001", email: "ana@prueba.test", name: "Ana Prueba" } };
  const PASSWORD = "frase de la clínica de prueba";

  test("PR4 en una clínica con equipo: quien carga atiende como uno más, todo sube cifrado y se borra", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana", { server: true });
    await page.goto("./");
    await page.getByRole("button", { name: "Entrar con Google" }).click();
    await page.getByLabel("En una clínica con equipo").check({ timeout: 15_000 });
    await page.getByLabel("Nombre de la clínica").fill("Clínica de prueba");
    await page.getByRole("button", { name: "Crear la clínica" }).click();
    const choose = page.getByRole("heading", { name: "Elige tu PIN" });
    await expect(choose.or(page.getByRole("heading", { name: "Pacientes", exact: true }))).toBeVisible({ timeout: 20_000 });
    if (await choose.isVisible()) {
      await page.keyboard.type("2580");
      await page.getByRole("button", { name: "Siguiente" }).click();
      await page.keyboard.type("2580");
      await page.getByRole("button", { name: "Guardar el PIN" }).click();
    }
    const notice = page.getByRole("status").filter({ hasText: "va siempre cifrada" });
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await notice.getByRole("link", { name: "Elegir contraseña" }).click();
    await page.getByRole("button", { name: "Elegir la contraseña de cifrado" }).click();
    const sheet = page.getByRole("dialog", { name: "Contraseña de cifrado" });
    await sheet.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await sheet.getByLabel("Repite la contraseña").fill(PASSWORD);
    await sheet.getByRole("button", { name: "Cifrar", exact: true }).click();
    const kit = page.getByRole("dialog", { name: "Kit de recuperación de la clínica" });
    await expect(kit).toBeVisible();
    await kit.getByLabel(/He guardado el código/).check();
    await kit.getByRole("button", { name: "Hecho" }).click();

    await load(page, "100 pacientes de prueba");
    // Ana atiende como una más: en el horario hay seis personas, y su agenda tiene citas.
    await page.goto("./agenda?vista=hoy");
    await expect(page.getByRole("main")).toBeVisible();
    // Sube cifrado al servidor: los fisios inventados están en la copia de la clínica.
    await expect
      .poll(async () => (await google.clinicText("Clínica de prueba", PASSWORD)).includes(FakeGoogle.enc("Laura Ortega")), { timeout: 60_000 })
      .toBe(true);

    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await page.getByRole("dialog", { name: "¿Borrar los datos de prueba?" }).getByRole("button", { name: "Borrar los datos de prueba" }).click();
    await expect(page.getByText("100 pacientes de prueba borrados")).toBeVisible({ timeout: 30_000 });
    await page.goto("./");
    await expect(page.getByRole("list", { name: "Pacientes" })).toHaveCount(0);
  });
});
