// En el móvil, «Hoy» y «Día» son una sola vista (docs/rediseno-sencilla.md): el día de hoy sale para atender y cobrar,
// con lo pendiente debajo; «Ver huecos libres» lo cambia por la lista con huecos, donde también se cobra.
import { expect, expectAccessible, smallTargets, test } from "./fixtures";

test("AD1 el día de hoy: una sola vista, «Pendiente N», huecos libres y cobrar desde la lista", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Hugo Hoy");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Hugo Hoy" })).toBeVisible();
  // Una cita hoy, a última hora.
  // Hoy en Madrid (la app y el navegador de las pruebas van en esa hora; la máquina, no siempre).
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  await page.getByRole("button", { name: "Dar cita" }).click();
  const sheet = page.getByRole("dialog", { name: "Dar cita a Hugo Hoy" });
  await sheet.getByLabel("Día y hora").fill(`${today}T23:00`);
  await sheet.getByRole("button", { name: /^Dar la cita/ }).click();
  if (await sheet.getByRole("button", { name: "Darla igualmente" }).isVisible().catch(() => false)) await sheet.getByRole("button", { name: "Darla igualmente" }).click();
  await expect(sheet).toBeHidden();

  // Una sola vista: «Día» (no hay «Hoy» aparte), con la tira de la semana y la lista para atender.
  await page.goto("./agenda?vista=hoy");
  const views = page.getByRole("group", { name: "Vista" });
  await expect(views.getByRole("button", { name: "Día", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(views.getByRole("button", { name: "Hoy" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Días de la semana" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Citas de hoy" })).toContainText("Hugo Hoy");
  // «Pendiente N» cuenta también lo que falta por firmar (aquí, su hoja de protección de datos) y baja hasta ello.
  const pending = page.getByRole("button", { name: /^Pendiente \d+$/ });
  await expect(pending).toBeVisible();
  await pending.click();
  await expect(page.getByRole("region", { name: "Pendiente", exact: true })).toBeInViewport();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // Los huecos libres de hoy: la lista del día, donde la cita que toca lleva «Atender» y «Cobrar».
  await page.getByRole("button", { name: "Ver huecos libres" }).click();
  const list = page.getByRole("list", { name: /^Citas del / });
  await expect(list.getByRole("link", { name: "Atender a Hugo" })).toBeVisible();
  await list.getByRole("button", { name: "Cobrar a Hugo" }).click();
  const pay = page.getByRole("dialog", { name: /Cobrar/ });
  await expect(pay.getByLabel("Cantidad")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  // Otro día de la tira: su lista; y «Volver a atender» devuelve la de hoy.
  await page.getByRole("button", { name: "Volver a atender" }).click();
  await expect(page.getByRole("region", { name: "Citas de hoy" })).toBeVisible();
});
