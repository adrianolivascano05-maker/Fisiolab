# Componentes

Sistema propio: no hay capturas del original, así que nada se ha medido de My
Jump Lab. Ni iconos, ni ilustraciones, ni textos suyos: iconos de Lucide (ISC),
fuente Inter (OFL) servida desde la propia app (funciona sin conexión), textos
escritos de cero.

Criterios del sistema, por el uso real en la consulta:

- **Una mano y el pulgar.** Zona táctil mínima de 44 px; 56 px en los controles
  del vídeo, que se pulsan muchas veces seguidas. Navegación abajo.
- **Luz fuerte en el gimnasio.** Contraste AA en todo (40 pares comprobados,
  0 fallos). Texto principal a 18:1.
- **Las cifras no bailan.** Números tabulares (`nums`) en métricas y tiempos.
- **Nunca solo color.** Cada marca del vídeo lleva letra (D, A, C) además del color.
- **El visor es oscuro** (`media-*`), el resto claro: el vídeo se ve mejor y
  separa "marcar" de "gestionar".

Código: `src/ui/`. Página de comprobación: `/design`.
Tokens: `replica/design/tokens.json` → `npm run tokens` → `src/styles/tokens.css`
(variables CSS + tema de Tailwind 4). Los valores por defecto de Tailwind se
vacían: solo existen los roles (`bg-surface`, `text-text-muted`...), nunca un hex suelto.

## Construidos

```
Button                                                    src/ui/Button.tsx
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 44px, lg 56px; block (todo el ancho)
  states    default, hover, active, focus-visible (anillo 2px focus), disabled, loading
  tokens    bg accent / on-accent, radius md, texto base 600
  a11y      <button> real; type="button" por defecto; en loading queda desactivado,
            aria-busy y conserva la etiqueta para el lector de pantalla
  used on   todas

IconButton
  variants  default, media (sobre el visor oscuro)
  sizes     md 44px, video 56px
  a11y      label obligatorio (aria-label + title); el icono es aria-hidden
  used on   barra superior, S07

TextField / NumberField / SelectField                     src/ui/Field.tsx
  NumberField  unidad fija a la derecha (kg, cm, °), inputMode="decimal" (teclado
               numérico con coma en el móvil), cifras tabulares
  states    vacío, relleno, foco, error (borde danger + mensaje), desactivado
  tokens    borde border-input (3,9:1), alto 44px, radius md
  a11y      <label for>; el mensaje de ayuda o error va en aria-describedby;
            aria-invalid en error. SelectField es nativo (selector del sistema)
  used on   S03, S05, S09, S13, S21

Scale (escala 1-5)                                        src/ui/Scale.tsx
  states    sin responder, seleccionado, foco
  a11y      <fieldset>/<legend> con radios nativos: flechas del teclado y
            lectura "3 de 5" gratis; textos de los extremos visibles
  used on   S21 bienestar

Card / MetricCard                                         src/ui/Card.tsx
  MetricCard  sizes lg (display 40px, el resultado principal) y sm (28px)
  states    normal, aviso fuera de rango (borde y texto warning)
  a11y      la etiqueta va antes que el valor en el orden de lectura
  used on   S02, S08, S10, S14

PatientRow / List                                         src/ui/ListItem.tsx
  states    normal, hover; la lista vacía usa EmptyState
  a11y      <ul aria-label>; toda la fila es un único enlace; iniciales aria-hidden
  used on   S01, S23

CategoryTile                                              src/ui/CategoryTile.tsx
  a11y      enlace con título y detalle; icono aria-hidden
  used on   S04

Alert                                                     src/ui/Alert.tsx
  tones     info, warning, danger, success (fondo *-soft + icono)
  a11y      danger usa role="alert" (se anuncia); el resto role="status"
  used on   S06 (fps bajo, vídeo ilegible), S08, S24 (copia de seguridad)

Toast                                                     src/ui/Toast.tsx
  tones     success, danger, info; 4 s; encima de la barra inferior
  a11y      región aria-live="polite", no roba el foco
  used on   guardar, borrar, exportar

Sheet (hoja inferior)                                     src/ui/Sheet.tsx
  a11y      <dialog> nativo modal: foco atrapado, Escape cierra, devuelve el
            foco; título en aria-labelledby; tocar fuera cierra
  used on   S25 ayuda de cada test, confirmación de borrado

EmptyState                                                src/ui/EmptyState.tsx
  used on   S01 sin pacientes, S02 sin tests, S22 sin datos

TopBar / TabBar                                           src/ui/AppBar.tsx
  TopBar    56px, fija arriba; volver (enlace con aria-label), título h1, acción
  TabBar    64px + zona segura del iPhone; Pacientes, Comparar, Ajustes;
            <nav aria-label="Principal">, la pestaña activa en accent
  used on   todas

FrameScrubber (barra de tiempo del visor)                 src/ui/FrameScrubber.tsx
  partes    pista, progreso, marcadores con letra, mando, lectura de
            fotograma y tiempo (es-ES, 3 decimales)
  states    sin marcas, con marcas, arrastrando, foco
  a11y      role="slider" con aria-valuetext "Fotograma 300 de 1200, 1,246 s";
            ← → un fotograma, RePág/AvPág diez, Inicio/Fin; arrastre con el dedo
            (pointer capture, touch-action: none)
  pendiente zoom de la pista alrededor de las marcas: en un salto real despegue y
            aterrizaje quedan muy juntos y las letras se solapan (se construye con S07)
  used on   S07 y todos los tests por vídeo

FrameControls
  botones   −10, −1, reproducir/pausa, +1, +10 fotogramas; 56px, tono media
  used on   S07

MarkButton
  variants  takeoff (D, verde), landing (A, ámbar), contact (C, azul), other (M, violeta)
  states    sin marcar, marcado (✓)
  a11y      texto visible corto; nombre accesible completo ("Marcar despegue en
            este fotograma" / "Mover despegue a este fotograma"); texto oscuro
            sobre color a 8:1 o más
  used on   S07
```

## Especificados, se construyen con su pantalla en `/replica-build`

```
Chart (Recharts)
  variants  línea en el tiempo (S22), recta de regresión con puntos (S09 F-v,
            S14 carga-velocidad), barras izquierda/derecha (S10)
  states    vacío (EmptyState), 1 dato (punto + texto "hace falta otra medición")
  tokens    serie principal accent; izquierda chart-left, derecha chart-right
            (además rotuladas "Izq." y "Dcha."); rejilla border; ejes text-muted xs
  a11y      cada gráfica lleva debajo una tabla con los mismos datos
            (desplegable), y un resumen en texto ("Mejor: 34,1 cm el 12 oct")

Protractor (ángulo sobre imagen)
  partes    foto o fotograma, 3 puntos arrastrables (vértice y dos extremos),
            lectura del ángulo en grados
  a11y      cada punto movible con flechas; el ángulo se anuncia al soltar
  used on   S19, S20

InclinometerReadout
  states    pedir permiso (botón; iOS exige un toque), midiendo (ángulo grande
            y vivo), fijado, sin permiso (Alert + enlace a Protractor),
            sin sensor
  used on   S19

SortableTable
  a11y      <table> real; cabeceras <button> con aria-sort
  used on   S23

ConfirmDelete
  Sheet + Button danger; el texto dice qué se borra ("Ana y sus 14 tests")
  used on   S02 borrar paciente, S24 importar copia (reemplaza los datos)
```

## Contraste

```
python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json
40 pares, 0 fallos AA
```
