# Plan de pruebas: app de medición de Fisiolab

Build: 0497972  Fecha: 2026-10-17  Entorno: local (`vite preview`), Chromium 1194 a 390×844 táctil
(y 1440 en el caso de maquetación), es-ES, Europe/Madrid. Cada test empieza con una base vacía.

Ejecutar: `npm run e2e` (42 tests) y `npm test` (26 tests unitarios de fórmulas, base de datos y vídeo).
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

En el móvil Android de Fisiolab con Chrome, cuando la app esté publicada:

- [ ] M1 Grabar un CMJ con la cámara lenta (120 o 240 fps; no la «súper cámara lenta» de 960) y elegirlo: ¿qué fps muestra la app?
- [ ] M2 Si muestra 30 fps, elegir los fps con los que se grabó y comprobar que la altura sale razonable
- [ ] M3 Avanzar fotograma a fotograma: ¿cada pulsación cambia la imagen?
- [ ] M4 Medir el mismo salto con My Jump Lab (u otra referencia) y con la app: anotar las dos alturas (validación)
- [ ] M5 Con TalkBack: ¿se puede crear un paciente y marcar un salto?
- [ ] M6 Si el vídeo no abre: ¿el móvil graba en HEVC? (en Samsung, «Vídeos de alta eficiencia»)
- [ ] M7 Instalar con el botón «Instalar la app» (o menú ⋮ → «Instalar app»), abrir desde el icono, cerrar y volver: ¿siguen los datos?
- [ ] M8 Modo avión con la app instalada: ¿abre y deja medir?
