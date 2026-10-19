import { add, createPatient, expect, markAt, startJump, test } from "./fixtures";

test.describe("F03 Drop jump con RSI", () => {
  test("F03-H1 contacto 200 ms y vuelo 500 ms: RSI 1,53", async ({ page }) => {
    await createPatient(page, { name: "DJ", mass: "70", pushOff: "40" });
    await startJump(page, { type: /Drop jump/, box: "30" });
    await expect(page.getByText(/primer fotograma en que el pie toca el suelo al caer del cajón/)).toBeVisible();
    await markAt(page, 52, "contacto");
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
    await expect(page.getByText("1,53", { exact: true })).toBeVisible();
    await expect(page.getByText("200", { exact: true })).toBeVisible();
    await expect(page.getByText(/cajón 30 cm/)).toBeVisible();
    // DRI = (0,30 + 0,3066) / (9,81 · 0,2²) = 1,55; rigidez (Dalleau) con 70 kg, tc 0,2 s y tv 0,5 s = 22,3 kN/m
    await expect(page.getByText("1,55", { exact: true })).toBeVisible();
    await expect(page.getByText("22,3", { exact: true })).toBeVisible();
  });

  test("F03-N1 sin altura del cajón no deja continuar", async ({ page }) => {
    await createPatient(page, { name: "DJ sin cajón" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("radio", { name: /Drop jump/ }).check({ force: true });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Indica la altura del cajón (1-150 cm).")).toBeVisible();
  });
});
