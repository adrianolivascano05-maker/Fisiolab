# OmniClin

OmniClin es un programa de registro y organización de la actividad de fisioterapia y de medición del rendimiento
físico. No es un producto sanitario: no diagnostica, no hace triaje, no predice, no vigila al paciente ni propone
tratamientos. Cada valoración y cada decisión clínica es del profesional. (La finalidad prevista completa está en
`src/app/purpose.ts` y en Ayuda › Acerca de.)

Es una aplicación web instalable (PWA) que guarda los datos en el propio dispositivo (SQLite en el navegador) y, con
una cuenta de Google, los sincroniza cifrados con el servidor de la clínica (Cloudflare, Unión Europea) o con una
carpeta oculta de Google Drive. Código, nombre, logo y textos son propios; los componentes de terceros se listan en
Ayuda › Licencias de terceros. Este repositorio no concede ninguna licencia de uso (ver `LICENSE`).

## Arrancarla

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Probarla

```bash
npm run typecheck  # tipos (app y pruebas)
npm run lint       # oxlint, 0 errores
npm test           # unitarias (vitest)
npm run e2e        # navegador (Playwright), publicada en la raíz
npm run e2e:ghpages  # lo mismo con la app en /Fisiolab/ (GitHub Pages); una tanda después de la otra
```

Las pruebas de navegador necesitan `npx playwright install chromium` la primera vez. Solo pacientes inventados: los
datos de ejemplo salen de `src/data/seed.ts` y `src/demo/`.

## Publicar

Un push a cualquier rama solo pasa las pruebas (`.github/workflows/pruebas.yml`). Publicar es a mano: la rama
`produccion` → GitHub → Actions → «Publicar» (`publicar.yml`), que repite las pruebas sobre ese commit y, si pasan, lo
deja en la rama `publicado-cloudflare` (Cloudflare Pages) y en GitHub Pages. Volver atrás es «Publicar» con el commit
anterior. Safari (WebKit) se prueba los lunes (`webkit.yml`), solo informativo. Cualquier otra rama que Cloudflare
construya es una vista previa sin nube (`public/cloud.preview.json`).

## Dónde seguir

- [RESUMEN.md](RESUMEN.md): el resumen técnico de toda la app y las decisiones tomadas.
- [docs/](docs/README.md): pasos pendientes para el usuario, ideas y fallos conocidos, soporte, cuestionarios y el
  runbook [Recuperar la clínica](docs/recuperar-la-clinica.md).
- [cloudflare/README.md](cloudflare/README.md): instalar el servidor de la clínica (Worker, D1, R2) paso a paso.
- Cada carpeta de `src/` con lógica propia tiene su `README.md`.
