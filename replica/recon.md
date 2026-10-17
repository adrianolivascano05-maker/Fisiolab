# Mapa de reconocimiento: My Jump Lab 3 (iPhone/iPad/Mac, Android) → clon web móvil

Alcance: la app completa (saltos, fuerza/VBT, sprint y cambio de dirección,
carrera, movilidad, nórdicos, bienestar, gestión de pacientes), construida por
fases. Fase 1 = saltos.
Para: uso interno en la clínica Fisiolab (medir a sus pacientes). Sin venta,
sin suscripción, sin tienda de apps.
Plataforma del clon: web para el navegador del móvil (iPhone y Android).
Fecha: 2026-10-17

Método: solo fuentes públicas (fichas de las tiendas, artículos científicos,
guías universitarias). No se ha usado ninguna cuenta ni se ha leído código de
la app. Las páginas de las tiendas y la web del autor no se pudieron abrir
directamente desde este entorno; su contenido viene de resultados de búsqueda,
así que los detalles de pantallas son **inferidos** y llevan su confianza.
No hay capturas en `replica/screens/` todavía (ver "Huecos" al final).

## Fuentes

| # | fuente | URL | notas |
| --- | --- | --- | --- |
| 1 | ficha App Store (EE. UU.) | https://apps.apple.com/us/app/my-jump-lab-my-jump-3/id1554077178 | lista de tests, precio (5,99 $/mes, 105,99 $ de por vida), requisitos (chip A12), cámara lenta |
| 2 | ficha Google Play | https://play.google.com/store/apps/details?id=com.my.jump.lab&hl=en_US | usuarios ilimitados, tests ilimitados por usuario, evolución en el tiempo |
| 3 | guía de My Jump 2 (Unicamp, PT) | https://fef.unicamp.br/wp-content/uploads/sites/70/2025/03/my_jump_2.pdf | cómo se marcan despegue y aterrizaje fotograma a fotograma; 5 tipos de test |
| 4 | estudio de métricas de estrategia del CMJ (JHK) | https://jhk.termedia.pl/Validity-and-Reliability-of-Strategy-Metrics-to-Assess-Countermovement-Jump-Performance,158742,0,2.html | vídeo a 240 fps a ~3 m; tiempo hasta el despegue, RSI-mod |
| 5 | validación con IA (ResearchGate) | https://www.researchgate.net/publication/386742925_The_Validity_and_Reliability_of_the_My_Jump_Lab_App_for_the_Measurement_of_Vertical_Jump_Performance_Using_Artificial_Intelligence | detección automática del salto con IA |
| 6 | validación con IA (IUSCA) | https://journal.iusca.org/index.php/Journal/article/download/415/500/4891 | ídem |
| 7 | artículo del autor sobre salto en tiempo real | https://balsalobre.substack.com/p/real-time-jump-monitoring-in-my-jump | modo en tiempo real (no se pudo leer el contenido) |
| 8 | Sportsmith: visión por ordenador e IA | https://www.sportsmith.co/articles/computer-vision-ai-and-using-a-phone-app-to-quantify-athlete-movement/ | contexto de la parte de IA |
| 9 | Samozino, método simple F-V en CMJ (PubMed) | https://pubmed.ncbi.nlm.nih.gov/27002490/ | entradas: masa, altura del salto, distancia de empuje |
| 10 | Samozino, método simple en SJ (PubMed) | https://pubmed.ncbi.nlm.nih.gov/18789803/ | ídem para SJ |
| 11 | Runmatic, validación (Univ. Europea) | https://abacus.universidadeuropea.com/entities/publication/3fc740b6-1758-45a4-8174-bd673ada45af/full | tiempo de contacto, de vuelo, frecuencia de paso en cinta |
| 12 | Runmatic, página de running-physio | https://www.running-physio.com/runmatic/ | descripción de la app de carrera |
| 13 | validez de apps de velocidad de barra (Sheffield Hallam) | https://shura.shu.ac.uk/32150/3/Thompson-TheValiditySmartphone%28AM%29.pdf | My Lift / velocidad de barra |
| 14 | fiabilidad de tecnologías de velocidad de barra | https://lida.sport-iat.de/ta/Record/4065489?lng=de | aviso de errores en una versión de My Lift (PLOS ONE 2020) |
| 15 | validación del sprint curvo | https://lida.sport-iat.de/ta/Record/4093557?lng=en | My Jump Lab, sprint curvo, r = 0,97–0,99 |
| 16 | ángulo de rotura en el nórdico (IJSPT) | https://ijspt.scholasticahq.com/article/83936-the-validity-and-reliability-of-a-smartphone-application-for-break-point-angle-measurement-during-nordic-hamstring-exercise | ángulo de rotura con vídeo de móvil |
| 17 | test de lunge para tobillo (PubMed) | https://pubmed.ncbi.nlm.nih.gov/28108266/ | métodos de medida del lunge con carga |
| 18 | My Jump 2 en App Store | https://apps.apple.com/us/app/my-jump-2/id1148617550 | versión anterior, de pago |

## Bucle principal

Grabar a cámara lenta a un paciente haciendo un test, marcar a mano los
fotogramas clave del vídeo y obtener al momento la métrica (altura del salto,
velocidad, tiempo, ángulo) guardada en su ficha para ver la evolución.

## Pantallas

Las pantallas del original no se han visto directamente. Esta lista es la del
**clon**, deducida de los tests y funciones que el original declara. El ID es
estable y lo usan los demás archivos.

| ID | pantalla | ruta / cómo se llega | propósito | componentes clave | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Pacientes | `/` | lista y búsqueda de pacientes | buscador, lista, botón "nuevo" | vacío, lleno, buscando sin resultados |
| S02 | Ficha del paciente | `/pacientes/:id` | datos (masa, estatura, longitud de pierna, distancia de empuje, fecha de nacimiento, sexo) y últimos resultados | cabecera, tarjetas de resultado, botón "nuevo test" | sin tests, con tests, editando datos, error de validación |
| S03 | Nuevo paciente / editar | `/pacientes/nuevo` | alta o edición | formulario, numéricos con unidades | vacío, error, guardando |
| S04 | Selector de test | desde S02 → "nuevo test" | elegir categoría y test | cuadrícula de categorías, lista de tests | — |
| S05 | Configuración del test de salto | S04 → Saltos | tipo (CMJ, SJ, CMJ brazos libres, DJ con altura de caída, horizontal, unipodal I/D, 10-5), carga extra | selectores, numéricos | faltan datos del paciente |
| S06 | Captura o subida de vídeo | tras configurar cualquier test por vídeo | grabar o elegir el vídeo a cámara lenta y su fps | botón subir, aviso de fps, guía de colocación | sin vídeo, cargando, fps desconocido, formato no soportado |
| S07 | Marcado de fotogramas | tras S06 | avanzar fotograma a fotograma y marcar los eventos (despegue, aterrizaje, contacto...) | visor de vídeo, barra de tiempo, botones ±1 fotograma, zoom, marcadores | sin marcas, marcas incompletas, marcas incoherentes (aterrizaje antes del despegue) |
| S08 | Resultado del salto | tras S07 | altura, tiempo de vuelo, fuerza, velocidad, potencia; DJ: tiempo de contacto, RSI, rigidez, DRI; RSI-mod | tarjetas de métrica, guardar, repetir | resultado fuera de rango (aviso) |
| S09 | Perfil fuerza-velocidad | Saltos → Perfil F-V | varios saltos con cargas crecientes → recta F-v, F0, V0, Pmáx, perfil óptimo, desequilibrio | lista de saltos con carga, gráfica | menos de 2 cargas, recta mal ajustada |
| S10 | Asimetría | Saltos → Unipodal | salto de cada pierna y % de asimetría | dos tarjetas, barra comparativa | falta una pierna |
| S11 | Saltos repetidos 10-5 | Saltos → 10-5 | marcar contactos y vuelos de la serie; RSI de los 5 mejores | lista de saltos, marcado en serie | serie incompleta |
| S12 | Salto horizontal | Saltos → Horizontal | distancia del salto | medida en vídeo o manual | — |
| S13 | Velocidad de barra (VBT) | S04 → Fuerza | marcar inicio y fin del recorrido de la barra → velocidad media; carga | visor de vídeo, recorrido conocido | sin recorrido |
| S14 | Perfil carga-velocidad y 1RM | S13 → varias cargas | recta carga-velocidad, 1RM estimado, pérdida de velocidad en la serie | gráfica, tabla | menos de 2 cargas |
| S15 | Sprint lineal y splits | S04 → Sprint | tiempos de paso marcados en vídeo; sprint curvo; deceleración | visor, marcadores por distancia | — |
| S16 | Cambio de dirección | S04 → COD | 5-0-5, 5+5, V-Cut, Illinois: tiempo total | cronómetro por vídeo | — |
| S17 | S-MAS | S04 → Sprint → S-MAS | puntuación de la mecánica de sprint por checklist | lista de ítems, puntuación | incompleto |
| S18 | Carrera | S04 → Carrera | marcar contactos en vídeo → tiempo de contacto, vuelo, frecuencia de paso | visor, marcado en serie | — |
| S19 | Movilidad (ROM) | S04 → Movilidad | tobillo (lunge), cadera, hombro, cuello: inclinómetro del móvil o ángulo sobre foto | lectura del sensor, transportador sobre imagen | permiso de sensor denegado, sensor no disponible |
| S20 | Nórdico de isquios | S04 → Isquios | ángulo de rotura en vídeo y torque estimado | visor, transportador | — |
| S21 | Bienestar (readiness) | S04 → Bienestar o desde S02 | cuestionario: sueño, fatiga, estrés, agujetas | escalas | incompleto |
| S22 | Evolución | S02 → un test | gráfica en el tiempo de un test y lista de sesiones | gráfica de línea, tabla | 1 solo dato, vacío |
| S23 | Comparar y ranking | menú → Comparar | pacientes ordenados por un test y comparación lado a lado | tabla ordenable, filtros | — |
| S24 | Ajustes | menú → Ajustes | exportar todo a CSV, copia de seguridad, unidades, idioma | botones, selectores | exportando, error |
| S25 | Ayuda de cada test | icono "?" en cada test | cómo colocar la cámara y cómo marcar | texto e ilustraciones propias | — |

## Flujos

Los clics del original no se han podido contar (no hay acceso a la app). Los
números son los del camino previsto en el clon y son la meta a mejorar.

```
F01 Dar de alta un paciente
    S01 -> S03 -> S02
    clics: 3
    edge: falta la masa (bloquea los cálculos de fuerza), unidades mezcladas

F02 Medir un CMJ (núcleo, fase 1)
    S02 -> S04 -> S05 -> S06 -> S07 -> S08
    clics: ~8 (nuevo test, Saltos, CMJ, subir vídeo, marcar despegue, marcar aterrizaje, calcular, guardar)
    edge: vídeo sin cámara lenta (30 fps da errores grandes), fps mal leído,
          paciente sin masa, aterrizaje con rodillas flexionadas (infla el tiempo de vuelo)

F03 Drop jump con RSI
    S02 -> S04 -> S05 (altura de caída) -> S06 -> S07 (contacto, despegue, aterrizaje) -> S08
    edge: contacto marcado después del despegue, altura de caída sin indicar

F04 Perfil fuerza-velocidad
    S02 -> S04 -> S09 (añadir saltos con 2+ cargas, cada uno via S06 -> S07) -> S09
    edge: falta la distancia de empuje del paciente, una sola carga

F05 Asimetría entre piernas
    S02 -> S04 -> S10 (pierna izquierda via S06/S07, pierna derecha via S06/S07)
    edge: solo una pierna medida

F06 Saltos repetidos 10-5
    S02 -> S04 -> S11 -> S06 -> S07 (marcado en serie) -> S11
    edge: menos de 10 saltos en el vídeo

F07 Velocidad de barra y 1RM
    S02 -> S04 -> S13 (por cada carga) -> S14
    edge: recorrido de la barra desconocido, solo una carga

F08 Sprint con tiempos de paso
    S02 -> S04 -> S15 -> S06 -> S07 -> S15
    edge: la cámara no ve la salida y la llegada en el mismo plano

F09 Cambio de dirección (5-0-5, 5+5, V-Cut, Illinois)
    S02 -> S04 -> S16 -> S06 -> S07 -> S16

F10 Mecánica de carrera
    S02 -> S04 -> S18 -> S06 -> S07 -> S18

F11 Movilidad del tobillo (lunge)
    S02 -> S04 -> S19 (sensor o foto) -> guardar
    edge: el navegador del iPhone pide permiso para el sensor de orientación

F12 Nórdico de isquios
    S02 -> S04 -> S20 -> S06 -> S07 -> S20

F13 Cuestionario de bienestar
    S02 -> S21 -> guardar
    clics: ~6

F14 Ver la evolución de un paciente
    S02 -> S22
    clics: 2

F15 Comparar pacientes y exportar
    menú -> S23 ; menú -> S24 -> exportar CSV
```

## Componentes

| componente | variantes | estados | se usa en |
| --- | --- | --- | --- |
| Botón | principal, secundario, fantasma, peligro | normal, pulsado, foco, desactivado, cargando | todas |
| Campo numérico con unidad | kg, cm, m, grados | vacío, válido, error | S03, S05, S09, S13 |
| Lista de pacientes | con avatar de iniciales | vacía, llena, filtrada | S01, S23 |
| Tarjeta de métrica | grande (principal), pequeña | normal, aviso fuera de rango | S02, S08, S10, S14 |
| Cuadrícula de categorías | — | — | S04 |
| **Visor de vídeo con marcado por fotograma** | evento único, par de eventos, serie | sin vídeo, cargando, marcando, marcas completas | S07 (y todos los tests por vídeo) |
| Barra de tiempo (scrubber) | con marcas de colores | arrastrando | S07 |
| Transportador / ángulo sobre imagen | 2 segmentos | — | S19, S20 |
| Lectura de inclinómetro | — | sin permiso, sin sensor, midiendo | S19 |
| Gráfica | línea en el tiempo, recta de regresión (F-v, carga-velocidad), barras de asimetría | 1 dato, vacía | S09, S10, S14, S22 |
| Escala de bienestar | 1-5 o 1-10 | sin responder | S21 |
| Tabla ordenable | — | vacía | S23 |
| Aviso / toast | éxito, error, información | — | todas |
| Hoja de ayuda | — | — | S25 |

## Modelo de datos inferido

```
Paciente      id, nombre, fecha_nacimiento, sexo, masa_kg, estatura_cm,
              longitud_pierna_cm, distancia_empuje_cm (hpo), notas, creado_en
              evidencia: método de Samozino necesita masa y distancia de empuje (fuentes 9, 10);
                         "usuarios ilimitados" (fuente 2)
              confianza: alta

Test          id, paciente_id, categoria (salto | fuerza | sprint | cod | carrera | rom | nordico | bienestar),
              tipo (cmj, sj, cmj_brazos, dj, horizontal, unipodal_izq, unipodal_dcha, 10_5,
                    vbt, sprint_lineal, sprint_curvo, deceleracion, 505, 5mas5, vcut, illinois,
                    smas, carrera, rom_tobillo, rom_cadera, rom_hombro, rom_cuello, nordico, readiness),
              fecha, carga_kg, altura_caida_cm, notas
              evidencia: lista de tests de la ficha de App Store (fuente 1)
              confianza: alta (lista de tests); guess (agrupación exacta)

Marca         id, test_id, evento (despegue | aterrizaje | contacto | inicio | fin | paso),
              tiempo_s, fotograma, indice_en_serie
              evidencia: marcado manual de fotogramas (fuente 3)
              confianza: alta

Video         id, test_id, fps, duracion_s, guardado_en (solo en el dispositivo por defecto)
              evidencia: "funciona mejor con vídeo a cámara lenta" (fuente 1)
              confianza: media (dónde se guarda es una decisión del clon)

Resultado     id, test_id, metrica (altura_cm, tiempo_vuelo_ms, tiempo_contacto_ms, rsi, rsi_mod,
              rigidez, dri, fuerza_n, velocidad_ms, potencia_w, velocidad_barra_ms, tiempo_s,
              angulo_grados, torque_nm, frecuencia_paso, puntuacion), valor, unidad
              evidencia: métricas declaradas en fuentes 1, 4, 11, 16
              confianza: alta (métricas); guess (fórmula exacta de rigidez, DRI y torque)

Perfil        id, paciente_id, tipo (fuerza_velocidad | carga_velocidad), fecha,
              f0, v0, pmax, pendiente, perfil_optimo, desequilibrio_pct, rm1_estimado
              tests: [test_id]
              evidencia: fuentes 1, 9, 13
              confianza: media

Bienestar     id, paciente_id, fecha, sueno, fatiga, estres, agujetas
              evidencia: ficha de tienda vía búsqueda (fuente 1)
              confianza: media (no se vio la escala exacta)
```

Relaciones: Paciente 1-n Test, Test 1-n Marca, Test 0-1 Video, Test 1-n
Resultado, Paciente 1-n Perfil, Perfil n-n Test, Paciente 1-n Bienestar.

## Matriz de funciones

Ver `features.csv`. Must: 13, should: 20, could: 7, skip: 5.

## Fuera de alcance (no se puede o no se debe copiar)

- **El nombre, el logo, los textos, los vídeos tutoriales y las ilustraciones**
  de My Jump Lab. El clon tendrá nombre e imagen propios (`/replica-brand`).
- **Su validación científica.** My Jump Lab dice estar validada en más de 20
  estudios. Eso es de la app original, no del clon: el clon usa las mismas
  fórmulas públicas, pero no está validado hasta que Fisiolab lo compare
  con una referencia (por ejemplo, medir los mismos saltos con el clon y con
  la app original o una plataforma de fuerza). Hay una fila para eso.
- **Los modelos de IA propios** de la app (detección automática del salto y de
  la barra). Si se hace detección automática, será con un modelo abierto.
- **Medir la estatura con LiDAR.** Los navegadores web no tienen acceso al LiDAR.
- **ForceData.** Por el nombre parece conectar plataformas de fuerza; no se ha
  podido confirmar qué hace. Necesitaría hardware.
- **La suscripción y la tienda de apps.** No hacen falta para uso en la clínica.
- **Uso diagnóstico.** Medir rendimiento es una cosa; usar la medida para
  diagnosticar o decidir un tratamiento puede entrar en la normativa europea de
  productos sanitarios. Para un uso interno de seguimiento no debería aplicar,
  pero conviene confirmarlo. Esto no es asesoramiento legal.

## Tamaño

Pantallas 25, flujos 15, entidades 7.

Partes difíciles:
1. **El marcado preciso por fotograma en el navegador.** Los vídeos a cámara
   lenta del iPhone (240 fps) se guardan de forma especial y el navegador no
   siempre dice cuántos fotogramas por segundo tienen. Un error de un
   fotograma a 30 fps cambia la altura de un CMJ varios centímetros; a 240 fps
   es mucho menor. Hay que leer los fps de forma fiable o pedirlos.
2. **Grabar a cámara lenta desde la web no es posible de forma fiable.** El
   flujo será: grabar con la cámara del móvil y subir el vídeo.
3. **Datos de salud de pacientes.** Son datos especialmente protegidos (RGPD).
   La opción más simple y segura: todo guardado en el propio dispositivo, sin
   servidor, con exportación CSV y copia de seguridad manual.
4. **Las fórmulas** (perfil F-V, rigidez, DRI, torque del nórdico, 1RM) tienen
   que tomarse de los artículos originales y comprobarse con datos conocidos.
5. **Sensores del móvil desde la web** (inclinómetro para la movilidad): el
   iPhone pide permiso y no todos los navegadores lo dan igual.

Tamaño: **XL** para la app completa, lo que según el método significa
reducirla por fases. Propuesta:

| fase | contenido | tamaño |
| --- | --- | --- |
| 1 | Pacientes + saltos (CMJ, SJ, DJ/RSI) + evolución + CSV | M (unas semanas) |
| 2 | Perfil F-V, asimetría, 10-5, horizontal, RSI-mod | M |
| 3 | Velocidad de barra y 1RM; movilidad; nórdico; bienestar | M |
| 4 | Sprint, cambio de dirección, S-MAS, carrera | M |
| 5 | Detección automática con IA (opcional) | L |

## Huecos de esta investigación

- No se ha visto ninguna pantalla real del original. Si tienes una suscripción
  a My Jump Lab, puedes hacer capturas de tu propia app y guardarlas en
  `replica/screens/` como referencia (solo para comparar, nunca se publican).
  Antes, revisa sus condiciones de uso: si prohíben usar la cuenta para crear
  un producto que compita, trabajamos solo con fuentes públicas.
- No se han encontrado detalles públicos de cómo calcula la asimetría, la
  escala exacta del cuestionario de bienestar ni qué hace "My Mocap" o "ForceData".
