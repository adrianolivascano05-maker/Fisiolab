import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** Vídeos de prueba en VP9 (el Chromium de pruebas no reproduce H.264). */
export const video = {
  at240: fileURLToPath(new URL("../src/video/fixtures/e2e-240.mp4", import.meta.url)),
  slowmo30: fileURLToPath(new URL("../src/video/fixtures/e2e-slowmo-30.mp4", import.meta.url)),
  android240in30: fileURLToPath(new URL("../src/video/fixtures/e2e-android-240-in-30.mp4", import.meta.url)),
  irregular: fileURLToPath(new URL("../src/video/fixtures/e2e-irregular-120-in-30.mp4", import.meta.url)),
  notVideo: fileURLToPath(new URL("../package.json", import.meta.url)),
};

/** Todo test falla si la página escribe un error en consola o lanza una excepción. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // GitHub Pages sirve las rutas internas abiertas directamente con 404.html y estado 404; la app
      // funciona igual. Solo esos 404 de navegación se toleran, y solo en ese modo.
      let pageNav404 = 0;
      const ghPages = (process.env.E2E_BASE ?? "/") !== "/";
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
        if (ghPages && r.status() === 404 && r.request().isNavigationRequest()) pageNav404++;
      });
      await use(errors);
      const real = errors.filter((e) => !(e.includes("status of 404") && pageNav404-- > 0));
      expect(real, "errores en consola").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Escaneo de accesibilidad (WCAG 2.1 A/AA) de lo que se ve ahora. */
export async function expectAccessible(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

export type NewPatient = { name: string; mass?: string; pushOff?: string };

export async function createPatient(page: Page, p: NewPatient) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(p.name);
  if (p.mass) await page.getByLabel("Masa").fill(p.mass);
  if (p.pushOff) await page.getByLabel("Distancia de empuje").fill(p.pushOff);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  return page.url();
}

/** Desde la ficha: nuevo test de salto, hasta la pantalla de marcado. */
export async function startJump(
  page: Page,
  opts: { type?: RegExp; box?: string; load?: string; side?: "Izquierda" | "Derecha"; file?: string; captureFps?: string } = {},
) {
  await page.getByRole("link", { name: "Nuevo test" }).click();
  await page.getByRole("link", { name: /Saltos/ }).click();
  if (opts.type) await page.getByRole("radio", { name: opts.type }).check({ force: true });
  if (opts.box) await page.getByLabel("Altura del cajón").fill(opts.box);
  if (opts.load) await page.getByLabel("Carga extra").fill(opts.load);
  if (opts.side) await page.getByRole("radio", { name: opts.side }).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Elegir vídeo").setInputFiles(opts.file ?? video.at240);
  const next = page.getByRole("button", { name: "Marcar el salto" });
  await expect(next).toBeEnabled();
  if (opts.captureFps) await page.getByLabel("Fotogramas por segundo de la grabación").selectOption(opts.captureFps);
  await next.click();
  await expect(scrubber(page)).toBeVisible();
}

export const scrubber = (page: Page) => page.getByRole("slider", { name: "Posición en el vídeo" });

/** Lleva la barra al fotograma (índice desde 0) con el teclado y marca el evento. */
export async function markAt(page: Page, frame: number, event: "despegue" | "aterrizaje" | "contacto") {
  const s = scrubber(page);
  await s.focus();
  await s.press("Home");
  for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
  for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
  await expect(s).toHaveAttribute("aria-valuenow", String(frame));
  await page.getByRole("button", { name: new RegExp(`^${event}\\s*:\\s*(marcar|mover)`, "i") }).click();
}

/** En una serie (10/5): lleva la barra al fotograma y pulsa el botón de la siguiente marca. */
export async function markNextInSeries(page: Page, frame: number) {
  const s = scrubber(page);
  await s.focus();
  await s.press("Home");
  for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
  for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
  await expect(s).toHaveAttribute("aria-valuenow", String(frame));
  await page.getByRole("button", { name: /^(despegue|aterrizaje) \d+\s*:\s*marcar/i }).click();
}

export async function loadSeed(page: Page) {
  await page.goto("./ajustes");
  await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
  await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 15_000 });
}
