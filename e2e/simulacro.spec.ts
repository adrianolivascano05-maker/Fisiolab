import type { Page } from "@playwright/test";
import { expect, expectAccessible, loadSeed, test, withoutCloud } from "./fixtures";

// Simulacro de desastre: se pierde el móvil. Con la copia de seguridad descargada, en un dispositivo nuevo (otro
// navegador, sin nada guardado) se restaura y tiene que estar todo: pacientes, anamnesis, sesiones, valoraciones,
// citas y cobros.

/** Lo que se ve en las pantallas que más se usan: lo mismo antes de perder el móvil y después de restaurar. */
async function snapshot(page: Page) {
  const seen: Record<string, string> = {};
  const text = async () => (await page.getByRole("main").innerText()).replace(/\s+/g, " ").trim();
  // En la ficha, la cabecera termina de cargar después (el motivo y la cita): se espera a que esté entera.
  const header = async () => {
    await expect(page.getByRole("button", { name: /Motivo/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dar cita|Próxima cita/ })).toBeVisible();
  };
  await page.goto("./");
  await expect(page.getByRole("link", { name: /Marcos Vidal/ })).toBeVisible();
  seen.pacientes = (await page.getByRole("list", { name: "Pacientes" }).innerText()).replace(/\s+/g, " ");
  await page.getByRole("link", { name: /Marcos Vidal/ }).click();
  await expect(page.getByRole("heading", { name: "Situación" })).toBeVisible();
  await header();
  seen.resumen = await text();
  const tabs = page.getByRole("navigation", { name: "Ficha del paciente" });
  await tabs.getByRole("link", { name: "Valoración" }).click();
  await expect(page.getByRole("heading", { name: "Mediciones", exact: true })).toBeVisible();
  await header();
  seen.valoracion = await text();
  await tabs.getByRole("link", { name: "Sesiones" }).click();
  await expect(page.getByRole("heading", { name: "Historia" })).toBeVisible();
  await header();
  seen.sesiones = await text();
  await page.goto("./agenda?vista=hoy");
  await expect(page.getByRole("link", { name: /Lista de espera/ })).toBeVisible();
  seen.hoy = await text();
  await page.goto("./ajustes/cobros");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  seen.cobros = await text();
  return seen;
}

test("SIM1 se pierde el móvil: en uno nuevo, la copia de seguridad lo devuelve todo", async ({ page, browser }) => {
  test.slow();
  await loadSeed(page);
  const before = await snapshot(page);
  expect(before.pacientes).toMatch(/Marcos Vidal.*Lucía Herr|Lucía Herr.*Marcos Vidal/);

  await page.goto("./ajustes/datos");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar copia de seguridad" }).click()]);
  const backup = (await dl.path())!;

  // El móvil nuevo: otro navegador, vacío.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-ES", timezoneId: "Europe/Madrid" });
  await withoutCloud(fresh);
  const phone = await fresh.newPage();
  const errors: string[] = [];
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto("./");
  await expect(phone.getByText("Todavía no hay pacientes")).toBeVisible();
  await phone.goto("./ajustes/datos");
  await phone.getByLabel("Elegir copia de seguridad").setInputFiles(backup);
  await phone.getByRole("dialog").getByRole("button", { name: "Sustituir mis datos" }).click();
  await expect(phone.getByText("Copia restaurada")).toBeVisible();

  const after = await snapshot(phone);
  for (const k of Object.keys(before)) expect(after[k], k).toBe(before[k]);
  await expectAccessible(phone);
  expect(errors).toEqual([]);
  await fresh.close();
});
