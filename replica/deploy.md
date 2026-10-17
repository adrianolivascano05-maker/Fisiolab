# Publicación: Fisiolab · Medición

Fecha: 2026-10-17 · Rama: `claude/replica-skill-install-zv3ker` · Visto bueno del usuario: **sí, como versión de prueba (2026-10-17)**

Tipo de publicación propuesta: **versión de prueba** para el móvil Android de Fisiolab. Sirve para cerrar el
último must-have (vídeo real) y la validación; no para decisiones clínicas hasta completar M4.

## Preflight

- [x] Pruebas e2e: **45 / 45** en la raíz con las cabeceras de Cloudflare y **45 / 45** bajo `/Fisiolab/` como GitHub Pages (`tools/serve-dist.mjs`)
- [x] Pruebas unitarias: **33 / 33** (fórmulas, base de datos, lectura de vídeo)
- [x] Sin fallos S1 ni S2 abiertos (`replica/bugs.md`: 7 encontrados, 7 arreglados)
- [x] Paridad: must-haves **13 / 13** (el último, vídeo real del móvil, cerrado con un vídeo del Pixel 7 Pro de Fisiolab). Puntuación en `replica/parity.md`
- [x] Barrido de marca limpio: `sweep.py . --config replica/brand.json` → exit 0 (ni nombre, ni dominios del original)
- [x] Ficha de tienda: no aplica (no va a tiendas: es una web instalable)
- [x] Build de producción: pasa (`npm run build`) y `wrangler deploy --dry-run` lee 33 archivos
- [x] Privacidad: página `/privacidad` en la app (datos solo en el dispositivo; el alojamiento solo ve IPs; sin analítica ni cookies). Condiciones de uso: no aplica (uso interno)
- [x] Borrado: no hay cuentas; borrar un paciente borra todos sus datos (prueba F01-N1)
- [x] Nombre, títulos e icono propios (iconos provisionales hasta `/replica-brand`); sin imagen OG (app interna)

## Producción

- [x] Base de datos: no hay servidor; cada dispositivo guarda la suya (OPFS) con copia de seguridad descargable
- [x] Variables de entorno: ninguna. Sin claves
- [x] Stripe, OAuth, email: no aplican

## Alojamiento: GitHub Pages (elegido)

El repositorio es público, así que GitHub Pages es gratis y no hace falta ninguna cuenta nueva.

- Dirección: **https://adrianolivascano05-maker.github.io/Fisiolab/**
- `.github/workflows/pages.yml`: en cada push a la rama principal, instala, pasa las pruebas unitarias,
  compila bajo `/Fisiolab/`, copia `index.html` a `404.html` (rutas internas) y publica.
- GitHub Pages no permite cabeceras propias: la CSP va como `<meta>` en el HTML (sin `frame-ancestors`,
  que en `<meta>` no vale). Las rutas internas abiertas directamente llegan con estado 404 pero la app
  funciona; una vez instalada, el service worker las sirve sin pasar por el servidor.
- Probado antes de publicar: `npm run e2e:ghpages` (45 / 45) sirve el build como GitHub Pages bajo
  `/Fisiolab/`, incluido el modo sin conexión.
- Nota: todas las webs de GitHub Pages de esta cuenta comparten origen (`adrianolivascano05-maker.github.io`)
  y por tanto almacenamiento. Si algún día se publican otras, conviene un dominio propio para la app.

Único paso de Fisiolab (una vez): en GitHub, repositorio Fisiolab → **Settings → Pages → Build and
deployment → Source: «GitHub Actions»**. Claude no puede cambiar ajustes del repositorio.

## Alternativa: Cloudflare (preparado, no usado)

`wrangler.jsonc` y `public/_headers` (CSP como cabecera, caché) siguen en el repositorio por si más adelante
se quiere un dominio propio con cabeceras. Requiere una cuenta de Cloudflare. Pasos:
1. Cuenta gratuita en https://dash.cloudflare.com/sign-up.
2. Workers y Pages → Crear → Importar un repositorio → GitHub → `Fisiolab`.
3. Rama `claude/replica-skill-install-zv3ker`, compilación `npm run build`, despliegue `npx wrangler deploy`.

## Vigilancia

- Errores y analítica: **ninguno a propósito**. Enviar errores a un servicio externo podría sacar datos de
  pacientes del dispositivo. Los fallos se reportan a mano.
- Disponibilidad: es una web estática y, una vez instalada, funciona sin conexión.
- Recorrido completo en el sitio publicado: pendiente, en el Android de Fisiolab (lista M1-M8 en `replica/test-plan.md`).

## Primera semana

1. Instalar la app desde Chrome (M7) y medir 3-5 saltos reales (M1-M3).
2. Validación (M4): 10-20 saltos medidos a la vez con la app y con My Jump Lab u otra referencia.
3. Hacer una copia de seguridad al final de cada día de pruebas.
