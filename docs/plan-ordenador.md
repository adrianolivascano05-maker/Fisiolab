# La app en el ordenador (plan E)

Pedido por el usuario el 2026-10-23: «optimizar al máximo la aplicación para ordenador, que no sea la misma
interfaz que en móvil; puede ser muy similar, pero que aproveche toda la pantalla». Es la misma app y los mismos
datos: cambia la disposición, no el contenido.

## Reglas fijas

- Por debajo de 1024 px (móvil y tableta en vertical) la app no cambia nada: siguen las pruebas de 390 px, el
  control de 44 px y el de scroll horizontal a 360 px.
- Desde 1024 px (`lg:` en las clases y `useDesktop()` en el código) se usa la disposición de ordenador. Los nombres
  del menú salen desde 1280 px (`xl:`); entre 1024 y 1279 el menú es una franja de iconos con su nombre accesible.
- No se pierde ninguna función ni dato, y no se toca la lógica clínica. Las direcciones son las mismas en los dos
  tamaños: un enlace del móvil abre lo mismo en el ordenador.
- Pruebas: Vitest, Playwright en los dos modos (raíz y `/Fisiolab/`), una tras otra, y además `e2e/escritorio.spec.ts`
  (1280 y 1024 px, con el escáner de accesibilidad). Commit y push por bloque solo con todo en verde.

## Bloques

### E1 · Armazón y Pacientes como lista + ficha (hecho)

- **Menú lateral** (`SideNav` en `src/ui/AppBar.tsx`): las cuatro secciones de la barra de abajo, con la misma
  memoria de «última pantalla de cada sección». Fijo a la izquierda, 240 px con nombres (72 px solo iconos de 1024
  a 1279). La barra de abajo y el logo de la barra superior se ocultan desde 1024 px.
- **Anchos**: el contenido pasa de 640 px a 52 rem (832 px) y los márgenes a 24 px; las variables
  `--layout-sidenav`, `--layout-sidenav-rail` y `--layout-side` salen de `src/styles/tokens.json` e `index.css`.
- **Pacientes** (`src/app/PatientsLayout.tsx`): un panel fijo de 320 px con «Pacientes», «+ Nuevo», el buscador y
  la lista A-Z (`PatientsPane` en `PatientsPage.tsx`); a la derecha, lo que se esté viendo. El paciente abierto queda
  marcado (`aria-current="page"`, fondo de acento). Las pantallas de vídeo (`/marcar`, `/medicion-libre`) van a
  pantalla completa, sin paneles.
- **Inicio** (`src/pages/DesktopHome.tsx`): con la lista al lado, el inicio enseña la fecha y lo de hoy (la misma
  vista que Agenda › Hoy: citas con Atender y Cobrar, pendiente, mañana, lista de espera) y los avisos (copia de
  seguridad, código de recuperación, iPhone). En el móvil el inicio sigue siendo la lista.
- **Hojas** (`src/ui/Sheet.tsx`): centradas, de 34 rem, con esquinas redondeadas; en el móvil siguen saliendo por
  abajo. Los avisos (`Toast`) y la banda de «hay una versión nueva» dejan sitio al menú.
- **Pruebas**: `e2e/escritorio.spec.ts` (ES1 a ES3) y `e2e/a11y-layout.spec.ts` a 1440 px.

### E2 · La ficha en ancho (hecho)

La ficha decide sus columnas por el ancho que le queda (consultas de contenedor de CSS: `@container` en el `<main>`
de las páginas `width="record"` y clases `@2xl:` desde 42 rem y `@4xl:` desde 56 rem), no por el de la ventana: con la
lista de pacientes al lado tiene menos sitio, y en el móvil (menos de 42 rem) no cambia nada. El contenido de la
ficha llega a 64 rem.

- Cabecera: el nombre a la izquierda y los chips (Motivo, Cita, Debe) a la derecha, en una fila; las pestañas con el
  icono y el nombre en una línea.
- Resumen en dos columnas: Nueva sesión y Valorar, Situación y Pendiente a la izquierda; Documentos, Legal y Cuenta a
  la derecha.
- Valoración: Exploración y Cuestionarios a la izquierda y Mediciones a la derecha; desde 56 rem, una columna por
  bloque.
- Sesiones: la lista (con el medidor de sesiones y la curva del dolor) a la izquierda y la historia a la derecha.
- Nueva sesión: la sesión (fecha, dolor, qué refiere, qué encuentras, tratamiento, plan) a la izquierda; la siguiente
  cita, reevaluar y Guardar a la derecha.
- Anamnesis al rellenar: el índice de apartados fijo a la izquierda y los apartados a la derecha; desde 56 rem, los
  campos cortos a pares (los de texto largo, la escala, las opciones múltiples y la CIF, a todo el ancho). Leída, las
  respuestas cortas a pares.
- Pruebas: ES4 en `e2e/escritorio.spec.ts`.

### E3 · Agenda, Biblioteca, Ajustes y teclado (pendiente)

- Agenda: la lista de «Hoy» al lado de la rejilla de la semana.
- Biblioteca: regiones en 3 o 4 columnas; en cada test, la figura al lado del texto.
- Ajustes: los cuatro grupos en dos columnas.
- Atajos: «/» lleva el cursor al buscador de pacientes.
