import { add, createPatient, downloadFrom, expect, expectAccessible, markAt, test, withoutCloud } from "./fixtures";
import type { Page } from "@playwright/test";

/** Espera a que el service worker controle la página (en la primera visita hace falta recargar). */
async function controlledBySw(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe("PWA: instalable y sin conexión", () => {
  test("PWA-H1 manifiesto con nombre, iconos y modo app", async ({ page, request, baseURL }) => {
    await page.goto("./");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await request.get(href!)).json();
    const base = new URL(baseURL!).pathname;
    expect(manifest).toMatchObject({ name: "OmniClin", short_name: "OmniClin", display: "standalone", lang: "es", start_url: base, scope: base });
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect((await request.get("icons/omniclin-apple-touch-icon.png")).status()).toBe(200);
  });

  test("PWA-H3 los datos se guardan en el dispositivo: siguen al recargar y al abrir otra dirección en la misma pestaña", async ({ page }) => {
    await page.goto("./ajustes");
    await expect(page.getByText(/guardado en el dispositivo/)).toBeVisible();
    await createPatient(page, { name: "Sara Sigue" });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sara Sigue" })).toBeVisible();
    // Otra dirección en la misma pestaña (como al volver de entrar con Google): Safari guarda la página anterior
    // congelada; la nueva tiene que poder abrir los datos (no «ya está abierta en otra pestaña»).
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Sara Sigue/ })).toBeVisible();
    await page.goto("./agenda");
    await page.goBack();
    await expect(page.getByRole("link", { name: /Sara Sigue/ })).toBeVisible();
    await expect(page.getByText("ya está abierta en otra pestaña")).toHaveCount(0);
  });

  test("PWA-H2 sin conexión: abre, conserva los datos y mide un CMJ entero", async ({ page, context }) => {
    await page.goto("./");
    await controlledBySw(page);
    await createPatient(page, { name: "Sin internet", mass: "70", pushOff: "40" });

    await context.setOffline(true);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Sin internet/ })).toBeVisible();
    await page.getByRole("link", { name: /Sin internet/ }).click();
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles((await import("./fixtures")).video.at240);
    await page.getByRole("button", { name: "Marcar el salto" }).click();
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Ver evolución" }).click(); // pantalla con las gráficas, también en caché
    await expect(page.getByText(/una sola medición/)).toBeVisible();
    await context.setOffline(false);
  });

  test("PWA-E3 otros dispositivos: enlace, código QR y pasos para cada sistema", async ({ page, context, baseURL, browserName }) => {
    // Safari no tiene estos permisos: copia con el toque de la persona, sin preguntar (y la prueba no puede leerlo).
    if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Instalar la app/ }).click();
    await expect(page.getByRole("heading", { name: "Instalar la app" })).toBeVisible();
    const url = new URL(baseURL!).href;
    await expect(page.getByRole("img", { name: `Código QR con el enlace de la app: ${url}` })).toBeVisible();
    for (const d of ["Ordenador con Chrome o Edge", "Mac con Safari", "iPad o iPhone", "Tablet o móvil Android"]) await expect(page.getByRole("heading", { name: new RegExp(d) })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Copiar enlace" }).click();
    await expect(page.getByRole("button", { name: "Enlace copiado" })).toBeVisible();
    if (browserName === "chromium") expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });

  test("PWA-E1 barra de abajo: cuatro pestañas que recuerdan dónde estabas; un punto en Ajustes si faltan datos", async ({ page }) => {
    const bar = page.getByRole("navigation", { name: "Principal" });
    const tab = (name: string | RegExp) => bar.getByRole("link", { name });
    await createPatient(page, { name: "Rosa Pestañas" });
    await expect(bar.getByRole("link")).toHaveCount(4);
    await expect(tab(/Ajustes.*hay datos por completar/)).toBeVisible();
    await expectAccessible(page);

    // De la ficha a la guía y de vuelta: cada pestaña sigue donde se dejó.
    await tab("Biblioteca").click();
    await page.getByRole("link", { name: /^Rodilla/ }).click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible();
    await tab("Pacientes").click();
    await expect(page.getByRole("heading", { name: "Rosa Pestañas", level: 1 })).toBeVisible();
    await tab("Biblioteca").click();
    await expect(page.getByRole("heading", { name: "Rodilla", level: 1 })).toBeVisible();
    // Pulsar la pestaña en la que se está vuelve a su inicio.
    await tab("Biblioteca").click();
    await expect(page.getByRole("heading", { name: "Biblioteca", level: 1 })).toBeVisible();
    await tab("Pacientes").click();
    await tab("Pacientes").click();
    await expect(page.getByRole("heading", { name: "Pacientes", level: 1 })).toBeVisible();

    // Con los datos de la clínica, el punto desaparece.
    await tab(/Ajustes/).click();
    await page.getByRole("link", { name: /Clínica y protección de datos/ }).click();
    await page.getByLabel("Clínica (nombre o razón social)").fill("Fisio Prueba");
    await page.getByLabel("Correo para ejercer los derechos").fill("datos@fisioprueba.test");
    await page.getByRole("button", { name: "Guardar los datos de la clínica" }).click();
    await expect(page.getByText("Datos de la clínica guardados")).toBeVisible();
    await page.getByRole("link", { name: "Volver a Ajustes" }).click();
    await expect(tab("Ajustes")).toBeVisible();
    await expect(tab(/por completar/)).toHaveCount(0);
  });

  test("PWA-E2 en iPhone explica Compartir → Añadir a pantalla de inicio", async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "es-ES",
    });
    await withoutCloud(ctx);
    const page = await ctx.newPage();
    await page.goto("./instalar");
    // Los pasos de este dispositivo (un iPhone), arriba del todo.
    const here = page.getByRole("heading", { name: "En este dispositivo" }).locator("+ div");
    await expect(here.getByText("«Añadir a pantalla de inicio»", { exact: true })).toBeVisible();
    await expect(here.getByText("Compartir", { exact: true })).toBeVisible();
    // Sin instalar, la pantalla principal avisa de que Safari puede borrar los datos.
    await page.goto("./");
    await expect(page.getByRole("status").filter({ hasText: "Instala la app en este iPhone" })).toBeVisible();
    await page.getByRole("link", { name: "Cómo instalarla" }).click();
    await expect(page.getByRole("heading", { name: "En este dispositivo" })).toBeVisible();
    await ctx.close();
  });

  test("PWA-E3 recordatorio de copia con pacientes reales, no con los de ejemplo", async ({ page }) => {
    // Cargar los datos de ejemplo ya tarda casi medio minuto: con el límite normal va justo.
    test.slow();
    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 30_000 });
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Lucía/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "copia de seguridad" })).toHaveCount(0);

    await createPatient(page, { name: "Real" });
    await page.goto("./");
    await expect(page.getByRole("status").filter({ hasText: "copia de seguridad" })).toBeVisible();
    await expect(page.getByText(/Todavía no has hecho ninguna copia de seguridad/)).toBeVisible();
    await page.getByRole("link", { name: "Hacer la copia" }).click();
    await downloadFrom(page, page.getByRole("button", { name: "Descargar copia de seguridad" }));
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Real/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "copia de seguridad" })).toHaveCount(0);
  });

  test("PWA-E4 ajustes: un menú con cada apartado y cómo está", async ({ page }) => {
    await page.goto("./ajustes");
    // Cuatro grupos de lo diario (Tu clínica, Dinero, Mensajes y formularios, App y datos) y, plegado, Avanzado.
    const groups: [string, RegExp[]][] = [
      ["Tu clínica", [/Clínica y protección de datos/, /Marca de la clínica/, /Anamnesis de la clínica/, /La clínica en números/]],
      ["Dinero", [/Precios y cobros/, /Para facturar/]],
      ["Mensajes y formularios", [/Mensajes a pacientes/, /Envíos pendientes/]],
      ["App y datos", [/Cuenta de Google/, /Copias y exportar/, /Importar datos/, /Bloqueo con PIN.*Desactivado/, /Privacidad/, /Instalar la app/, /Cómo se usa/]],
    ];
    for (const [group, rows] of groups) for (const name of rows) await expect(page.getByRole("region", { name: group, exact: true }).getByRole("link", { name })).toBeVisible();
    // Lo técnico no estorba: está plegado en Avanzado y se abre con un toque.
    await expect(page.getByRole("link", { name: /Validación de las mediciones/ })).toBeHidden();
    await page.locator("summary").filter({ hasText: "Avanzado" }).click();
    await expect(page.getByRole("region", { name: "Avanzado", exact: true }).getByRole("link", { name: /Validación de las mediciones/ })).toBeVisible();
    await expect(page.getByText(/Base de datos SQLite/)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: /Cómo se usa/ }).click();
    await expect(page.getByRole("heading", { name: "Cómo se usa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "cenitfisiolab@gmail.com" })).toHaveAttribute("href", "mailto:cenitfisiolab@gmail.com");
    await expect(page.getByRole("list", { name: "Pasos" }).getByRole("listitem")).toHaveCount(11);
    await expectAccessible(page);
  });
});
