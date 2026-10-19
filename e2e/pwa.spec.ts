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
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Instalar y usar en otros dispositivos/ }).click();
    await expect(page.getByRole("heading", { name: "Instalar la app" })).toBeVisible();
    const url = new URL(baseURL!).href;
    await expect(page.getByRole("img", { name: `Código QR con el enlace de la app: ${url}` })).toBeVisible();
    for (const d of ["Ordenador con Chrome o Edge", "Mac con Safari", "iPad o iPhone", "Tablet o móvil Android"]) await expect(page.getByRole("heading", { name: new RegExp(d) })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Copiar enlace" }).click();
    await expect(page.getByRole("button", { name: "Enlace copiado" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });

  test("PWA-E1 primeros pasos: instalar, clínica y primer paciente; se marcan al hacerlos y se pueden ocultar", async ({ page }) => {
    await page.goto("./");
    const steps = page.getByRole("region", { name: "Primeros pasos" });
    await expect(steps).toBeVisible();
    await expect(steps.getByText(/^0 de \d hechos$/)).toBeVisible();
    await expect(steps.getByRole("link", { name: /Instalar la app en este dispositivo/ })).toBeVisible();
    await expectAccessible(page);
    // El primer paciente queda marcado.
    await steps.getByRole("link", { name: /Tu primer paciente/ }).click();
    await page.getByLabel("Nombre").fill("Primero");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Primero" })).toBeVisible();
    await page.goto("./");
    await expect(steps.getByRole("link", { name: /Tu primer paciente.*Hecho/ })).toBeVisible();
    // Instalar lleva a la pantalla con los pasos de este dispositivo.
    await steps.getByRole("link", { name: /Instalar la app en este dispositivo/ }).click();
    await expect(page.getByRole("heading", { name: "En este dispositivo" })).toBeVisible();
    await expect(page.getByText(/«Instalar app»|Instalar la app|Añadir a pantalla de inicio/).first()).toBeVisible();
    await page.goto("./");
    await steps.getByRole("button", { name: "Ocultar" }).click();
    await expect(steps).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("link", { name: /Primero/ })).toBeVisible();
    await expect(steps).toHaveCount(0);
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
    await ctx.close();
  });

  test("PWA-E3 recordatorio de copia con pacientes reales, no con los de ejemplo", async ({ page }) => {
    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 30_000 });
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Lucía/ })).toBeVisible();
    await expect(page.getByText("Haz una copia de seguridad")).toHaveCount(0);

    await createPatient(page, { name: "Real" });
    await page.goto("./");
    await expect(page.getByText("Haz una copia de seguridad")).toBeVisible();
    await expect(page.getByText("Todavía no has hecho ninguna.", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Hacer la copia" }).click();
    await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar copia de seguridad" }).click()]);
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Real/ })).toBeVisible();
    await expect(page.getByText("Haz una copia de seguridad")).toHaveCount(0);
  });

  test("PWA-E4 ajustes: un menú con cada apartado y cómo está", async ({ page }) => {
    await page.goto("./ajustes");
    for (const name of [/Cuenta de Google/, /Clínica y protección de datos/, /Bloqueo con PIN.*Desactivado/, /Copias de seguridad y exportar/, /Instalar y usar/, /Cómo se usa/, /Validación de las mediciones/, /Privacidad/])
      await expect(page.getByRole("link", { name })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: /Cómo se usa/ }).click();
    await expect(page.getByRole("heading", { name: "Cómo se usa" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Pasos" }).getByRole("listitem")).toHaveCount(5);
    await expectAccessible(page);
  });
});
