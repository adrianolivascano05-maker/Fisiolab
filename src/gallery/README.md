# Biblioteca: tests de exploración, cuestionarios y mediciones (módulo independiente)

Pestaña «Biblioteca» (`/biblioteca`; las direcciones antiguas `/exploracion/…` llevan aquí). Un buscador para todo y
tres estantes:

- **Tests de exploración** (`GalleryPages.tsx`): agrupados por articulación y, dentro de cada una, por patología.
- **Cuestionarios** (`LibraryPages.tsx`): la ficha de cada uno (qué mide, cómo se puntúa, sus preguntas, sus
  condiciones de uso con el interruptor «Tenemos el permiso») y «Permisos y licencias», que antes estaba en Ajustes.
- **Mediciones** (`LibraryPages.tsx`): qué es cada una, «Medir en un paciente» y «Medir ahora, sin ficha».

«Registrar el resultado en…», «Pasar a…» y «Medir en…» (`../clinical/RegisterInPatient.tsx`) llevan el nombre del
paciente solo si se llega desde su ficha (`?paciente=`); si no, se elige en una hoja, con el último abierto arriba.

Los tests:
Cada test tiene ilustración propia, posición, pasos, qué es positivo, cómo interpretarlo, precauciones, datos de
precisión con su fuente (información de la bibliografía; la app no hace cálculos sobre pacientes). No guarda nada en
la base de datos: solo los favoritos, en el navegador.

## Qué hay aquí

| archivo | qué hace |
| --- | --- |
| `types.ts` | tipo `SpecialTest` (texto, evidencia, figuras) |
| `figure.ts` | descripción de cada figura (`FigureSpec`: postura, ángulos, manos, flechas, síntoma), fases de la animación y el dibujo plano, que se usa si el navegador no tiene WebGL |
| `three/` | figuras en 3D (three.js): maniquíes de paciente y examinador movidos por un esqueleto (los segmentos nunca cambian de longitud), camilla, flechas, síntoma y etiquetas; la cámara se elige sola para que se vean las manos y la zona del test, y se puede girar un poco (±40°, nunca la vuelta entera) |
| `three/rig.ts` | esqueleto: medidas, ángulos a partir de la `FigureSpec` (más `pose3d`/`to3d` para lo que el dibujo plano no puede expresar: la mano en el hombro contrario, la aducción horizontal, la rotación del hombro), cinemática directa y puntos del cuerpo |
| `three/layout.ts`, `three/examiner.ts` | dónde va el paciente (suelo, camilla, borde; con una pierna que cuelga, al borde o al extremo) y dónde se pone el examinador: de pie, sentado en un taburete, agachado o de rodillas, sin que su cuerpo ni sus brazos se metan en el paciente, la camilla, su propio cuerpo o su otro brazo en ningún momento; brazos con mecánica real (la escápula sube y se adelanta con el brazo, rotación del hombro, flexión del codo, pronosupinación y muñeca dentro de sus límites), el codo con una trayectoria suave elegida a la vez para cinco momentos de la maniobra, la mano que llega a la toma desde fuera de la superficie y dedos que se apoyan en la piel (si no llega desde un sitio, se desplaza durante la maniobra), y la toma de cada mano (`grips` en la figura: palma que presiona, mano que abarca el segmento o yemas que palpan, y en qué cara), que se mueve con el segmento que coge |
| `three/collide.ts`, `three/scene.ts`, `three/audit.ts` | distancia a la piel de cada persona y puntos de su superficie; las dos personas en cada instante (lo mismo para la escena y las pruebas); y la auditoría de choques de toda la animación, fotograma a fotograma (`node scripts/gallery3d-audit.mjs`) |
| `three/plans.json`, `three/polish.ts` | colocaciones del examinador precalculadas (buscarlas cuesta segundos), repasadas con la animación de verdad: si algún instante choca o fuerza una articulación, se prueban variantes de los brazos y del sitio (y, si aún falla, variantes más amplias: la mano que rueda mucho sobre el segmento, el codo por tramos); si se cambia una figura, se rehacen con `node scripts/gallery3d-plans.mjs` (o solo las de unos tests: `node scripts/gallery3d-plans.mjs rod-lachman,hom-neer`) y después las cámaras |
| `three/person.ts`, `three/stage.ts` | las personas (cada brazo y cada pierna, una sola piel sin costura en codos y rodillas; hombro fundido con el tronco y que sube con la escápula; relieve de músculos y huesos —pectorales, escápulas, glúteos, bíceps, tríceps, vasto medial, rótula, gemelos, maléolos—; antebrazo que se tuerce con la pronación; dedos con sus tres articulaciones y pulgar con dos, apoyados en la superficie que tocan, pies con dedos, cara con ojos, cejas, nariz, labios y boca que se abre —articulación `jaw`—, pelo con volumen, ropa con escote, bajo y bolsillo pintados en una textura; con el aspecto «clean», el de por defecto, maniquíes sin pelo ni rasgos pintados, paciente en gris y examinador en el verde de la marca) y la escena (luces, sombras, taburete, cámara, giro limitado con el dedo) |
| `three/cameras.json` | cámaras precalculadas; si se cambia una figura, se rehace con `scripts/gallery3d-cameras.mjs` (la prueba `three/rig.test.ts` avisa) |
| `script.ts`, `describe.ts`, `posture.ts` | guion de cada figura (poses clave, reloj de mínimo jerk, fases, pasos, dolor), etiquetas y frases con grados que se escriben solas a partir de los ángulos, postura natural de lo que el guion no menciona |
| `three/CONVENIO.md`, `three/anatomy.ts` | convenio anatómico (nombres, signos, orden de composición y límites de cada grado de libertad) y ángulos del esqueleto a partir del guion; medida de los ángulos sobre el modelo para las pruebas |
| `three/marks.ts` | marcas de las figuras con guion: recorrido real de cada paso (gris), «el examinador empuja» o «tira» (azul), «el paciente empuja y el examinador lo frena» (naranja, con tope), barridos y desplazamientos |
| `three/natural.ts` | capa natural (respiración, mirada del examinador, dedos relajados): se puede apagar y no toca ningún ángulo del paciente (lo comprueba una prueba) |
| `three/clinical.test.ts`, `three/anatomy.test.ts`, `script.test.ts` | pruebas clínicas: sentido de cada flecha, etiquetas frente al movimiento, convenio de cada articulación, nada se mueve que el guion no mueva, isométricos quietos, capa natural invariante y lado D/I |
| `AnimatedFigure.tsx` | reproductor: 3D (o dibujo plano si el navegador no tiene WebGL; si el móvil cierra el contexto 3D por falta de memoria, se vuelve a montar hasta dos veces, y desde el dibujo plano «Ver en 3D» lo intenta otra vez; el aviso de contexto perdido que deja una figura al cerrarse no afecta a la siguiente), pausa, avance manual, giro, texto de cada paso («Paso n de N», con la línea técnica de grados y quién mueve en modo Clínico), interruptores Clínico/Natural y lado D/I (espejo exacto de la escena y de los textos); respeta «reducir movimiento» |
| `Disclosure.tsx` | desplegables que recuerdan si se dejaron abiertos |
| `data/*.ts` | contenido, un archivo por región; `data/index.ts` los junta |
| `evidence.ts` | razones de verosimilitud y probabilidad tras el test |
| `regions.ts` | articulaciones y su orden |
| `GalleryPages.tsx`, `routes.tsx`, `useFavorites.ts` | pantallas, rutas y favoritos |
| `scripts/gallery-sheet.mjs` | hoja de contacto de las figuras planas |
| `scripts/gallery3d.html`, `scripts/gallery3d-shot.mjs` | hoja de contacto de las figuras 3D (con `npx vite --port 5199`): `node scripts/gallery3d-shot.mjs hoja.png "region=rodilla"` |
| `scripts/gallery3d-visibility.mjs` | comprobación de visibilidad (con el servidor de desarrollo): al final de cada paso, las articulaciones que se mueven y las marcas del paso, dentro del encuadre y sin que nada las tape (`node scripts/gallery3d-visibility.mjs vis.json rodilla`) |
| `scripts/gallery3d-review.mjs` | datos para la revisión clínica: por figura con guion, lado, postura, ángulos de partida, pasos con grados y quién mueve, marcas, cámara y supuestos (`node scripts/gallery3d-review.mjs revision.json`) |

## Figuras con guion

Una figura con `script` describe la maniobra con ángulos anatómicos (convenio en `three/CONVENIO.md`): partida,
pasos con quién mueve, desplazamientos, marcas, textos y `supuestos` (lo que la fuente no da y se ha decidido;
pendiente de revisión por un fisioterapeuta). Los ángulos del guion son la única verdad: la capa natural, la
cámara y el ajuste de los brazos no los cambian (lo comprueban las pruebas). Las figuras sin `script` se ven
como siempre. Si se cambia un guion: `node scripts/gallery3d-plans.mjs <ids>`, después
`node scripts/gallery3d-cameras.mjs <ids>` (con el servidor de desarrollo) y `npx vitest run`.

**Nada de esto está validado clínicamente**: los guiones los ha escrito un asistente de IA a partir del texto de
cada test. Los supuestos de cada figura dicen qué hay que revisar.

## Cómo quitarlo

1. Borrar `src/gallery/`, `scripts/gallery-sheet.mjs`, `scripts/gallery-samples.mjs`, `scripts/gallery3d*` y `e2e/gallery.spec.ts`,
   y quitar `three` y `@types/three` de `package.json` (`npm uninstall three @types/three`).
2. `src/App.tsx`: quitar la línea `import { galleryRoutes } …` y la línea `...galleryRoutes,`.
3. `src/ui/AppBar.tsx`: quitar la línea de la pestaña «Exploración» y `BookOpen` del import.

## Recursos externos y licencias

Las figuras 3D no usan modelos, texturas ni otros recursos externos: el cuerpo, la camilla y las marcas se
generan por código (three.js, licencia MIT, ya incluida como dependencia). No hay nada que citar aparte.

## Fuentes

El texto está redactado para la app. Los números de sensibilidad, especificidad y LR se tomaron de revisiones y
estudios publicados, comprobados con el buscador (en este entorno no se pueden abrir las revistas); cada fila
lleva su cita. Antes de citarlos en un informe, consulta la fuente original.
