import { add, createPatient, expect, expectAccessible, markAt, scrubber, startJump, test, video } from "./fixtures";

const big = (page: import("@playwright/test").Page) => page.locator("p,div,span").filter({ hasText: /^Altura del salto/ }).first();

test.describe("F02 Medir un CMJ", () => {
  test("F02-H1 vídeo a 240 fps: 120 fotogramas de vuelo son 30,7 cm, con potencia", async ({ page }) => {
    await createPatient(page, { name: "Ana", mass: "62,5", pushOff: "38" });
    await add(page, "Medición").click();
    await expectAccessible(page);
    await page.getByRole("link", { name: /Saltos/ }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await expect(page.getByLabel("Fotogramas por segundo de la grabación")).toHaveValue("240");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Marcar el salto" }).click();

    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    // El vídeo está en el centro del fotograma 220 de un archivo a 240 fps.
    expect(await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(220.5 / 240, 4);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Calcular" }).click();

    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
    await expect(page.getByText("Tiempo de vuelo 500 ms")).toBeVisible();
    await expect(page.getByText("Potencia media")).toBeVisible();
    await expectAccessible(page);

    await page.reload();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
    void big;
  });

  test("F02-E1 sin masa: altura sí, potencia no, y se explica", async ({ page }) => {
    await createPatient(page, { name: "Sin masa" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
    await expect(page.getByText("Potencia media")).toHaveCount(0);
    await expect(page.getByText(/Para fuerza y potencia, añade la masa/)).toBeVisible();
  });

  test("F02-E2 cámara lenta exportada a 30 fps: avisa y, con 240 de grabación, mide bien", async ({ page }) => {
    await createPatient(page, { name: "Slowmo" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.slowmo30);
    await expect(page.getByText("Grabación a 30 fps")).toBeVisible();
    await page.getByLabel("Fotogramas por segundo de la grabación").selectOption("240");
    await expect(page.getByText("Grabación a 30 fps")).toHaveCount(0);
    await page.getByRole("button", { name: "Marcar el salto" }).click();
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
  });

  test("F02-E3 30 fps tratados como reales: altura imposible avisada", async ({ page }) => {
    await createPatient(page, { name: "Error fps" });
    await startJump(page, { file: video.slowmo30 });
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("Valor poco habitual: revisa las marcas y los fps de grabación.")).toBeVisible();
  });

  test("F02-E4 marcas desordenadas bloquean el cálculo", async ({ page }) => {
    await createPatient(page, { name: "Orden" });
    await startJump(page);
    await markAt(page, 200, "despegue");
    await markAt(page, 100, "aterrizaje");
    await expect(page.getByText("Las marcas están desordenadas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Calcular" })).toBeDisabled();
  });

  test("F02-E5 recargar en el marcado pide el vídeo otra vez y conserva el test", async ({ page }) => {
    await createPatient(page, { name: "Recarga" });
    await startJump(page);
    await page.reload();
    await expect(page.getByText("Vuelve a elegir el vídeo")).toBeVisible();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
  });

  test("F02-E6 atrás a mitad: el test queda como «Sin marcar» y se puede completar", async ({ page }) => {
    await createPatient(page, { name: "Atrás" });
    await startJump(page);
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByText("Sin marcar")).toBeVisible();
    await page.getByRole("link", { name: /CMJ.*Sin marcar/ }).click();
    await page.getByRole("link", { name: "Marcar ahora" }).click();
    await expect(scrubber(page)).toBeVisible();
  });

  test("F02-E7 revisar marcas recalcula y no duplica", async ({ page }) => {
    await createPatient(page, { name: "Revisar" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await page.getByRole("link", { name: "Revisar marcas y recalcular" }).click();
    await markAt(page, 232, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("37,1", { exact: true })).toBeVisible(); // 132 fotogramas = 0,55 s → 37,1 cm
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("list", { name: "Tests" }).getByRole("listitem")).toHaveCount(1);
  });

  test("F02-N1 un archivo que no es vídeo", async ({ page }) => {
    await createPatient(page, { name: "No vídeo" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.notVideo);
    await expect(page.getByText("No se pudo abrir el vídeo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar el salto" })).toHaveCount(0);
  });

  test("F02-N2 borrar un test y abrir su enlace después", async ({ page }) => {
    await createPatient(page, { name: "Borrar test" });
    await startJump(page);
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page).toHaveURL(/\/tests\/[^/]+$/);
    const url = page.url();
    await page.getByRole("button", { name: "Borrar esta medición" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByText("Sin mediciones todavía")).toBeVisible();
    await page.goto(url);
    await expect(page.getByText("Esta medición no existe.")).toBeVisible();
    await page.goto(url + "/marcar");
    await expect(page.getByText("Esta medición no existe.")).toBeVisible();
  });

  test("F02-E8 el marcado funciona con el dedo (arrastrar la barra)", async ({ page }) => {
    await createPatient(page, { name: "Dedo" });
    await startJump(page);
    const box = (await scrubber(page).boundingBox())!;
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const now = Number(await scrubber(page).getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThan(100);
    expect(now).toBeLessThan(140);
  });
});

test.describe("F02 vídeos de Android", () => {
  test("F02-E9 cámara lenta de Android guardada a 30: la app usa los fps que escribió el móvil", async ({ page }) => {
    await createPatient(page, { name: "Android" });
    await add(page, "Medición").click();
    await page.getByRole("link", { name: /Saltos/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.android240in30);
    const fps = page.getByLabel("Fotogramas por segundo de la grabación");
    await expect(fps).toHaveValue("240");
    await expect(page.getByText(/Prueba indica que grabó a 240 fps; el archivo va a 30 fps/)).toBeVisible();
    await expect(page.getByText("Grabación a 30 fps")).toHaveCount(0);
    await page.getByRole("button", { name: "Marcar el salto" }).click();
    await markAt(page, 100, "despegue");
    await markAt(page, 220, "aterrizaje");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByText("30,7", { exact: true })).toBeVisible();
  });
});

test.describe("F02 fotograma exacto", () => {
  test("F02-E10 ritmo irregular (30,08 fps con saltos): se ve exactamente el fotograma pedido", async ({ page }) => {
    await createPatient(page, { name: "Fotograma exacto" });
    await startJump(page, { file: video.irregular });
    const s = scrubber(page);
    await expect(s).toHaveAttribute("aria-valuemax", "419");
    // Cada fotograma lleva su número en el color: rojo = n mod 32 (×8), verde = n div 32 (×16).
    const shown = () =>
      page.locator("video").evaluate((v: HTMLVideoElement) => {
        const c = document.createElement("canvas");
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(v, 0, 0);
        const [r, g] = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
        return Math.round(r! / 8) + 32 * Math.round(g! / 16);
      });
    for (const frame of [5, 211, 300, 400, 419]) {
      await s.focus();
      await s.press("Home");
      for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
      for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
      await expect.poll(shown, { message: `fotograma ${frame}` }).toBe(frame);
    }
  });
});
