import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, loadSeed, markNextInSeries, scrubber, test, video } from "./fixtures";

const card = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("..");

async function openSpeed(page: Page, testName: RegExp) {
  await page.getByRole("link", { name: "Nueva medición" }).click();
  await page.getByRole("link", { name: /Sprint/ }).click();
  await page.getByRole("radio", { name: testName }).check({ force: true });
}

test.describe("Fase 4: sprint, cambio de dirección, carrera y comparar", () => {
  test("F08-H1 sprint con fotocélulas: tramos y perfil fuerza-velocidad", async ({ page }) => {
    await createPatient(page, { name: "Velocista", mass: "70" });
    await openSpeed(page, /Sprint lineal/);
    await page.getByLabel("Distancias de los pasos (m)").fill("10, 5");
    await page.getByRole("radio", { name: /Fotocélulas/ }).check({ force: true });
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/de menor a mayor/)).toBeVisible();
    await page.getByRole("button", { name: "5-10-20-30 m" }).click();
    for (const [label, t] of [["5 m", "1,21"], ["10 m", "1,92"], ["20 m", "3,13"], ["30 m", "4,26"]]) await page.getByLabel(label, { exact: true }).fill(t!);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(card(page, "Tiempo en 30 m")).toContainText("4,26");
    await expect(page.getByRole("table")).toContainText("8,85"); // 10 m / (4,26 − 3,13) s
    await expect(page.getByRole("heading", { name: "Perfil fuerza-velocidad del sprint" })).toBeVisible();
    await expect(card(page, "V0")).toContainText(/8,\d\d/);
    await expect(page.getByText(/Con 70 kg: F0 \d+ N/)).toBeVisible();
    await expect(page.locator(".recharts-scatter-symbol")).toHaveCount(4);
    await expectAccessible(page);
  });

  test("F08-H2 sprint por vídeo: salida y pasos en orden", async ({ page }) => {
    await createPatient(page, { name: "Sprint vídeo" });
    await openSpeed(page, /Sprint lineal/);
    await page.getByLabel("Distancias de los pasos (m)").fill("5, 10");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await page.getByRole("button", { name: "Marcar los tiempos" }).click();
    await expect(scrubber(page)).toBeVisible();
    await expect(page.getByText("Busca el primer fotograma en que empieza a moverse y pulsa Salida.")).toBeVisible();
    await markSequence(page, [[10, "Salida"], [130, "Paso 5 m"], [200, "Paso 10 m"]]);
    await page.getByRole("button", { name: "Calcular resultado" }).click();
    // A 240 fps: 120 fotogramas = 0,50 s; 190 = 0,79 s.
    await expect(card(page, "Tiempo en 10 m")).toContainText("0,79");
    await expect(page.getByText("Con 3 pasos o más se calcula el perfil fuerza-velocidad del sprint.")).toBeVisible();
  });

  test("F09-H1 5-0-5 con cada pierna: asimetría y déficit con los datos de ejemplo", async ({ page }) => {
    await createPatient(page, { name: "Giros" });
    await openSpeed(page, /^5-0-5/);
    await page.getByRole("radio", { name: "Izquierda" }).check({ force: true });
    await page.getByRole("radio", { name: /Fotocélulas/ }).check({ force: true });
    await page.getByLabel("Tiempo total").fill("2,52");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Tiempo, girando con la izquierda")).toContainText("2,52");
    await page.getByRole("link", { name: /Ahora con la derecha/ }).click();
    await expect(page.getByRole("radio", { name: "Derecha" })).toBeChecked();
    await page.getByRole("radio", { name: /Fotocélulas/ }).check({ force: true });
    await page.getByLabel("Tiempo total").fill("2,4");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Asimetría entre giros (mejor de cada lado, hoy)")).toContainText("5,0 %");
    await expect(page.getByText("Más lento girando con la izquierda.")).toBeVisible();
    await expect(page.getByText(/Con un sprint que tenga un paso a 10 m/)).toBeVisible();
    await expectAccessible(page);

    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await page.getByRole("link", { name: /5-0-5 · gira con la dcha/ }).click();
    await expect(card(page, "Déficit de cambio de dirección")).toContainText(/0,\d\d s/);
  });

  test("F10-H1 carrera en cinta: apoyos alternos, frecuencia y asimetría", async ({ page }) => {
    await createPatient(page, { name: "Corredora" });
    await page.getByRole("link", { name: "Nueva medición" }).click();
    await page.getByRole("link", { name: /Carrera/ }).click();
    await page.getByLabel("Velocidad de la cinta (opcional)").fill("12");
    await page.getByRole("radio", { name: "Pie derecho" }).check({ force: true });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Elegir vídeo").setInputFiles(video.at240);
    await page.getByRole("button", { name: "Marcar los apoyos" }).click();
    await expect(scrubber(page)).toBeVisible();
    // Pasos de 50 fotogramas (0,208 s); contacto 24 (dcho.) y 30 (izq.).
    for (const f of [10, 34, 60, 90, 110, 134, 160, 190]) await markNextInSeries(page, f);
    await expect(page.getByText("4 apoyos marcados")).toBeVisible();
    await page.getByRole("button", { name: "Calcular resultado" }).click();
    await expect(card(page, "Frecuencia de paso")).toContainText("288"); // 60 / (50/240)
    await expect(card(page, "Tiempo de contacto")).toContainText("113"); // (24+30+24+30)/4/240
    await expect(page.getByText(/Izquierdo 125 ms · derecho 100 ms/)).toBeVisible();
    await expect(page.getByText(/Asimetría 20,0 % \(más largo el izquierdo\)/)).toBeVisible();
    await expect(card(page, "Longitud del paso")).toContainText("0,69"); // 12/3,6 · 0,208
    await expectAccessible(page);
  });

  test("F16-H1 comparar pacientes: ranking, orden y última medición", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Comparar" }).click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4); // CMJ: 3 pacientes
    await page.getByLabel("Medida").selectOption({ label: "Sprint · 10 m" });
    const rows = page.getByRole("table").getByRole("rowheader");
    await expect(rows).toHaveText([/Marcos Vidal/, /Lucía Herrero/]);
    await expect(page.getByText("2 pacientes · menos es mejor")).toBeVisible();
    await page.getByRole("button", { name: "Mejor primero" }).click();
    await expect(rows).toHaveText([/Lucía Herrero/, /Marcos Vidal/]);
    await page.getByText("Su última medición", { exact: true }).click();
    await expect(page).toHaveURL(/modo=ultima/);
    await page.getByLabel("Medida").selectOption({ label: "Nórdico · ángulo de rotura" });
    await expect(page.getByRole("table")).toContainText("57");
    await expectAccessible(page);
    await page.getByLabel("Medida").selectOption({ label: "V-Cut" });
    await expect(page.getByText("Nadie tiene todavía esta medida")).toBeVisible();
  });
});

/** Marca una secuencia fija (salida, pasos, llegada) en los fotogramas dados. */
async function markSequence(page: Page, steps: [number, string][]) {
  for (const [frame, label] of steps) {
    const s = scrubber(page);
    await s.focus();
    await s.press("Home");
    for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
    for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
    await expect(s).toHaveAttribute("aria-valuenow", String(frame));
    await page.getByRole("button", { name: new RegExp(`^${label}\\s*:\\s*marcar`) }).click();
  }
}
