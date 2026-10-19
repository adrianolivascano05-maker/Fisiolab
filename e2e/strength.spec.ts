import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, loadSeed, markNextInSeries, scrubber, test, video } from "./fixtures";

/** Tarjeta de una métrica, por su etiqueta. */
const card = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("..");

test.describe("F07 Fuerza: velocidad de barra y 1RM", () => {
  test("F07-H1 serie por vídeo: dos repeticiones, velocidad y pérdida", async ({ page }) => {
    await createPatient(page, { name: "Banca" });
    await page.getByRole("link", { name: "Nueva medición" }).click();
    await page.getByRole("link", { name: /Fuerza/ }).click();
    await page.getByRole("radio", { name: "Press de banca" }).check({ force: true });
    await page.getByLabel("Carga en la barra").fill("50");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Indica el recorrido de la barra en cm (5-150).")).toBeVisible();
    await page.getByLabel("Recorrido de la barra").fill("30");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Vídeo · Press de banca 50 kg" })).toBeVisible();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await page.getByRole("button", { name: "Marcar las repeticiones" }).click();
    await expect(scrubber(page)).toBeVisible();
    // 30 cm: 60 fotogramas a 240 fps = 0,25 s → 1,20 m/s; 90 fotogramas → 0,80 m/s.
    for (const f of [10, 70, 80, 170]) await markNextInSeries(page, f);
    await expect(page.getByText("2 repeticiones marcados")).toBeVisible();
    await page.getByRole("button", { name: "Calcular resultado" }).click();

    await expect(card(page, "Velocidad media (mejor repetición)")).toContainText("1,20");
    await expect(card(page, "Pérdida de velocidad")).toContainText("33"); // (1,20 − 0,80) / 1,20
    await expect(page.getByRole("table")).toContainText("0,80");
    await expectAccessible(page);

    // El recorrido se recuerda para la siguiente serie del mismo ejercicio.
    await page.getByRole("link", { name: /Otra serie de press de banca/ }).click();
    await expect(page.getByLabel("Carga en la barra")).toHaveValue("50");
    await expect(page.getByLabel("Recorrido de la barra")).toHaveValue("30");
  });

  test("F07-H2 serie con encoder: velocidades escritas", async ({ page }) => {
    await createPatient(page, { name: "Encoder" });
    await page.getByRole("link", { name: "Nueva medición" }).click();
    await page.getByRole("link", { name: /Fuerza/ }).click();
    await page.getByRole("radio", { name: "Peso muerto" }).check({ force: true });
    await page.getByLabel("Carga en la barra").fill("100");
    await page.getByRole("radio", { name: /Encoder/ }).check({ force: true });
    for (const v of ["0,62", "0,6", "0,5"]) {
      await page.getByLabel(/Repetición \d/).fill(v);
      await page.getByRole("button", { name: "Añadir" }).click();
    }
    await page.getByRole("button", { name: "Borrar la repetición 3" }).click();
    await page.getByLabel("Repetición 3").fill("0,55");
    await page.getByLabel("Repetición 3").press("Enter");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar serie" }).click();
    await expect(page.getByRole("heading", { name: "Peso muerto · 100 kg · Encoder" })).toBeVisible();
    await expect(card(page, "Velocidad media (mejor repetición)")).toContainText("0,62");
    await expect(card(page, "Pérdida de velocidad")).toContainText("11"); // (0,62 − 0,55) / 0,62
    await expect(page.getByText(/encoder/)).toBeVisible();
    await page.getByRole("link", { name: "Volver" }).first().click();
    await expect(page.getByRole("link", { name: /Peso muerto · 100 kg.*0,62/ })).toBeVisible();
  });

  test("F07-H3 perfil carga-velocidad y 1RM con los datos de ejemplo", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("link", { name: "Carga-velocidad y 1RM" }).click();
    // Las 4 series del último día vienen elegidas: recta v = 1,45 − 0,011 · carga → 1RM ≈ 104,5 kg a 0,30 m/s.
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(4);
    const oneRm = card(page, "1RM estimado");
    await expect(oneRm).toContainText(/10[45],\d\s*kg/);
    await expect(page.getByRole("table")).toContainText("100 %");
    await expect(page.locator(".recharts-scatter-symbol")).toHaveCount(4);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByRole("heading", { name: "Perfiles guardados de sentadilla" })).toBeVisible();

    // Con un umbral más alto, el 1RM baja: 0,32 m/s → (1,45 − 0,32) / 0,011 ≈ 102,7 kg.
    await page.getByLabel("Velocidad en el 1RM").fill("0,32");
    await expect(oneRm).toContainText(/10[23],\d\s*kg/);
    // Un umbral por encima de la serie más pesada (0,35 m/s con 100 kg) no tiene sentido.
    await page.getByLabel("Velocidad en el 1RM").fill("0,4");
    await expect(page.getByText(/por debajo del umbral del 1RM/)).toBeVisible();
    await page.getByLabel("Velocidad en el 1RM").fill("0,32");
    await page.getByRole("button", { name: /Usar siempre 0,32 m\/s en sentadilla/ }).click();
    await expect(page.getByText("Umbral de sentadilla guardado")).toBeVisible();

    // Una sola serie no da perfil.
    for (const box of (await page.getByRole("checkbox").all()).slice(1)) await box.uncheck();
    await expect(page.getByText("Elige al menos dos series con cargas distintas.")).toBeVisible();

    // El resultado de una serie muestra su intensidad respecto al perfil guardado.
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Mediciones" }).click();
    await page.getByRole("link", { name: /Sentadilla · 80 kg/ }).click();
    await expect(page.getByText(/7\d % del 1RM/)).toBeVisible();
  });
});
