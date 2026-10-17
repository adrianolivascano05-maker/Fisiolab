/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import tokens from "./replica/design/tokens.json" with { type: "json" };

export default defineConfig({
  plugins: [
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
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: tokens.color.bg,
        theme_color: tokens.color.bg,
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Todo lo necesario para abrir sin conexión, incluido el motor SQLite (.wasm) y sus workers.
        globPatterns: ["**/*.{js,css,html,wasm,woff2,png,svg}"],
        // Inter solo en alfabeto latino: el resto de alfabetos no hace falta en la clínica.
        globIgnores: ["**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // sqlite-wasm carga su .wasm por URL relativa: no debe pre-empaquetarse.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
  test: { include: ["src/**/*.test.ts"] },
});
