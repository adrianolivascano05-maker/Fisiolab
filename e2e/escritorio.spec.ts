import type { Page } from "@playwright/test";
import { expect, expectAccessible, loadSeed, test } from "./fixtures";

// El ordenador (desde 1024 px): el menú principal a la izquierda en vez de la barra de abajo, Pacientes como lista
// fija + ficha, el inicio con lo de hoy y las hojas centradas. Por debajo de 1024 px la app es la del móvil, que
// prueban el resto de archivos.
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

const menu = (page: Page) => page.getByRole("navigation", { name: "Principal" });
const list = (page: Page) => page.getByRole("complementary", { name: "Lista de pacientes" });
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("Ordenador", () => {
  test("ES1 menú lateral, inicio con lo de hoy, lista de pacientes junto a la ficha y hojas centradas", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    // Un solo menú principal a la vista: el lateral, pegado a la izquierda de arriba abajo y con sus nombres.
    await expect(menu(page)).toHaveCount(1);
    const side = (await menu(page).boundingBox())!;
    expect([side.x, side.width, side.height]).toEqual([0, 240, 800]);
    for (const name of ["Pacientes", "Agenda", "Biblioteca", "Ajustes"]) await expect(menu(page).getByRole("link", { name })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Pacientes" })).toHaveAttribute("aria-current", "page");

    // El inicio: la fecha de hoy y lo de hoy (la misma vista que Agenda › Hoy), con la lista de pacientes al lado.
    const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(today.charAt(0).toUpperCase() + today.slice(1));
    await expect(page.getByRole("main").getByRole("link", { name: /Lista de espera/ })).toBeVisible();
    await expect(list(page).getByRole("heading", { name: "Pacientes" })).toBeVisible();
    await expectAccessible(page);

    // Abrir un paciente: la ficha a la derecha y, en la lista, el paciente abierto marcado.
    await list(page).getByRole("link", { name: /Marcos Vidal/ }).click();
    await expect(page.getByRole("heading", { name: /Marcos Vidal/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Situación" })).toBeVisible();
    await expect(list(page).getByRole("link", { name: /Marcos Vidal/ })).toHaveAttribute("aria-current", "page");
    // Buscar en el panel filtra la lista sin salir de la ficha.
    await list(page).getByLabel("Buscar paciente").fill("Irene");
    await expect(list(page).getByRole("link", { name: /Irene Soto/ })).toBeVisible();
    await expect(list(page).getByRole("link", { name: /Marcos Vidal/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Situación" })).toBeVisible();
    await list(page).getByLabel("Buscar paciente").fill("");
    await expect(list(page).getByRole("link", { name: /Marcos Vidal/ })).toBeVisible();

    // Las hojas salen centradas en la pantalla, no pegadas abajo, y se cierran con Escape.
    await page.getByRole("button", { name: "Valorar" }).click();
    const sheet = page.getByRole("dialog", { name: "Valorar" });
    await expect(sheet).toBeVisible();
    const s = (await sheet.boundingBox())!;
    expect(Math.abs(s.x + s.width / 2 - 640)).toBeLessThan(2);
    expect(Math.abs(s.y + s.height / 2 - 400)).toBeLessThan(2);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    // «Nuevo» desde el panel: el formulario a la derecha y la lista sigue a la vista.
    await list(page).getByRole("link", { name: "Nuevo paciente" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo paciente" })).toBeVisible();
    await expect(list(page)).toBeVisible();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
  });

  test("ES2 las pantallas principales a 1280 px: sin desbordes, con el menú lateral y accesibles", async ({ page }) => {
    await loadSeed(page);
    for (const path of ["./agenda", "./agenda?vista=hoy", "./biblioteca", "./biblioteca/cuestionarios", "./ajustes", "./ajustes/aspecto", "./ajustes/datos", "./ayuda"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await scrollWidth(page), path).toBeLessThanOrEqual(1280);
      await expect(menu(page), path).toBeVisible();
      await expectAccessible(page);
    }
    // La ficha, pestaña a pestaña.
    await page.goto("./");
    await list(page).getByRole("link", { name: /Marcos Vidal/ }).click();
    const tabs = page.getByRole("navigation", { name: "Ficha del paciente" });
    for (const tab of ["Anamnesis", "Valoración", "Sesiones", "Resumen"]) {
      await tabs.getByRole("link", { name: tab }).click();
      await expect(tabs.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
      await page.waitForLoadState("networkidle");
      expect(await scrollWidth(page), tab).toBeLessThanOrEqual(1280);
      await expectAccessible(page);
    }
  });

  test("ES3 a 1024 px el menú es una franja de iconos con nombre accesible; en una ventana estrecha, la app del móvil", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("./");
    expect((await menu(page).boundingBox())!.width).toBe(72);
    await expect(menu(page).getByRole("link", { name: "Biblioteca" })).toBeVisible();
    await expect(list(page)).toBeVisible();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1024);
    await expectAccessible(page);
    // Estrechando la ventana (o una tableta en vertical): la barra de abajo y Pacientes como pantalla propia.
    await page.setViewportSize({ width: 800, height: 900 });
    const bar = (await menu(page).boundingBox())!;
    expect([bar.x, bar.width, bar.y + bar.height]).toEqual([0, 800, 900]);
    await expect(list(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    await expect(page.getByLabel("Buscar paciente")).toBeVisible();
  });
});
