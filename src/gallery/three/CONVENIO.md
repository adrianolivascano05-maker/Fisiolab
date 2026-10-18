# Convenio anatómico de las figuras 3D

Este documento es la única definición de nombres y signos de los ángulos que describen una maniobra
(`script` en `src/gallery/data/*.ts`). El código (`three/anatomy.ts`, `three/rig.ts`) y las pruebas
(`three/anatomy.test.ts`) lo siguen; si algo cambia aquí, cambia allí.

## Marco del paciente

- **x** hacia la izquierda del paciente, **y** hacia su cabeza y **z** hacia delante (anterior), sea cual
  sea su postura (de pie, sentado, tumbado…). Unidades: centímetros y grados.
- **Posición de referencia (0°):** posición anatómica (de pie, brazos a los lados), salvo el antebrazo, cuya
  referencia es la **posición neutra** (pulgar hacia arriba con el codo a 90°).
- **Los dos lados usan los mismos números.** `r_hip: { rot: 30 }` y `l_hip: { rot: 30 }` son la misma
  rotación interna de 30°, cada una en su lado; el esqueleto hace el espejo.

## Grados de libertad y signos

| articulación | `flex` | `abd` | `rot` | otros |
| --- | --- | --- | --- | --- |
| `pelvis` (respecto a la postura) | anteversión + / retroversión − | — | hacia la derecha + | `lat`: baja el lado derecho + |
| `trunk` (tórax respecto a la pelvis) | flexión + / extensión − | — | hacia la derecha + | `lat`: inclinación a la derecha + |
| `neck` (cabeza respecto al tórax) | flexión + / extensión − | — | hacia la derecha + | `lat`: inclinación a la derecha + |
| `jaw` | apertura de la boca (0 cerrada, ~30 máxima) | — | — | — |
| `r_/l_shoulder` | flexión + / extensión − | abducción + / aducción − | interna + / externa − | — |
| `r_/l_elbow` | flexión + | — | — | `pron`: pronación + / supinación − (desde neutra) |
| `r_/l_wrist` | flexión palmar + / extensión (dorsal) − | desviación radial + / cubital − | — | — |
| `r_/l_hip` (respecto a la pelvis) | flexión + / extensión − | abducción + / aducción − | interna + / externa − | — |
| `r_/l_knee` | flexión + | valgo + / varo − (solo para pruebas de estrés) | rotación interna de la tibia + / externa − | — |
| `r_/l_ankle` | flexión dorsal + / plantar − | — | — | `inv`: inversión + / eversión − |

**Cómo se componen.** En cada articulación primero la flexión, luego la abducción y por último la rotación
sobre el eje largo del segmento (secuencia flexión–abducción–rotación). Con el hombro a 90° de abducción, la
flexión gira el brazo sobre sí mismo (bloqueo de cardán): en esa posición se describe la rotación con `rot` y
la aducción horizontal con `flex` 90 y `abd` negativo.

**Qué significa cada rotación (comprobado en las pruebas con la geometría, no con los propios ángulos):**

- Rotación interna de cadera con cadera y rodilla a 90°: el pie va hacia fuera.
- Rotación interna de hombro a 90/90 (tumbado): la mano va hacia los pies. Rotación externa con el codo
  pegado al cuerpo: la mano va hacia fuera.
- Rotación interna de la tibia: la punta del pie va hacia dentro.
- Pronación con el codo a 90°: la palma mira hacia abajo; supinación, hacia arriba.
- Inversión: la planta mira hacia dentro.
- Desviación radial: la mano va hacia el pulgar.
- Cuello o tronco rotados a la derecha: la nariz o el pecho miran a la derecha del paciente.

## Lo que el guion no dice

Las articulaciones que un guion no menciona toman una postura natural según la postura del paciente (de pie,
brazos colgando; sentado, manos en los muslos; tumbado, brazos a los lados; boca abajo, cabeza girada a la
derecha y pies relajados). Los brazos que no se mencionan cuelgan con la gravedad aunque el tronco se
incline. Nada que el guion no mencione se mueve durante la maniobra (lo comprueban las pruebas).

## Movimiento, fuerzas y lados

- **Pasos.** Un guion tiene una posición de partida (`start`) y pasos (`steps`); cada paso dice cómo quedan
  al final las articulaciones que cambian, quién mueve (examinador: pasivo; paciente: activo), su duración y
  su pausa. La vuelta a la partida se añade sola. El tiempo de cada paso sigue una curva de mínimo jerk.
- **Desplazamientos** (`shift`): cajones, Lachman, compresión. Van en cm y en dirección anatómica. Si se
  exageran para que se vean, el texto del paso lo dice.
- **Marcas.** Azul, «el examinador empuja»; naranja con tope, «el paciente empuja y el examinador no le
  deja» (isométrico: no se mueve nada); flecha de recorrido gris oscuro, el camino real que sigue un punto
  del segmento que se mueve, con su etiqueta (p. ej. «RI 35°»). El sentido de una flecha de recorrido sale
  del propio movimiento, así que no puede contradecir a la etiqueta ni cambiar al girar la cámara.
- **Lado.** `side` dice qué lado se explora (por defecto el derecho; `both`, bilateral). Se ve siempre en
  pantalla (D/I). El lado izquierdo de cualquier test se obtiene con el espejo exacto de la escena, sin
  duplicar los datos.

## Límites fisiológicos

Están en `three/anatomy.ts` (`LIMITS`) y las pruebas comprueban que ningún guion se sale de ellos. Son
valores de manuales de goniometría, algo redondeados hacia arriba para admitir maniobras de fin de rango.

## Supuestos

Cuando la fuente de un test no da un dato (rango, plano, posición de partida, lado) se pone el valor más
habitual y se apunta en `supuestos` de la figura, para que lo revise un fisioterapeuta. Este convenio y los
supuestos **no están validados clínicamente**: los ha escrito el equipo de desarrollo.
