# Publicación: Fisiolab · Medición

Fecha: 2026-10-17 · Rama: `claude/replica-skill-install-zv3ker` · Visto bueno del usuario: **sí, como versión de prueba (2026-10-17)**

Tipo de publicación propuesta: **versión de prueba** para el móvil Android de Fisiolab. Sirve para cerrar el
último must-have (vídeo real) y la validación; no para decisiones clínicas hasta completar M4.

## Preflight

- [x] Pruebas e2e: **45 / 45** en Chromium móvil, contra un servidor que aplica la misma CSP y cabeceras que Cloudflare (`tools/serve-dist.mjs`)
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

## Alojamiento: Cloudflare (plan gratuito, sin tarjeta)

Configurado en el repositorio:
- `wrangler.jsonc`: Worker solo de archivos estáticos desde `dist/`, rutas de la app resueltas por `index.html`
- `public/_headers`: CSP estricta (solo el propio dominio, `wasm-unsafe-eval` para SQLite), `nosniff`,
  `no-referrer`, permisos (cámara solo propia), `sw.js` e `index.html` sin caché, `/assets/*` inmutables
- `.nvmrc`: Node 22

Pasos que hace Fisiolab (Claude no crea cuentas ni escribe contraseñas):
1. Crear una cuenta gratuita en https://dash.cloudflare.com/sign-up (correo y contraseña; no pide tarjeta).
2. En el panel: **Workers y Pages → Crear → Importar un repositorio** → conectar GitHub y elegir
   `adrianolivascano05-maker/Fisiolab`.
3. Rama de producción: `claude/replica-skill-install-zv3ker`. Comando de compilación: `npm run build`.
   Comando de despliegue: `npx wrangler deploy` (suele venir puesto). Guardar y desplegar.
4. Al terminar, Cloudflare da una dirección `https://fisiolab-medicion.<tu-subdominio>.workers.dev`.
   Cada `git push` a esa rama vuelve a publicar.

Dominio propio: no hace falta. Si más adelante se quiere (p. ej. `medicion.fisiolab.es`), se añade en
el Worker → Configuración → Dominios; Cloudflare indica el registro DNS (un CNAME). HTTPS es automático.

## Vigilancia

- Errores y analítica: **ninguno a propósito**. Enviar errores a un servicio externo podría sacar datos de
  pacientes del dispositivo. Los fallos se reportan a mano.
- Disponibilidad: es una web estática y, una vez instalada, funciona sin conexión.
- Recorrido completo en el sitio publicado: pendiente, en el Android de Fisiolab (lista M1-M8 en `replica/test-plan.md`).

## Primera semana

1. Instalar la app desde Chrome (M7) y medir 3-5 saltos reales (M1-M3).
2. Validación (M4): 10-20 saltos medidos a la vez con la app y con My Jump Lab u otra referencia.
3. Hacer una copia de seguridad al final de cada día de pruebas.
