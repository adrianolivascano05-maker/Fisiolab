import type { Page } from "@playwright/test";
import { add, createPatient, expect, expectAccessible, loadSeed, test } from "./fixtures";

/** Simula el sensor de orientación del móvil: envía `deviceorientation` cada 30 ms con esta inclinación. */
async function tilt(page: Page, beta: number, gamma = 0) {
  await page.evaluate(
    ([b, g]) => {
      const w = window as unknown as { __tilt?: { beta: number; gamma: number }; __tiltTimer?: number };
      w.__tilt = { beta: b!, gamma: g! };
      w.__tiltTimer ??= window.setInterval(() => {
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: w.__tilt!.beta, gamma: w.__tilt!.gamma }));
      }, 30);
    },
    [beta, gamma],
  );
}

const current = (page: Page) => page.getByTestId("angulo-actual");

async function startRom(page: Page, joint: string, movement: RegExp, side?: "Izquierdo" | "Derecho") {
  await add(page, "Medición").click();
  await page.getByRole("link", { name: /Movilidad/ }).click();
  await page.getByRole("radio", { name: joint }).check({ force: true });
  await page.getByRole("radio", { name: movement }).check({ force: true });
  if (side) await page.getByRole("radio", { name: side }).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
}

/** Foto de prueba de 400 × 400 px (SVG): la foto no se guarda, solo hace falta que se vea. */
const photo = {
  name: "brazo.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#cfd8dc"/></svg>'),
};

async function tapPhoto(page: Page, x: number, y: number) {
  const svg = page.getByTestId("protractor");
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + (x / 400) * box.width, box.y + (y / 400) * box.height);
}

test.describe("F11 Movilidad", () => {
  test("F11-H1 lunge con el inclinómetro: tres lecturas, media y distancia a la pared", async ({ page }) => {
    await createPatient(page, { name: "Tobillo" });
    await startRom(page, "Tobillo", /lunge/, "Izquierdo");
    await expect(page.getByRole("heading", { name: "Tobillo · flexión dorsal en carga (lunge) izquierda" })).toBeVisible();
    await page.getByText("Cómo se hace").click();
    await expect(page.getByRole("img", { name: /rodilla toca la pared/ })).toBeVisible();
    await page.getByRole("button", { name: "Activar el inclinómetro" }).click();
    // Móvil de pie = 90° de beta; la tibia inclinada 38° → beta 52.
    for (const [beta, shown] of [[52, "38°"], [51, "39°"], [53, "37°"]] as const) {
      await tilt(page, beta);
      await expect(current(page)).toContainText(shown);
      // Como el fisio: se registra cuando la lectura se ha quedado quieta (mientras se asienta puede ir por 37,5).
      await expect(page.getByText("Estable")).toBeVisible();
      await page.getByRole("button", { name: "Registrar lectura" }).click();
    }
    await expect(page.getByText("Media: 38°")).toBeVisible();
    await page.getByLabel(/Distancia del dedo gordo a la pared/).fill("10,5");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar la media de 3 lecturas" }).click();

    await expect(page.getByText("Ángulo de la tibia")).toBeVisible();
    await expect(page.getByText("38", { exact: true })).toBeVisible();
    await expect(page.getByText("Media de 3 lecturas: 38°, 39°, 37°")).toBeVisible();
    await expect(page.getByText("10,5", { exact: true })).toBeVisible();
    await expect(page.getByText("Inclinómetro del móvil", { exact: false })).toBeVisible();
    await expectAccessible(page);
    await expect(page.getByRole("link", { name: /Ahora el lado derecho/ })).toBeVisible();
  });

  test("F11-H2 rango desde el cero: flexión de cadera de 0 a 95°", async ({ page }) => {
    await createPatient(page, { name: "Cadera" });
    await startRom(page, "Cadera", /^Flexión/, "Derecho");
    await page.getByRole("button", { name: "Activar el inclinómetro" }).click();
    await tilt(page, 3, 4);
    await expect(current(page)).toContainText("Pon a cero");
    await expect(page.getByRole("button", { name: "Registrar lectura" })).toBeDisabled();
    await page.getByRole("button", { name: "Poner a cero" }).click();
    await tilt(page, 98, 4);
    await expect(current(page)).toContainText("95°");
    await expect(page.getByText("Estable")).toBeVisible();
    await page.getByRole("button", { name: "Registrar lectura" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Rango de movimiento")).toBeVisible();
    await expect(page.getByText("95", { exact: true })).toBeVisible();
  });

  test("F11-N1 sin sensor: avisa y deja pasar a otro método", async ({ page }) => {
    await createPatient(page, { name: "Ordenador" });
    await startRom(page, "Hombro", /^Abducción/, "Izquierdo");
    await page.getByRole("button", { name: "Activar el inclinómetro" }).click();
    await expect(page.getByText("Este dispositivo no da la inclinación")).toBeVisible({ timeout: 5000 });
    await page.getByRole("radio", { name: "Goniómetro" }).check({ force: true });
    await page.getByLabel("Ángulo medido").fill("250");
    await page.getByRole("button", { name: "Registrar lectura" }).click();
    await expect(page.getByText("Escribe el ángulo en grados (0-200).")).toBeVisible();
  });

  test("F11-H3 ángulo sobre foto con tres puntos y ajuste con el teclado", async ({ page }) => {
    await createPatient(page, { name: "Hombro" });
    await startRom(page, "Hombro", /^Flexión/, "Derecho");
    await page.getByRole("radio", { name: "Foto" }).check({ force: true });
    await page.getByLabel("Elegir foto").setInputFiles(photo);
    await expect(page.getByText("1. Cadera (trocánter mayor) ← toca en la foto")).toBeVisible();
    await tapPhoto(page, 200, 350); // cadera
    await tapPhoto(page, 200, 150); // hombro (eje)
    await tapPhoto(page, 350, 150); // codo: brazo horizontal
    await expect(current(page)).toContainText("90°");
    await expectAccessible(page);
    // El codo 40 px más arriba (5 pulsaciones de 8 px): 180° − 75,1° = 104,9°.
    const elbow = page.getByRole("button", { name: /Punto 3, Codo/ });
    await elbow.focus();
    for (let i = 0; i < 5; i++) await elbow.press("Shift+ArrowUp");
    await expect(current(page)).toContainText("105°");
    await page.getByRole("button", { name: "Registrar lectura" }).click();
    await expect(page.getByRole("radio", { name: "Móvil" })).toBeDisabled();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("105", { exact: true })).toBeVisible();
    await expect(page.getByText(/Ángulo sobre foto/)).toBeVisible();
  });

  test("F11-H4 goniómetro sin lado, en la ficha y en el resumen", async ({ page }) => {
    await createPatient(page, { name: "Cuello" });
    await startRom(page, "Cuello", /^Flexión/);
    await expect(page.getByRole("radio", { name: "Foto" })).toBeDisabled();
    await page.getByRole("radio", { name: "Goniómetro" }).check({ force: true });
    await page.getByLabel("Ángulo medido").fill("48");
    await page.getByRole("button", { name: "Registrar lectura" }).click();
    await page.getByLabel("Ángulo medido").fill("56");
    await page.getByRole("button", { name: "Registrar lectura" }).click();
    await expect(page.getByText("Las lecturas difieren 8°")).toBeVisible();
    await page.getByRole("button", { name: "Borrar la lectura 2" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("48", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Volver" }).first().click();
    await expect(page.getByRole("link", { name: /Cuello · flexión.*48°/ })).toBeVisible();
    await page.getByRole("link", { name: "Movilidad", exact: true }).click();
    await expect(page.getByRole("list", { name: "Movimientos medidos" })).toContainText("Cuello · flexión");
    await expectAccessible(page);
  });

  test("F11-H5 resumen y evolución con los datos de ejemplo", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Valoración" }).click();
    await page.getByRole("link", { name: "Movilidad", exact: true }).click();
    const lunge = page.getByRole("list", { name: "Movimientos medidos" }).getByRole("link", { name: /Tobillo · flexión dorsal/ });
    // Último día: izquierdo 40,3 → 40°, derecho 35°, diferencia 5°.
    await expect(lunge).toContainText("40°");
    await expect(lunge).toContainText("35°");
    await expect(lunge).toContainText("5°");
    await expectAccessible(page);
    await lunge.click();
    await expect(page.locator(".recharts-line")).toHaveCount(2);
    await expect(page.getByRole("table")).toContainText("Pared (cm)");
    await expect(page.getByRole("row")).toHaveCount(5);
    await expectAccessible(page);
  });
});
