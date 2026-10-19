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
      await page.screenshot({ path: `replica/clone-screens/S25-${type.replace(" ", "-")}.png`, fullPage: false });
      await sheet.evaluate((d) => (d.scrollTop = d.scrollHeight));
      await page.screenshot({ path: `replica/clone-screens/S25-${type.replace(" ", "-")}-marcar.png`, fullPage: false });
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
