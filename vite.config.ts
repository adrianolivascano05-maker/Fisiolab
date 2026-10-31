/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import { copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import tokens from "./src/styles/tokens.json" with { type: "json" };
import { thirdPartyLicenses } from "./tools/licenses";

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

/**
 * Vista previa de Cloudflare Pages (cualquier rama que no sea la publicada): la app va sin nube, con la cloud.json
 * vacía de public/cloud.preview.json en lugar de la real. El servidor y Google solo aceptan la dirección publicada,
 * y la vista previa es pública: pacientes de ejemplo, nunca datos reales. Vite copia public/ antes de escribir el
 * build, así que aquí se sobrescribe al final.
 */
function previewCloud(): Plugin {
  const branch = process.env.CF_PAGES_BRANCH;
  const preview = !!branch && branch !== "publicado-cloudflare";
  return {
    name: "cloud-preview",
    apply: "build",
    closeBundle() {
      if (preview) copyFileSync(new URL("./public/cloud.preview.json", import.meta.url), join("dist", "cloud.json"));
    },
  };
}

/** La versión que sale en el informe de fallos: el commit del build (o «desarrollo» si no hay git). */
function appVersion() {
  try {
    return `${execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()} · ${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return "desarrollo";
  }
}

// Las librerías que entran en la app y en sus workers, con su licencia (Ayuda → Licencias de terceros).
const licenses = thirdPartyLicenses();

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // Las fuentes nunca se incrustan como data: (la CSP solo admite fuentes servidas por la propia app).
  // El motor 3D de la galería (three.js, ~600 kB) va en su propio trozo y solo se descarga al abrir un test.
  build: { assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined), chunkSizeWarningLimit: 700 },
  plugins: [
    cspMeta(),
    previewCloud(),
    licenses.collect(),
    licenses.emit,
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": la versión nueva espera a que se pulse «Actualizar»; recargar a mitad de un
      // marcado perdería el vídeo elegido.
      registerType: "prompt",
      includeAssets: ["favicon.png", "icons/omniclin-apple-touch-icon.png"],
      manifest: {
        name: "OmniClin",
        short_name: "OmniClin",
        description: "Registro y organización de la actividad de fisioterapia: historia clínica, agenda, cobros y medición del rendimiento físico. No es un producto sanitario: no diagnostica ni propone tratamientos.",
        lang: "es",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: tokens.color.canvas,
        theme_color: tokens.color.brand,
        // Los archivos llevan «omniclin-» desde el 31-10-2026: con un nombre nuevo, Android ve que el icono ha cambiado y
        // actualiza antes el de la app instalada (que seguía con el logo de «Cénit»).
        icons: [
          { src: `${base}icons/omniclin-icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icons/omniclin-icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${base}icons/omniclin-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Compartir → OmniClin desde WhatsApp, el correo o la galería (Android): PDF y fotos para la ficha de un paciente.
        share_target: {
          action: `${base}compartir`,
          method: "POST",
          enctype: "multipart/form-data",
          params: { title: "title", text: "text", files: [{ name: "archivos", accept: ["application/pdf", ".pdf", "image/*"] }] },
        },
      },
      workbox: {
        // Todo lo necesario para abrir sin conexión, incluido el motor SQLite (.wasm) y sus workers.
        globPatterns: ["**/*.{js,css,html,wasm,woff2,png,svg}", "licencias.json"],
        // Sin el motor de pose, que va aparte (abajo), sin el worker de ejemplo de sqlite-wasm (la app usa el suyo,
        // src/data/sqlite.worker.ts), sin las letras que puede elegir una clínica (src/brand/options.ts: se bajan al
        // elegirlas y quedan guardadas, abajo) y, de las dos de OmniClin, solo el alfabeto latino (el navegador baja
        // los demás si alguna vez hacen falta).
        globIgnores: ["**/{fraunces,manrope,lora,dm-sans}-*.woff2", "**/{source-sans-3,bricolage-grotesque}-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2", "**/vision_*", "**/sqlite3-worker1-*"],
        // Motor de pose (src/ai): ≈ 19 MB, se descarga la primera vez que se usa la IA y queda guardado.
        runtimeCaching: [
          { urlPattern: /\/assets\/(vision_|pose_landmarker)/, handler: "CacheFirst", options: { cacheName: "ia-pose" } },
          { urlPattern: /\/assets\/(fraunces|manrope|lora|dm-sans)-.*\.woff2$/, handler: "CacheFirst", options: { cacheName: "letras" } },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        // Lo que llega de Compartir → OmniClin (public/compartir-sw.js).
        importScripts: ["compartir-sw.js"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // sqlite-wasm carga su .wasm por URL relativa: no debe pre-empaquetarse.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es", plugins: () => [licenses.collect()] },
  test: { include: ["src/**/*.test.ts", "cloudflare/**/*.test.ts"] },
});
