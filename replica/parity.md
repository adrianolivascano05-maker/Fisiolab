# Paridad con My Jump Lab

Fecha: 2026-10-17 · Actualizado tras construir PWA y ayuda ilustrada

## Veredicto: **no publicable todavía**

Falta 1 must-have: probar con un vídeo real del iPhone (depende de Fisiolab). No hay fallos S1 ni S2 abiertos
(ver `replica/bugs.md`).

| medida | valor |
| --- | --- |
| **Paridad total de funciones** | **44,6 / 100** (39 funciones puntuables) |
| Must-haves | 12 de 13 completos, 1 a medias → 96,2 % |
| Fase 1 (saltos) | casi completa; fases 2-4 sin empezar |
| Paridad de pantallas (layout) | **sin medir**: no hay capturas del original |

El 45 % es honesto: la app completa de My Jump Lab tiene fuerza, sprint, carrera, movilidad,
nórdico y bienestar, y aquí solo están los saltos básicos. Es lo previsto en el plan por fases
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

Must-haves (bloquean la publicación):
1. **Vídeo real del iPhone**: comprobar los fps reales y la reproducción (lo tiene que grabar Fisiolab).
   Hechos el 2026-10-17: PWA instalable y sin conexión; ayuda con ilustraciones propias.

Fase 2, saltos (should): perfil fuerza-velocidad, asimetría unipodal, RSI-mod, CMJ con brazos,
10-5, salto horizontal, rigidez y DRI (estas dos tras confirmar la fórmula en el artículo).

Fase 3 (should): velocidad de barra y 1RM, movilidad, nórdico, bienestar.
Fase 4 (should): sprint con tiempos de paso, cambios de dirección, carrera, comparar pacientes.
Could: S-MAS, sprint curvo, deceleración, idiomas, IA.

## Las cinco siguientes cosas a construir

1. Prueba con un vídeo real del iPhone de Fisiolab y ajustes que salgan de ella (must).
2. Protocolo de validación: medir 10-20 saltos a la vez con el clon y con My Jump Lab (o plataforma)
   y anotar la diferencia media; pantalla o CSV para registrarlo (propio, should).
3. Perfil fuerza-velocidad (fase 2).
4. Asimetría entre piernas con salto unipodal (fase 2).
5. RSI-mod y CMJ con brazos libres (fase 2, pequeños).

## Salida completa de parity.py

### Parity: 44.6 / 100

features 44.6  (39 counted, must-haves 12 of 13 done)

Not shippable yet: 1 must-have features are not done.

### By area, weakest first
- fuerza                         0.0  (3 features)
- movilidad                      0.0  (1 features)
- isquios                        0.0  (2 features)
- bienestar                      0.0  (1 features)
- sprint                         0.0  (5 features)
- carrera                        0.0  (1 features)
- ia                             0.0  (3 features)
- ajustes                        0.0  (1 features)
- saltos                        42.9  (12 features)
- historial                     60.0  (2 features)
- vídeo                         75.0  (2 features)
- pacientes                    100.0  (3 features)
- datos                        100.0  (2 features)
- ayuda                        100.0  (1 features)

### Missing, in build order
- [must] vídeo: Subir vídeo a cámara lenta y detectar sus fps, partial  (grabar desde la web no es fiable: se graba con la cámara del móvil y se sube; S06; lee fps del MP4/MOV y permite indicar los de grabación; probado con vídeos sintéticos, falta un vídeo real de iPhone)
- [should] bienestar: Cuestionario de bienestar (sueño fatiga estrés agujetas), no
- [should] carrera: Mecánica de carrera (contacto vuelo frecuencia de paso), no
- [should] fuerza: Perfil carga-velocidad y 1RM estimado, no
- [should] fuerza: Pérdida de velocidad en la serie, no
- [should] fuerza: Velocidad media de la barra por vídeo, no
- [should] historial: Comparar pacientes y ranking por test, no
- [should] isquios: Nórdico: torque estimado, no  (fórmula por confirmar)
- [should] isquios: Nórdico: ángulo de rotura, no
- [should] movilidad: Movilidad de tobillo (lunge) hombro cadera y cuello, no  (inclinómetro del móvil o ángulo sobre foto)
- [should] saltos: Asimetría entre piernas (salto unipodal), no  (cálculo exacto no publicado: usar % estándar)
- [should] saltos: CMJ con brazos libres, no
- [should] saltos: Dynamic Rebound Index en drop jump, no  (añadido en 2026 (Brooks); fórmula por confirmar)
- [should] saltos: Perfil fuerza-velocidad óptimo y desequilibrio, no
- [should] saltos: RSI-mod (altura / tiempo hasta el despegue), no
- [should] saltos: Rigidez vertical en drop jump, no  (fórmula a tomar de la literatura)
- [should] saltos: Salto horizontal, no
- [should] saltos: Saltos repetidos 10-5, no
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
