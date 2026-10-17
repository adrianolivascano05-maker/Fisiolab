import { defineConfig } from "@playwright/test";

// Cada test abre un navegador limpio: base de datos (OPFS) vacía.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Sirve el build como el alojamiento real: misma CSP y mismas rutas.
    command: "npm run build && node tools/serve-dist.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
