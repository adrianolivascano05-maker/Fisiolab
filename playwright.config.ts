import { defineConfig } from "@playwright/test";

// Dos modos, igual que los dos alojamientos posibles:
//   npm run e2e            → en la raíz, con las cabeceras de Cloudflare (public/_headers)
//   npm run e2e:ghpages    → bajo /Fisiolab/, como GitHub Pages (sin cabeceras, CSP en <meta>)
const base = process.env.E2E_BASE ?? "/";
const ghPages = base !== "/";

// Cada test abre un navegador limpio: base de datos (OPFS) vacía.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // Cada comprobación espera hasta 10 s (Playwright trae 5): la primera carga de la app (SQLite en WebAssembly y
  // abrir la base) pasa de 5 s cuando los cuatro navegadores de las pruebas arrancan a la vez en una máquina pequeña.
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:4173${base}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Sirve el build como el alojamiento real: misma CSP, mismas rutas.
    command: ghPages
      ? `BASE_PATH=${base} npm run build && cp dist/index.html dist/404.html && GHPAGES=1 BASE=${base} node tools/serve-dist.mjs`
      : "npm run build && node tools/serve-dist.mjs",
    url: `http://localhost:4173${base}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
