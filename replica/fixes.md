# Qué mejorar respecto a My Jump Lab, según sus usuarios

Fecha: 2026-10-17. **Muestra pequeña: 12 fragmentos de reseñas de 2 fuentes (Google Play y App Store),
sin estrellas ni fechas.** Desde este entorno no se pueden abrir las tiendas ni los agregadores de reseñas
(la red los bloquea); los fragmentos son los que devolvió el buscador citando esas páginas y no se han podido
comprobar letra a letra contra la reseña original. Sirve para orientar, no para ordenar con rigor.
Detalle y enlaces: `replica/reviews.csv` y `replica/feedback.md`.

Contexto público (fichas de las tiendas, según el buscador): ≈ 3,7 en Google Play (≈ 2.000 reseñas) frente a
≈ 4,6 en la App Store; las quejas se concentran en Android.

## 1. Lo que odian

| # | problema | reseñas | fuentes | cita |
| --- | --- | --- | --- | --- |
| 1 | Cálculos poco fiables o inconsistentes, unidades mezcladas | 4 | 2 | "jump heights it calculates are always inconsistent, even if I select the same frames in the video"; "averaging all jumps recorded in inches, and displaying average in cm" |
| 2 | Navegar fotograma a fotograma falla y obliga a cerrar la app y empezar de nuevo (escasa) | 3 | 1 | "it sometimes doesn't move to the frame I need, and I have to force close the app and restart the process" |
| 3 | Fallos y cierres en funciones nuevas (velocidad de barra) (escasa) | 2 | 2 | "crashed every time I used it and was inconsistent when it did work" |
| 4 | Prueba gratis confusa y cobro a clientes antiguos (escasa) | 2 | 2 | "The free trial is a bit misleading."; "I was able to do 1 test (cmj) and now I cannot do anymore until I pay again." |
| 5 | Ya no se pueden indicar los fps a mano (escasa) | 1 | 1 | "previously I could enter the frame rate of the slow mo video, now I can't" |

Sin cita textual (el buscador solo lo resumió, así que no se cuenta como prueba): reseñas en castellano de la App
Store con la app colgándose casi al acabar un test y perdiéndolo entero, correos de soporte sin respuesta, y
quejas de que el zoom del vídeo dificulta seguir el movimiento y de botones de despegue/aterrizaje confusos.

## 2. Lo que echan en falta

| # | petición | reseñas | fuentes | cita |
| --- | --- | --- | --- | --- |
| 1 | Medir sin tener que montar antes un perfil (escasa) | 1 | 1 | "so much buggy nonsense of setting up a profile just to test the app" |

## 3. Lo que no resuelven

- **La clínica que necesita fiarse del número.** Quien ve dos resultados distintos con los mismos fotogramas deja
  de confiar en la herramienta (tema 1). Según el resumen del buscador, un análisis independiente (Science for Sport, scienceforsport.com/is-my-jump-lab-accurate) añade que tiende a
  sobrestimar el CMJ frente a la plataforma de fuerza.
- **El usuario de Android.** Casi todas las quejas citadas vienen de Google Play.

## Plan de mejoras

| # | qué | tamaño | estado | evidencia |
| --- | --- | --- | --- | --- |
| 1 | **Autoguardado de las marcas**: si la página se cierra o se recarga a mitad (Android lo hace al ir a la cámara o a la galería), al volver se recuperan y se avisa | S | hecho | tema 2 (forzar cierre y empezar de nuevo) y el test perdido de la App Store |
| 2 | **«Cómo se ha calculado» en el resultado del salto**: fotogramas marcados, fps, vuelo y fórmula con sus números; solo sistema métrico | S | hecho | tema 1 |
| 3 | **Medición rápida sin ficha**: un botón en Pacientes que lleva directo a medir, guardando en una ficha «Medición rápida» que luego se puede renombrar | S | hecho | petición 1 |
| 4 | Fotograma exacto con la hora real de cada fotograma (no un ritmo fijo) | M | ya estaba | tema 2 |
| 5 | Elegir los fps a mano cuando el archivo no los trae o la cámara lenta se guardó ralentizada | S | ya estaba | tema 5 |
| 6 | Sin prueba gratis ni suscripción: es de la clínica | — | ya estaba | tema 4 |
| 7 | Validar contra plataforma de fuerza y publicar el error propio (sesgo y límites de acuerdo) | M | pendiente | tema 1 y el análisis de Science for Sport |
| 8 | Lupa sobre la imagen al marcar (además de la barra ampliada que ya existe) | S | pendiente, evidencia escasa | quejas sobre el zoom solo resumidas por el buscador |

## El ángulo

1. **Para la clínica que necesita fiarse del número:** Impulso enseña de dónde sale cada resultado (fotogramas,
   fps y fórmula) y con los mismos fotogramas da siempre lo mismo. Evidencia: tema 1, 4 reseñas en 2 fuentes.
2. **Para quien mide con Android:** marcado fotograma a fotograma exacto que no se pierde si el móvil cierra la
   página. Evidencia: tema 2, 3 reseñas en 1 fuente (escasa).
3. **Para quien solo quiere medir:** sin suscripción ni perfiles obligatorios. Evidencia: temas 4 y petición 1,
   3 reseñas en 2 fuentes (escasa).

**Recomendado: el 1.** Encaja con la marca (confianza y profesionalidad) y con el uso en consulta.
