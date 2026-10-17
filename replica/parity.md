# Paridad con My Jump Lab

Fecha: 2026-10-17 · Tras la fase 2 de saltos

## Veredicto: **saltos completos (fases 1 y 2); la copia completa todavía no**

Los 13 must-haves están hechos y no hay fallos S1 ni S2 abiertos (`replica/bugs.md`). Por la regla del
método, «publicable» pide además 80 puntos de paridad y hay 82,1: faltan las fases 3-4 (fuerza, sprint,
carrera, movilidad, nórdico, bienestar). Por eso se publica como **versión de
prueba** para saltos (CMJ, SJ, DJ), no como sustituto de My Jump Lab.

| medida | valor |
| --- | --- |
| **Paridad total de funciones** | **82,1 / 100** (39 funciones puntuables) |
| Must-haves | **13 de 13** |
| Saltos (fases 1 y 2) | completos: CMJ, CMJ con brazos, SJ, DJ (RSI, rigidez, DRI), unipodal y asimetría, 10/5, horizontal, RSI-mod, perfil F-V |
| Paridad de pantallas (layout) | **sin medir**: no hay capturas del original |

El 66 % es honesto: la app completa de My Jump Lab tiene fuerza, sprint, carrera, movilidad,
nórdico y bienestar, y aquí están todos los saltos. Es lo previsto en el plan por fases
del recon, no un retraso.

## Paridad de pantallas

No se ha podido medir. La herramienta `imgdiff.py` compara la estructura de cada pantalla con una
captura del original al mismo tamaño, y el recon se hizo solo con fuentes públicas: no hay capturas
de la app en `replica/screens/`. Si Fisiolab tiene suscripción y sus condiciones lo permiten,
bastan capturas de su propio iPhone (390×844) de: lista de atletas, ficha, selector de test,
marcado del vídeo y resultado. Las del clon ya están en `replica/clone-screens/`.

## Diferencias de comportamiento (por lo que se sabe en público)

| flujo | el original | el clon | arreglar o mantener |
| --- | --- | --- | --- |
| F02 grabar | graba a cámara lenta dentro de la app | se graba con la cámara del móvil y se sube | mantener: la web no puede grabar a 240 fps de forma fiable. Comprobar en iPhone si "Hacer vídeo" desde la app ofrece cámara lenta (M1) |
| F02 marcar | marcado manual por fotograma y detección automática con IA | solo manual, con lupa y teclado | mantener por ahora; IA es "could" (fase 5) |
| F02 fps | la app sabe a qué fps graba | lee los fps del archivo y deja indicar los de grabación, con aviso por debajo de 100 | mantener; mejora para vídeos que llegan "ralentizados" |
| F02 resultado | altura, fuerza, velocidad, potencia | lo mismo, con aviso si el valor no es plausible | mantener (mejora) |
| F03 drop jump | RSI, contacto, rigidez, DRI | RSI y contacto; sin rigidez ni DRI | construir en fase 2 |
| Datos | en el iPhone, CSV, suscripción | app instalable que funciona sin conexión, CSV para Excel en español, copia de seguridad restaurable con recordatorio semanal, sin cuentas ni suscripción | mantener |
| Varias pestañas/dispositivos | una app nativa | una pestaña cada vez (avisa); sin sincronización entre móviles | mantener; la copia de seguridad sirve para pasar datos |
| Validación | más de 20 estudios publicados | ninguna todavía | **hacer antes de uso clínico** (caso manual M4) |
| Clics para un CMJ | no se ha podido contar | ~8 desde la ficha | contar en el original si hay acceso |

## Qué falta, en orden de construcción

Must-haves: ninguno pendiente. Hechos el 2026-10-17: PWA instalable y sin conexión; ayuda con
ilustraciones; vídeo real del móvil (Pixel 7 Pro, 120 fps guardado a 30: 30,7 cm).

Fase 2, saltos (should): perfil fuerza-velocidad, asimetría unipodal, RSI-mod, CMJ con brazos,
10-5, salto horizontal, rigidez y DRI (estas dos tras confirmar la fórmula en el artículo).

Fase 3 (should): velocidad de barra y 1RM, movilidad, nórdico, bienestar.
Fase 4 (should): sprint con tiempos de paso, cambios de dirección, carrera, comparar pacientes.
Could: S-MAS, sprint curvo, deceleración, idiomas, IA.

## Las cinco siguientes cosas a construir

1. Validación: 10-20 saltos medidos a la vez con la app y con My Jump Lab (u otra referencia).
2. ~~Bienestar (cuestionario rápido; fase 3, pequeño).~~ Hecho el 2026-10-17 (S21).
3. ~~Velocidad de barra y 1RM (fase 3).~~ Hecho el 2026-10-17 (S13-S14).
4. ~~Movilidad: tobillo, cadera, hombro (fase 3).~~ Hecho el 2026-10-17 (S19).
5. ~~Nórdico de isquios (fase 3).~~ Hecho el 2026-10-17 (S20).

## Salida completa de parity.py

### Parity: 65.5 / 100

features 65.5  (39 counted, must-haves 13 of 13 done)

### By area, weakest first
- fuerza                         0.0  (3 features)
- movilidad                      0.0  (1 features)
- isquios                        0.0  (2 features)
- bienestar                      0.0  (1 features)
- sprint                         0.0  (5 features)
- carrera                        0.0  (1 features)
- ia                             0.0  (3 features)
- ajustes                        0.0  (1 features)
- historial                     60.0  (2 features)
- pacientes                    100.0  (3 features)
- vídeo                        100.0  (2 features)
- saltos                       100.0  (12 features)
- datos                        100.0  (2 features)
- ayuda                        100.0  (1 features)

### Missing, in build order
- [should] carrera: Mecánica de carrera (contacto vuelo frecuencia de paso), no
- [should] historial: Comparar pacientes y ranking por test, no
- [should] sprint: Sprint lineal con tiempos de paso, no
- [should] sprint: Tests de cambio de dirección (5-0-5 5+5 V-Cut Illinois), no
- [could] ajustes: Varios idiomas, no
- [could] ia: Captura de movimiento (My Mocap), no  (no se ha podido confirmar qué mide)
- [could] ia: Detección automática del salto con IA, no  (solo con un modelo abierto; no se copian los del original)
- [could] ia: Velocidad de barra automática con IA, no
- [could] sprint: Deceleración horizontal, no
- [could] sprint: S-MAS (puntuación de mecánica de sprint), no
- [could] sprint: Sprint curvo, no

### Left out on purpose (not scored)
- Medir la estatura con LiDAR: los navegadores no acceden al LiDAR
- Conectar plataformas de fuerza (ForceData): necesita hardware y no está confirmado qué hace
- Suscripción y prueba gratis: uso interno en la clínica: no hace falta
- Compartir suscripción entre iPhone iPad y Mac: no aplica a una web
- Validación científica publicada del original: es del original; el clon necesita la suya propia

### Yours, not in the original (not scored)
- Validación interna del clon contra una referencia
