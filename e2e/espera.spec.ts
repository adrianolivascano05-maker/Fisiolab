// Lista de espera (src/schedule/WaitlistPage.tsx, src/data/waitlist.ts): apuntar con horas concretas, desde qué día
// puede y si es preferente; ordenar por tiempo de espera o prioridad (se conserva al recargar) y filtrar por varias cosas
// a la vez, con los filtros puestos a la vista para quitarlos de uno en uno.
import type { Page } from "@playwright/test";
import { expect, expectAccessible, importData, smallTargets, test } from "./fixtures";

/** Apunta a un paciente en la lista con lo que se le diga del formulario. */
async function addToList(page: Page, name: string, fill: (sheet: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.goto("./agenda/espera");
  await page.getByRole("button", { name: "Añadir a la lista" }).click();
  const sheet = page.getByRole("dialog", { name: "Añadir a la lista de espera" });
  await sheet.getByLabel("Paciente", { exact: true }).fill(name.split(" ")[0]!);
  await sheet.getByRole("button", { name }).click();
  await fill(sheet);
  await sheet.getByRole("button", { name: "Añadir a la lista" }).click();
  await expect(page.getByRole("group", { name })).toBeVisible();
}

const order = (page: Page) => page.getByRole("list", { name: "Lista de espera" }).getByRole("group").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));

test("LE1 ordenar por tiempo de espera o prioridad y filtrar por franja, días, preferentes y si ya pueden, todo a la vez", async ({ page }) => {
  test.slow();
  // Martes 20 de octubre de 2026, 10:00 en Madrid.
  await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  await importData(page, "Nombre;Teléfono\r\nAna Mañana;600 000 001\r\nBea Tarde;600 000 002\r\nCarlos Horas;600 000 003\r\nDora Cualquiera;600 000 004\r\n");
  // Cada una se apunta un día distinto: Dora hace 20 días, Ana hace 10, Bea hace 3 y Carlos hoy.
  await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
  await addToList(page, "Dora Cualquiera", async () => {});
  await page.clock.setFixedTime(new Date("2026-10-10T08:00:00Z"));
  await addToList(page, "Ana Mañana", async (s) => {
    await s.getByText("Mañanas", { exact: true }).click();
    await s.getByLabel("lunes").check({ force: true });
  });
  await page.clock.setFixedTime(new Date("2026-10-17T08:00:00Z"));
  await addToList(page, "Bea Tarde", async (s) => {
    await s.getByText("Tardes", { exact: true }).click();
    await s.getByLabel(/Preferente/).check();
  });
  await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  await addToList(page, "Carlos Horas", async (s) => {
    await s.getByText("Horas concretas", { exact: true }).click();
    await s.getByLabel("Desde").fill("18:00");
    await s.getByLabel("Hasta").fill("20:00");
    await s.getByLabel("martes").check({ force: true });
    await s.getByLabel("Puede a partir del (opcional)").fill("2026-11-02");
  });
  await expect(page.getByRole("group", { name: "Bea Tarde" })).toContainText("Preferente");
  await expect(page.getByRole("group", { name: "Carlos Horas" })).toContainText("De 18:00 a 20:00, martes");
  await expect(page.getByRole("group", { name: "Carlos Horas" })).toContainText("Puede desde el 2 de noviembre");

  // Orden: por defecto, quien más lleva esperando; también al revés y preferentes primero, y se conserva al recargar.
  await expect(page.getByText("4 pacientes esperando")).toBeVisible();
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera", "Ana Mañana", "Bea Tarde", "Carlos Horas"]);
  await page.getByLabel("Ordenar por").selectOption({ label: "Menos tiempo esperando" });
  await expect.poll(() => order(page)).toEqual(["Carlos Horas", "Bea Tarde", "Ana Mañana", "Dora Cualquiera"]);
  await page.getByLabel("Ordenar por").selectOption({ label: "Preferentes primero" });
  await page.reload();
  await expect(page.getByLabel("Ordenar por")).toHaveValue("prioridad");
  await expect.poll(() => order(page)).toEqual(["Bea Tarde", "Dora Cualquiera", "Ana Mañana", "Carlos Horas"]);
  await page.getByLabel("Ordenar por").selectOption({ label: "Más tiempo esperando" });

  // Filtros combinados: mañanas (Dora puede a cualquier hora) y martes.
  await page.getByRole("button", { name: "Filtros" }).click();
  const filters = page.getByRole("dialog", { name: "Filtrar la lista de espera" });
  await expectAccessible(page);
  await filters.getByText("Mañanas", { exact: true }).click();
  await expect(filters.getByRole("button", { name: "Ver 2 pacientes" })).toBeVisible();
  // El filtro va en la dirección: la casilla se marca un instante después del toque.
  await filters.getByLabel("Puede el martes").click({ force: true });
  await expect(filters.getByLabel("Puede el martes")).toBeChecked();
  await filters.getByRole("button", { name: "Ver 1 paciente" }).click();
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera"]);
  await expect(page.getByRole("button", { name: "Filtros (2)" })).toBeVisible();
  await expect(page.getByText("1 de 4 pacientes")).toBeVisible();
  // Se quitan de uno en uno: sin «Mañanas», los del martes (a cualquier hora).
  await page.getByRole("button", { name: "Quitar el filtro: Mañanas" }).click();
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera", "Bea Tarde", "Carlos Horas"]);
  // Y solo los que ya pueden venir: Carlos no puede hasta noviembre.
  await page.getByRole("button", { name: "Filtros (1)" }).click();
  await filters.getByText("Ya pueden venir", { exact: true }).click();
  await filters.getByRole("button", { name: "Ver 2 pacientes" }).click();
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera", "Bea Tarde"]);
  // Nadie: lo dice, y se quitan todos.
  await page.getByRole("button", { name: "Filtros (2)" }).click();
  await filters.getByText("Más de un mes", { exact: true }).click();
  await filters.getByRole("button", { name: "Ver 0 pacientes" }).click();
  await expect(page.getByText("Nadie cumple estos filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar todos" }).click();
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera", "Ana Mañana", "Bea Tarde", "Carlos Horas"]);

  // Buscar por nombre o teléfono.
  await page.getByLabel("Buscar en la lista de espera").fill("600 000 004");
  await expect.poll(() => order(page)).toEqual(["Dora Cualquiera"]);
  await page.getByLabel("Buscar en la lista de espera").fill("");

  // Cambiar: las horas se ven al abrir y se pasan a tardes.
  await page.getByRole("group", { name: "Carlos Horas" }).getByRole("button", { name: "Cambiar" }).click();
  const edit = page.getByRole("dialog", { name: "Lista de espera: Carlos Horas" });
  await expect(edit.getByLabel("Desde")).toHaveValue("18:00");
  await edit.getByText("Tardes", { exact: true }).click();
  await edit.getByLabel("Puede a partir del (opcional)").fill("");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("group", { name: "Carlos Horas" })).toContainText("Tardes, martes");
  await expect(page.getByRole("group", { name: "Carlos Horas" })).not.toContainText("Puede desde");

  // En el móvil pequeño: sin desbordes y todo se toca bien.
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(await smallTargets(page)).toEqual([]);
  await page.getByRole("button", { name: "Filtros" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expectAccessible(page);
});
