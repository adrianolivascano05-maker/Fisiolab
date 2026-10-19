import { createPatient, expect, expectAccessible, markAt, test, withoutCloud } from "./fixtures";
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
    expect(manifest).toMatchObject({ name: "Cénit · Fisiolab", short_name: "Cénit", display: "standalone", lang: "es", start_url: base, scope: base });
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect((await request.get("icons/apple-touch-icon.png")).status()).toBe(200);
  });

  test("PWA-H2 sin conexión: abre, conserva los datos y mide un CMJ entero", async ({ page, context }) => {
    await page.goto("./");
    await controlledBySw(page);
    await createPatient(page, { name: "Sin internet", mass: "70", pushOff: "40" });

    await context.setOffline(true);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Sin internet/ })).toBeVisible();
    await page.getByRole("link", { name: /Sin internet/ }).click();
    await page.getByRole("link", { name: "Nueva medición" }).click();
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

  test("PWA-E3 otros dispositivos: enlace, código QR y pasos para cada sistema", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");
    await page.getByRole("link", { name: "Usar la app en otros dispositivos" }).click();
    await expect(page.getByRole("heading", { name: "Otros dispositivos" })).toBeVisible();
    const url = new URL(baseURL!).href;
    await expect(page.getByRole("img", { name: `Código QR con el enlace de la app: ${url}` })).toBeVisible();
    for (const d of ["Ordenador con Chrome o Edge", "Mac con Safari", "iPad o iPhone", "Tablet o móvil Android"]) await expect(page.getByRole("heading", { name: new RegExp(d) })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Copiar enlace" }).click();
    await expect(page.getByRole("button", { name: "Enlace copiado" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });

  test("PWA-E1 tarjeta de instalación: pasos y ocultar durante dos semanas", async ({ page }) => {
    await page.goto("./");
    const card = page.getByRole("heading", { name: "Ten Cénit a un toque" });
    await expect(card).toBeVisible();
    await expect(page.getByText(/«Instalar app»|Instalar la app|Añadir a pantalla de inicio/).first()).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Ocultar durante dos semanas" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Todavía no hay pacientes")).toBeVisible();
    await expect(card).toHaveCount(0);
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
    await page.goto("./");
    await expect(page.getByText("«Añadir a pantalla de inicio»")).toBeVisible();
    await expect(page.getByText("Compartir", { exact: true })).toBeVisible();
    await ctx.close();
  });

  test("PWA-E3 recordatorio de copia con pacientes reales, no con los de ejemplo", async ({ page }) => {
    await page.goto("./ajustes");
    await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 15_000 });
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Lucía/ })).toBeVisible();
    await expect(page.getByText("Haz una copia de seguridad")).toHaveCount(0);

    await createPatient(page, { name: "Real" });
    await page.goto("./");
    await expect(page.getByText("Haz una copia de seguridad")).toBeVisible();
    await expect(page.getByText("Todavía no has hecho ninguna.", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Ir a Ajustes" }).click();
    await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar copia de seguridad" }).click()]);
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Real/ })).toBeVisible();
    await expect(page.getByText("Haz una copia de seguridad")).toHaveCount(0);
  });

  test("PWA-E4 ajustes muestran la instalación y la protección de datos", async ({ page }) => {
    await page.goto("./ajustes");
    await expect(page.getByRole("heading", { name: "Instalación" })).toBeVisible();
    await expect(page.getByText(/El navegador (todavía no )?protege los datos/)).toBeVisible();
    await expectAccessible(page);
  });
});
