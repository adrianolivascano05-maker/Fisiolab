import { readFileSync } from "node:fs";
import { add, createPatient, expect, expectAccessible, startJump, test } from "./fixtures";

test.describe("S25 Ayuda con ilustraciones", () => {
  for (const [type, radio, first] of [
    ["CMJ", /^CMJ \(con contramovimiento\)/, "Preparado"],
    ["SJ", /^SJ /, "Preparado"],
    ["Drop jump", /Drop jump/, "Contacto"],
  ] as const) {
    test(`AY-${type}: cómo grabar y qué fotograma marcar`, async ({ page }) => {
      await createPatient(page, { name: "Ayuda" });
      await add(page, "Medición").click();
      await page.getByRole("link", { name: /Saltos/ }).click();
      await page.getByRole("radio", { name: radio }).check({ force: true });
      await page.getByRole("button", { name: "Cómo grabar y marcar" }).click();
      const sheet = page.getByRole("dialog", { name: `Cómo medir un ${type}` });
      await expect(sheet.getByRole("img", { name: /Móvil apoyado en el suelo/ })).toBeVisible();
      const phases = sheet.getByRole("listitem").filter({ has: page.locator("svg") });
      await expect(phases).toHaveCount(4);
      await expect(phases.first()).toContainText(first);
      await expect(phases.nth(1)).toContainText("Primer fotograma con los dos pies en el aire.");
      await expectAccessible(page);
    });
  }

  test("AY-S07: la ayuda también se abre desde el marcado", async ({ page }) => {
    await createPatient(page, { name: "Ayuda marcado" });
    await startJump(page);
    await page.getByRole("button", { name: "Cómo marcar" }).click();
    await expect(page.getByRole("dialog", { name: "Cómo marcar un CMJ" })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("Algo no funciona", () => {
  test("AY-F1 problemas frecuentes e informe de fallo con los errores de este dispositivo, sin mandar nada solo", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./ajustes");
    await expect(page.getByRole("link", { name: /Algo no funciona.*Problemas frecuentes/ })).toBeVisible();
    // Un fallo anotado (como lo haría la app al fallar la sincronización).
    await page.evaluate(() =>
      localStorage.setItem("fisiolab.errors", JSON.stringify([{ at: "2026-10-24T08:00:00.000Z", where: "sincronización", message: "Error: el servidor no responde", path: "/agenda" }])),
    );
    await page.reload();
    await page.getByRole("link", { name: /Algo no funciona.*1 error anotado/ }).click();
    await expect(page.getByRole("heading", { name: "Algo no funciona" })).toBeVisible();
    await expectAccessible(page);

    await page.getByText("En el iPhone han desaparecido los datos").click();
    await expect(page.getByText(/Safari puede borrar los datos/)).toBeVisible();

    await page.getByLabel("Qué pasó").fill("No se guardaba la cita");
    await page.getByText("Ver el informe").click();
    const report = page.getByLabel("Informe de fallo", { exact: true });
    await expect(report).toContainText("Qué pasó: No se guardaba la cita");
    await expect(report).toContainText("Versión:");
    await expect(report).toContainText("Error: el servidor no responde");
    const mail = page.getByRole("link", { name: "Enviar por correo" });
    await expect(mail).toHaveAttribute("href", /^mailto:cenitfisiolab@gmail\.com\?subject=Informe%20de%20fallo/);
    await page.getByRole("button", { name: "Copiar el informe" }).click();
    await expect(page.getByText(/Informe copiado/)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("No se guardaba la cita");

    await page.getByRole("button", { name: "Borrar los errores anotados" }).click();
    await expect(report).toContainText("Sin errores anotados");
    await expectAccessible(page);
    // También se llega desde «Cómo se usa».
    await page.goto("./ayuda");
    await page.getByRole("link", { name: /problemas frecuentes y el informe de fallo/ }).click();
    await expect(page.getByRole("heading", { name: "Algo no funciona" })).toBeVisible();
  });
});

test.describe("Licencias de terceros", () => {
  test("AY-L1 cada librería que entra en la app, con su licencia y su texto completo, sin desbordar a 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("./ayuda");
    await page.getByRole("link", { name: "Licencias de terceros" }).click();
    await expect(page.getByRole("heading", { name: "Licencias de terceros" })).toBeVisible();
    // Sale del build: están todas las librerías de producción de package.json y el modelo de MediaPipe.
    const deps = Object.keys(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).dependencies);
    await expect(page.getByText(/^\d+ componentes: /)).toBeVisible();
    const names = await page.locator("summary > span:first-child").allTextContents();
    for (const d of deps) expect(names, d).toContain(d);
    expect(names).toContain("MediaPipe Pose Landmarker (modelo pose_landmarker_full.task)");
    const lucide = page.locator("details").filter({ has: page.getByText("lucide-react", { exact: true }) });
    await expect(lucide.locator("summary")).toContainText("ISC");
    await lucide.locator("summary").click();
    await expect(lucide.locator("pre")).toContainText("ISC License");
    const font = page.locator("details").filter({ has: page.getByText("@fontsource-variable/manrope", { exact: true }) });
    await font.locator("summary").click();
    await expect(font.locator("pre")).toContainText("SIL OPEN FONT LICENSE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const summary = await lucide.locator("summary").boundingBox();
    expect(summary!.height).toBeGreaterThanOrEqual(44);
    await expectAccessible(page);
  });
});
