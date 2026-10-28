// Compartir → OmniClin (Android, con la app instalada): el sistema manda aquí, por POST, los archivos que se comparten
// desde WhatsApp, el correo o la galería (manifest: share_target). Se guardan un momento en la caché del navegador y
// la app los abre en «/compartir» para elegir el paciente (src/documents/SharedFilesPage.tsx). Lo carga el service
// worker de la app (vite.config.ts, workbox.importScripts).
const SHARED = "cenit-compartidos";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || !url.pathname.endsWith("/compartir")) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const files = form.getAll("archivos").filter((f) => typeof f === "object" && f !== null && "arrayBuffer" in f);
      const cache = await caches.open(SHARED);
      // Lo compartido antes y no guardado, fuera: solo vale lo último.
      for (const old of await cache.keys()) await cache.delete(old);
      let i = 0;
      for (const f of files) {
        await cache.put(
          new Request(new URL(`compartido/${i++}`, self.registration.scope).href),
          new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Nombre": encodeURIComponent(f.name || "Documento") } }),
        );
      }
      return Response.redirect(new URL(`compartir?n=${files.length}`, self.registration.scope).href, 303);
    })(),
  );
});
