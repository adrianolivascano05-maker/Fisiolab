/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import tokens from "./replica/design/tokens.json" with { type: "json" };

// Ruta donde se publica: "/" (Cloudflare, dominio propio) o "/Fisiolab/" (GitHub Pages).
const base = process.env.BASE_PATH ?? "/";

/**
 * La CSP de public/_headers, también como <meta> en el build: GitHub Pages no permite cabeceras.
 * (frame-ancestors no vale en <meta>; donde hay cabeceras, la pone _headers.) Solo en el build:
 * el servidor de desarrollo usa scripts en línea que la CSP bloquearía.
 */
function cspMeta(): Plugin {
  const line = readFileSync(new URL("./public/_headers", import.meta.url), "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("Content-Security-Policy:"))!;
  const policy = line
    .split(":")
    .slice(1)
    .join(":")
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith("frame-ancestors"))
    .join("; ");
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }],
  };
}

export default defineConfig({
  base,
  plugins: [
    cspMeta(),
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": la versión nueva espera a que se pulse «Actualizar»; recargar a mitad de un
      // marcado perdería el vídeo elegido.
      registerType: "prompt",
      includeAssets: ["favicon.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Fisiolab · Medición",
        short_name: "Fisiolab",
        description: "Medición de saltos por vídeo a cámara lenta para la clínica.",
        lang: "es",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: tokens.color.bg,
        theme_color: tokens.color.bg,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${base}icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Todo lo necesario para abrir sin conexión, incluido el motor SQLite (.wasm) y sus workers.
        globPatterns: ["**/*.{js,css,html,wasm,woff2,png,svg}"],
        // Inter solo en alfabeto latino: el resto de alfabetos no hace falta en la clínica.
        globIgnores: ["**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // sqlite-wasm carga su .wasm por URL relativa: no debe pre-empaquetarse.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
  test: { include: ["src/**/*.test.ts"] },
});
