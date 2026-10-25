import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** Vídeos de prueba en VP9 (el Chromium de pruebas no reproduce H.264). */
export const video = {
  at240: fileURLToPath(new URL("../src/video/fixtures/e2e-240.mp4", import.meta.url)),
  slowmo30: fileURLToPath(new URL("../src/video/fixtures/e2e-slowmo-30.mp4", import.meta.url)),
  android240in30: fileURLToPath(new URL("../src/video/fixtures/e2e-android-240-in-30.mp4", import.meta.url)),
  irregular: fileURLToPath(new URL("../src/video/fixtures/e2e-irregular-120-in-30.mp4", import.meta.url)),
  notVideo: fileURLToPath(new URL("../package.json", import.meta.url)),
};

/**
 * La app publicada lleva el ID de cliente de Google (public/cloud.json) y pediría entrar con Google. Las pruebas
 * usan la app sin nube, salvo las de la nube, que ponen su ID de pruebas encima (fakeGoogle.ts).
 */
export async function withoutCloud(ctx: BrowserContext) {
  await ctx.route("**/cloud.json", (r) => r.fulfill({ json: { googleClientId: "" } }));
}

/** Todo test falla si la página escribe un error en consola o lanza una excepción. */
export const test = base.extend<{ consoleErrors: string[] }>({
  context: async ({ context, browserName, playwright }, use, testInfo) => {
    if (browserName !== "webkit") {
      await withoutCloud(context);
      return use(context);
    }
    // El contexto efímero de las pruebas en WebKit (como una ventana privada de Safari) no da el almacenamiento privado
    // (OPFS): la app va en memoria y pierde los datos al recargar. Un contexto «persistente» sí lo da, pero el WebKit
    // de Playwright 1.56 no arranca así en Mac («Browser started with no default context»; arreglado en versiones
    // posteriores). Se intenta y, si no puede, se sigue con el efímero, avisando.
    const { baseURL, viewport, locale, timezoneId, isMobile, hasTouch } = testInfo.project.use;
    let persistent: BrowserContext | null = null;
    try {
      persistent = await playwright.webkit.launchPersistentContext("", { baseURL, viewport, locale, timezoneId, isMobile, hasTouch });
    } catch (e) {
      console.warn(`WebKit sin contexto persistente (${e instanceof Error ? e.message.split("\n")[0] : String(e)}): la app irá en memoria.`);
    }
    await withoutCloud(persistent ?? context);
    await use(persistent ?? context);
    await persistent?.close();
  },
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // GitHub Pages sirve las rutas internas abiertas directamente con 404.html y estado 404; la app
      // funciona igual. Solo esos 404 de navegación se toleran, y solo en ese modo.
      let pageNav404 = 0;
      const ghPages = (process.env.E2E_BASE ?? "/") !== "/";
      // Con la dirección: «Failed to load resource: 410» solo no dice qué petición fue.
      page.on("console", (m) => m.type() === "error" && errors.push(m.location().url ? `${m.text()} ← ${m.location().url}` : m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
        if (ghPages && r.status() === 404 && r.request().isNavigationRequest()) pageNav404++;
      });
      await use(errors);
      // «INFO: …» es un aviso informativo del motor de pose (wasm) que sale por el canal de errores.
      const real = errors.filter((e) => !(e.includes("status of 404") && pageNav404-- > 0) && !e.startsWith("INFO: "));
      expect(real, "errores en consola").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Escaneo de accesibilidad (WCAG 2.1 A/AA) de lo que se ve ahora. */
export async function expectAccessible(page: Page) {
  // Sin transiciones a medias: un texto que aparece o se va (el título de la barra al desplazar) tiene poco contraste
  // mientras se funde, y el escaneo lo cogería según el momento.
  // Las que no acaban nunca (un indicador de carga) no se esperan.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

export type NewPatient = { name: string; mass?: string; pushOff?: string; height?: string };

export async function createPatient(page: Page, p: NewPatient) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(p.name);
  if (p.mass) await page.getByLabel("Peso").fill(p.mass);
  if (p.pushOff) {
    await page.getByText("Datos para saltos").click();
    await page.getByLabel("Distancia de empuje").fill(p.pushOff);
  }
  if (p.height) await page.getByLabel("Estatura").fill(p.height);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  return page.url();
}

/** Desde el resumen de la ficha: «Nueva sesión», o «Valorar» y en su hoja un test, un cuestionario o una medición. */
export function add(page: Page, what: "Sesión" | "Medición" | "Exploración" | "Cuestionario") {
  return {
    click: async () => {
      if (what === "Sesión") return page.getByRole("main").getByRole("link", { name: "Nueva sesión" }).first().click();
      await page.getByRole("button", { name: "Valorar" }).click();
      const name = { Medición: "Nueva medición", Exploración: "Registrar un test", Cuestionario: "Pasar un cuestionario" }[what];
      const sheet = page.getByRole("dialog", { name: "Valorar" });
      await sheet.getByRole("link", { name: new RegExp(`^${name}`) }).click();
      // La hoja se cierra con una animación: hasta que se va, su fila «Saltos, fuerza, sprint…» coincide con los
      // enlaces que se buscan después («Saltos», «Fuerza»…) y el toque caería en ella.
      await expect(sheet).toHaveCount(0);
    },
  };
}

/** Desde la ficha: nuevo test de salto, hasta la pantalla de marcado. */
export async function startJump(
  page: Page,
  opts: { type?: RegExp; box?: string; load?: string; side?: "Izquierda" | "Derecha"; file?: string; captureFps?: string } = {},
) {
  await add(page, "Medición").click();
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
export async function markAt(page: Page, frame: number, event: "despegue" | "aterrizaje" | "contacto" | "rotura") {
  const s = scrubber(page);
  await s.focus();
  await s.press("Home");
  for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
  for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
  await expect(s).toHaveAttribute("aria-valuenow", String(frame));
  await page.getByRole("button", { name: new RegExp(`^${event}\\s*:\\s*(marcar|mover)`, "i") }).click();
}

/** En una serie (10/5, repeticiones de fuerza): lleva la barra al fotograma y pulsa el botón de la siguiente marca. */
export async function markNextInSeries(page: Page, frame: number) {
  const s = scrubber(page);
  await s.focus();
  await s.press("Home");
  for (let i = 0; i < Math.floor(frame / 10); i++) await s.press("PageUp");
  for (let i = 0; i < frame % 10; i++) await s.press("ArrowRight");
  await expect(s).toHaveAttribute("aria-valuenow", String(frame));
  await page.getByRole("button", { name: /^(despegue|aterrizaje|inicio|fin|contacto) \d+\s*:\s*marcar/i }).click();
}

export async function loadSeed(page: Page) {
  test.slow(); // cargar el ejemplo tarda unos 12 s (más con todas las pruebas a la vez)
  await page.goto("./ajustes/datos");
  await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
  await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 30_000 });
}

/**
 * Lo que se toca en la pantalla y mide menos de 44 px de alto (o de ancho): botones, enlaces, campos y desplegables.
 * Una casilla o un botón de opción cuenta por su etiqueta, que es lo que se toca. Los enlaces dentro de un párrafo
 * no cuentan (se tocan por la línea entera). Devuelve la descripción de cada uno que no llega.
 */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>("main button, main a[href], main input, main select, main textarea, main summary");
    for (const el of els) {
      if (el.closest("[aria-hidden=true]") || el.closest("p") || (el instanceof HTMLInputElement && el.type === "file")) continue;
      const target = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? (el.closest("label") ?? el) : el;
      const r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
}

/** Importa pacientes (y, si se dan, citas) desde CSV, como en Ajustes › Importar. */
export async function importData(page: Page, patients: string, appointments?: string) {
  await page.goto("./ajustes/importar");
  await page.getByLabel("Elegir el archivo de pacientes").setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(patients, "utf8") });
  await page.getByRole("button", { name: /^Importar \d+ pacientes?$/ }).click();
  await expect(page.getByText(/pacientes? importados?/)).toBeVisible();
  if (!appointments) return;
  await page.getByRole("radio", { name: /Citas/ }).click();
  await page.getByLabel("Elegir el archivo de citas").setInputFiles({ name: "c.csv", mimeType: "text/csv", buffer: Buffer.from(appointments, "utf8") });
  await page.getByRole("button", { name: /^Importar \d+ citas?$/ }).click();
  await expect(page.getByText(/citas? importadas?/)).toBeVisible();
}
