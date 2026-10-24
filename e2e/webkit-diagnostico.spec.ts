// Solo en WebKit (el motor de Safari), en GitHub: para entender por qué falla ahí la segunda carga de página. No
// comprueba nada; escribe en el registro lo que ve en cada carga (si la base se guarda, quién la tiene ocupada, si
// la sirve el service worker). En Chromium se salta.
import type { Page } from "@playwright/test";
import { test, withoutCloud } from "./fixtures";

test.skip(({ browserName }) => browserName !== "webkit", "Solo para el motor de Safari.");

async function look(page: Page, label: string) {
  // Más de los 5 s que la app insiste en abrir el almacenamiento antes de rendirse: así se ve el estado final.
  await page.waitForTimeout(8000);
  const seen = await page.evaluate(async () => {
    const locks = "locks" in navigator ? await navigator.locks.query() : null;
    const text = document.body.innerText;
    return {
      url: location.pathname,
      text: text.slice(0, 140).replace(/\s+/g, " "),
      base: /esquema v\d+ · ([^\n]+)/.exec(text)?.[1] ?? null,
      locks: locks && { held: (locks.held ?? []).map((l) => l.name), pending: (locks.pending ?? []).map((l) => l.name) },
      sw: !!navigator.serviceWorker?.controller,
      opfs: typeof navigator.storage?.getDirectory === "function",
    };
  });
  console.log(`[diagnóstico ${label}] ${JSON.stringify(seen)}`);
}

// Estos dos abren su propio contexto efímero (browser.newContext), no el perfil en disco de fixtures.ts: en WebKit
// se espera «en memoria» aquí y «guardado en el dispositivo» en el resto de pruebas.
for (const sw of ["allow", "block"] as const) {
  test(`D1 dos cargas seguidas en la misma pestaña (service worker: ${sw})`, async ({ browser }) => {
    test.setTimeout(90_000);
    const { baseURL, viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
    const ctx = await browser.newContext({ baseURL, viewport, locale, timezoneId, isMobile, hasTouch, serviceWorkers: sw });
    await withoutCloud(ctx);
    const page = await ctx.newPage();
    page.on("console", (m) => console.log(`[consola ${sw}] ${m.type()} ${m.text().slice(0, 200)}`));
    page.on("pageerror", (e) => console.log(`[error ${sw}] ${e.message.slice(0, 200)}`));
    await page.goto("./ajustes");
    await look(page, `${sw}, 1.ª carga`);
    await page.goto("./pacientes/nuevo");
    await look(page, `${sw}, 2.ª carga`);
    await page.reload();
    await look(page, `${sw}, al recargar`);
    await ctx.close();
  });
}
