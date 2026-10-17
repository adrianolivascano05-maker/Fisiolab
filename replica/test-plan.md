# Plan de pruebas: app de medición de Fisiolab

Build: 0497972  Fecha: 2026-10-17  Entorno: local (`vite preview`), Chromium 1194 a 390×844 táctil
(y 1440 en el caso de maquetación), es-ES, Europe/Madrid. Cada test empieza con una base vacía.

Ejecutar: `npm run e2e` (45 tests) y `npm test` (33 tests unitarios de fórmulas, base de datos y vídeo).
Todos los tests fallan si hay un error en consola, una excepción o una respuesta 5xx, y las
pantallas principales pasan un escaneo axe (WCAG 2.1 A/AA).

Solo se prueban los flujos construidos (F01, F02, F03, F14, F15). F04-F13 todavía no existen.

| caso | flujo | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | alta de paciente | feliz | lista vacía → nuevo → nombre, masa 62,5, empuje 38 → crear | ficha con «62,5 kg · empuje 38,0 cm»; aparece en la lista | e2e | ✅ |
| F01-E1 | | límite: nombre vacío | crear sin nombre | mensaje y foco en «Nombre» | e2e | ✅ (tras BUG-004) |
| F01-E2 | | límite: fuera de rango y texto | masa 900, estatura «abc» | dos mensajes, no se crea | e2e | ✅ |
| F01-E3 | | límite: nombre largo, tildes, emoji | nombre de 55 caracteres con ñ y 💪 | se guarda y se ve; sin scroll horizontal a 390 px | e2e | ✅ |
| F01-E4 | | límite: doble pulsación | doble clic en crear | un solo paciente | e2e | ✅ |
| F01-E5 | | editar y buscar | editar masa con punto «58.5»; buscar «JOR», «zzz» | 58,5 kg; filtro sin mayúsculas; mensaje sin resultados | e2e | ✅ |
| F01-E6 | | solo teclado | Tab/Enter hasta crear | paciente creado | e2e | ✅ |
| F01-E7 | | avisos | crear paciente | el aviso sale arriba, sin tapar botones | e2e | ✅ (tras BUG-006) |
| F01-N1 | | negativo: borrar | borrar → cancelar → borrar | confirmación accesible; borra todo | e2e | ✅ |
| F01-N2 | | negativo: no existe | abrir /pacientes/no-existe | «Este paciente no existe.» | e2e | ✅ |
| F02-H1 | medir un CMJ | feliz | vídeo 240 fps, despegue f100, aterrizaje f220 | 30,7 cm, vuelo 500 ms, potencia; vídeo en el centro del f220; sigue tras recargar | e2e | ✅ |
| F02-E1 | | sin masa | paciente sin masa | altura sí, potencia no, con explicación | e2e | ✅ |
| F02-E2 | | cámara lenta exportada a 30 fps | elegir 240 de grabación | aviso desaparece; 30,7 cm | e2e | ✅ |
| F02-E3 | | 30 fps tomados como reales | dejar 30 fps | aviso de altura poco habitual | e2e | ✅ |
| F02-E4 | | marcas desordenadas | aterrizaje antes que despegue | aviso y Calcular desactivado | e2e | ✅ |
| F02-E5 | | recargar a mitad | recargar en el marcado | pide el vídeo otra vez; el test sigue | e2e | ✅ |
| F02-E6 | | atrás a mitad | volver desde el marcado | test «Sin marcar», se puede completar | e2e | ✅ |
| F02-E7 | | revisar marcas | mover aterrizaje a f232 | 37,1 cm; un solo test | e2e | ✅ |
| F02-E8 | | con el dedo | arrastrar la barra | se mueve al fotograma tocado | e2e | ✅ |
| F02-E9 | | cámara lenta de Android guardada a 30 | vídeo con com.android.capture.fps=240 | propone 240 y explica por qué; 30,7 cm | e2e | ✅ |
| F02-E10 | | ritmo irregular (30,08 fps con saltos) | ir a los fotogramas 5, 211, 300, 400, 419 | se ve exactamente ese fotograma (número codificado en el color) | e2e | ✅ (tras BUG-005) |
| F02-R1 | | vídeo real Pixel 7 Pro (120 fps en 30) | despegue 211, aterrizaje 271 | propone 120; 30,7 cm (29,6-31,7 con ±1 fotograma); fotogramas mostrados = ffmpeg | manual con script | ✅ |
| F02-N1 | | negativo: no es vídeo | subir package.json | «No se pudo abrir el vídeo», sin seguir | e2e | ✅ |
| F02-N2 | | negativo: test borrado | borrar y abrir su enlace y el de marcado | «Este test no existe.» en los dos | e2e | ✅ (tras BUG-002) |
| F03-H1 | drop jump | feliz | cajón 30; contacto f52, despegue f100, aterrizaje f220 | 30,7 cm, contacto 200 ms, RSI 1,53 | e2e | ✅ |
| F03-N1 | | negativo: sin cajón | DJ sin altura | mensaje, no continúa | e2e | ✅ |
| F14-H1 | evolución | feliz | datos de ejemplo → Lucía → evolución CMJ | 5 puntos, «Mejor: 31,2», tabla de 5 filas | e2e | ✅ |
| F14-E1 | | un solo dato | un CMJ → ver evolución | «hace falta otra» | e2e | ✅ |
| F14-E2 | | métrica sin datos | potencia de paciente sin masa | explica por qué | e2e | ✅ |
| F15-H1 | exportar | feliz | exportar CSV | BOM, «;», coma decimal, filas de ejemplo | e2e | ✅ |
| F15-H2 | | copia y restauración | copia → nuevo paciente → restaurar | vuelve al estado de la copia | e2e | ✅ |
| F15-N1 | | negativo: copia inválida | restaurar un archivo cualquiera | error claro; datos intactos | e2e | ✅ |
| F15-E1 | | pulsar rápido en ejemplo | cargar y borrar ejemplo | 3 pacientes, sin duplicar | e2e | ✅ |
| F15-E2 | | dos pestañas | abrir la app en otra pestaña | la 2.ª avisa y bloquea; al cerrar la 1.ª y reintentar, ve los datos | e2e | ✅ (tras BUG-001) |
| PWA-H1 | instalar | manifiesto | leer el manifiesto | nombre, modo app, iconos (también maskable y de iPhone) que cargan | e2e | ✅ |
| PWA-H2 | sin conexión | feliz | instalar caché → sin red → abrir, medir un CMJ y ver evolución | todo funciona y los datos siguen | e2e | ✅ |
| PWA-E1 | instalar | tarjeta | ver pasos, ocultar, recargar | oculta 14 días | e2e | ✅ |
| PWA-E2 | | iPhone | navegador de iPhone | pasos Compartir → Añadir a pantalla de inicio | e2e | ✅ |
| PWA-E3 | copia | recordatorio | ejemplo sin aviso; paciente real con aviso; tras copiar, desaparece | aviso solo cuando hace falta | e2e | ✅ |
| PWA-E4 | ajustes | estado | ver Instalación | instalada o pasos; si el navegador protege los datos | e2e | ✅ |
| AY-CMJ/SJ/DJ | ayuda | ilustraciones | abrir ayuda de cada salto | dibujo de colocación con descripción accesible; 4 fases con la fase correcta para cada salto | e2e | ✅ |
| AY-S07 | | desde el marcado | botón «Cómo marcar» | hoja de ayuda; Escape cierra | e2e | ✅ |
| L-390 / L-1440 | todas | maquetación y accesibilidad | pantallas principales a 390 y 1440 px | sin scroll horizontal, axe sin fallos | e2e | ✅ |

Casos de la lista que no aplican: sesión caducada, datos de otro usuario, contraseñas, pagos (no hay
cuentas ni servidor). Zonas horarias: las fechas se guardan en UTC y se muestran en Europe/Madrid;
probado con el navegador en Madrid.

## Pasada manual (no se puede automatizar aquí): la tiene que hacer Fisiolab

2026-10-17: Fisiolab confirma que la app publicada funciona en su Android (Pixel 7 Pro). Siguen abiertas
la validación (M4) y la prueba con TalkBack (M5).

En el móvil Android de Fisiolab con Chrome, cuando la app esté publicada:

- [x] M1 (archivo) Vídeo real del Pixel 7 Pro: la app lee 120 fps de grabación y 412 fotogramas. Falta verlo reproducir en el Chrome del móvil (HEVC)
- [x] M2 Altura razonable con el vídeo real: 30,7 cm
- [ ] M3 Avanzar fotograma a fotograma: ¿cada pulsación cambia la imagen?
- [ ] M4 Medir el mismo salto con My Jump Lab (u otra referencia) y con la app: anotar las dos alturas (validación)
- [ ] M5 Con TalkBack: ¿se puede crear un paciente y marcar un salto?
- [ ] M6 Si el vídeo no abre: ¿el móvil graba en HEVC? (en Samsung, «Vídeos de alta eficiencia»)
- [ ] M7 Instalar con el botón «Instalar la app» (o menú ⋮ → «Instalar app»), abrir desde el icono, cerrar y volver: ¿siguen los datos?
- [ ] M8 Modo avión con la app instalada: ¿abre y deja medir?

## F11 Movilidad (añadido el 2026-10-17, `e2e/rom.spec.ts`)

| caso | qué comprueba |
| --- | --- |
| F11-H1 | lunge con el inclinómetro (sensor simulado): 3 lecturas 38/39/37 → media 38°, distancia a la pared 10,5 cm |
| F11-H2 | rango desde el cero: flexión de cadera de 0 a 95°, aviso «Estable» |
| F11-N1 | sin sensor: aviso a los 2,5 s y paso al goniómetro; valida 0-200° |
| F11-H3 | ángulo sobre foto con 3 puntos (90°) y ajuste con el teclado (105°); el método se bloquea con lecturas |
| F11-H4 | goniómetro sin lado; aviso de lecturas que difieren 8°; ficha y resumen |
| F11-H5 | resumen por lados (40°, 35°, diferencia 5°) y evolución con dos líneas y tabla, con los datos de ejemplo |

Unitarias: geometría del inclinómetro y de la foto (`src/calc/rom.test.ts`) y datos, CSV y migración 1 → 2
(`src/data/rom.test.ts`). Pendiente a mano: medir en un Android real con el móvil apoyado en la tibia y comparar con
un goniómetro.

## F07 Fuerza (añadido el 2026-10-17, `e2e/strength.spec.ts`)

| caso | qué comprueba |
| --- | --- |
| F07-H1 | press de banca por vídeo: recorrido obligatorio, 2 repeticiones (1,20 y 0,80 m/s), pérdida 33 %, el recorrido y la carga se recuerdan |
| F07-H2 | peso muerto con encoder: añadir, borrar y Enter; mejor 0,62 m/s, pérdida 11 %; aparece en la ficha |
| F07-H3 | perfil con los datos de ejemplo: 4 series preelegidas, 1RM ≈ 104,5 kg; umbral 0,32 → ≈ 102,7 kg; umbral imposible rechazado; umbral guardado; % del 1RM en el resultado de una serie |

Unitarias: `src/calc/strength.test.ts` (velocidad, serie, recta, 1RM) y `src/data/strength.test.ts` (vídeo, encoder,
validación, perfil, CSV). Pendiente a mano: comparar con un encoder lineal en la clínica.

## F13 Bienestar (añadido el 2026-10-17, `e2e/wellness.spec.ts`)

| caso | qué comprueba |
| --- | --- |
| F13-H1 | cuestionario incompleto avisa; dolor fuera de 0-10 avisa; total 17/25 y aviso de sueño (2); corregir el mismo día no duplica (19/25); se ve en la ficha |
| F13-H2 | datos de ejemplo: 14/25 por debajo de lo habitual, aviso de fatiga y sueño, gráfica, tabla y borrado |

Unitarias: `src/calc/wellness.test.ts` (total, respuestas bajas, comparación con la media) y `src/data/wellness.test.ts`
(un registro por día, validación, CSV, borrado en cascada).

## F12 Nórdico (añadido el 2026-10-17, `e2e/nordic.spec.ts`)

| caso | qué comprueba |
| --- | --- |
| F12-H1 | ayuda ilustrada; vídeo → marcar la rotura → captura del fotograma → rodilla y cadera a 55° → 35° con el suelo, 164 N·m por pierna, 2,04 N·m/kg (80 kg, 180 cm) |
| F12-H2 | sin estatura: aviso; ángulo a mano validado (0-90); solo el ángulo; se ve en la ficha |
| F12-H3 | datos de ejemplo: evolución 50° → 57° en el resultado |

Unitarias: `src/calc/nordic.test.ts` (momento, ángulo sobre el fotograma) y `src/data/nordic.test.ts` (vídeo con marca
de rotura, a mano, sin estatura, CSV). Pendiente a mano: comparar el momento con un dinamómetro.

## Fase 4 (añadido el 2026-10-17, `e2e/phase4.spec.ts`)

| caso | qué comprueba |
| --- | --- |
| F08-H1 | sprint con fotocélulas: distancias mal escritas avisan; tramos (8,85 m/s), perfil F0/V0/Pmáx, en N y W con la masa, gráfica |
| F08-H2 | sprint por vídeo: salida y pasos en orden; con 2 pasos, sin perfil |
| F09-H1 | 5-0-5 con cada pierna: asimetría 5,0 % y aviso de déficit sin sprint; con los datos de ejemplo, déficit |
| F10-H1 | carrera: 4 apoyos alternos desde el pie derecho; frecuencia 288, contacto 113 ms, asimetría 20 %, longitud del paso |
| F16-H1 | comparar: ranking del CMJ, sprint 10 m (menos es mejor), orden invertido, última medición, medida sin datos |

Unitarias: `src/calc/sprint.test.ts`, `src/calc/phase4.test.ts`, `src/data/phase4.test.ts`, `src/data/compare.test.ts`.
