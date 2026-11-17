# Organizar el tratamiento por ciclos

Opcional. Si el fisio no lo usa, la sesión queda exactamente como antes. Si lo usa, organiza el tratamiento de un
motivo de consulta en:

- **Macrociclo**: el objetivo general, con su inicio y su duración total.
- **Mesociclos**: las fases (de 1 a 8), cada una con sus semanas (de 1 a 12) y un objetivo de una línea opcional.
- **Microciclos**: las semanas. Cada semana tiene una o varias sesiones tipo (A, B…, hasta 4) con sus ejercicios
  (hasta 15) y sus parámetros: series, repeticiones, kilos, % 1RM, esfuerzo (RPE o RIR, uno para todo el plan),
  tiempo, distancia, descanso, tempo y lado. Casilla vacía: no se usa.

## Regla que manda

La app solo registra y hace las cuentas que el fisio elige. No propone ejercicios, cargas, fases ni duraciones; no
cambia de fase sola; no dice «recomendado», «riesgo» ni «retraso»; no colorea por rangos. Las plantillas solo traen
nombres de fases y semanas.

## Pantallas (fase A)

| Pantalla | Ruta | Archivo |
|---|---|---|
| Crear o cambiar el plan | `/pacientes/:id/ciclos/nuevo` | `src/clinical/cycles/PlanCreatePage.tsx` |
| Ejercicios de una semana | `/pacientes/:id/ciclos/:fase/semana/:w` | `src/clinical/cycles/WeekPage.tsx` |
| Cómo progresa | `/pacientes/:id/ciclos/:fase/progresion` | `src/clinical/cycles/ProgressPage.tsx` |
| El plan | `/pacientes/:id/ciclos` | `src/clinical/cycles/PlanPage.tsx` |
| En la sesión | — | `src/clinical/cycles/SessionCycles.tsx` |
| Enviar la semana al paciente (fase B) | `/pacientes/:id/ciclos/enviar` | `src/clinical/cycles/SendWeekPage.tsx` |
| Lo que ve el paciente (fase B) | `/formulario/:id#clave` | `src/patientForm/WeekView.tsx` |

Todas llevan `?motivo=` (si no, el motivo que se ve) y `?volver=`. Se llega desde la sesión (el botón «Organizar por
ciclos» bajo Tratamiento si no hay plan; la línea de fases bajo el título si lo hay) y desde la tarjeta del plan en
Sesiones y en el Resumen.

## Cuentas (`src/data/cycles.ts`, probadas en `cycles.test.ts`)

- **Semanas** de lunes a domingo, con el día de Madrid. La semana 1 es la que contiene el día de inicio.
- **Reglas**: Igual, +1/+2/+3 reps, +2,5 kg, +5 kg, +5 % (a los kilos; sin kilos, al % 1RM), +1 RPE (como mucho 10),
  −1 RIR (como poco 0) y A mano (no se rellena). Kilos redondeados a 0,5.
- **Descarga** (la última semana de cada fase, si se marca): una serie menos (mínimo 1) y un 40 % menos de carga
  (editable de 0 a 60 %); repeticiones y esfuerzo iguales.
- **Lo cambiado a mano** fuera de la semana 1 queda marcado: «Rellenar» no lo pisa; si se quiere pisar, se pregunta.
- **Poner ejercicios** en una fase nueva copia las sesiones tipo de la anterior y empieza con su última semana normal.
- **Alargar 1 semana** mete la nueva antes de la descarga; **Pasar a la siguiente fase** acaba la de ahora esta
  semana. En los dos casos se avisa antes de que se mueven las fases siguientes.
- **1RM aproximado**: fórmula de Epley (kg × (1 + reps / 30)); con una repetición, los propios kilos; solo hasta 12
  repeticiones. Se calcula a mano en cada ejercicio con % 1RM y pasa el porcentaje a kilos («≈ 48 kg»). Es una
  estimación: la app no dice si es buena o mala.
- **En la sesión**, toca la sesión tipo que corresponde por orden en la semana (A, B, A…), con «cambiar» para elegir
  otra. Lo marcado se escribe en Tratamiento con un formato fijo («Prensa bilateral 3 × 10 con 45 kg (RPE 8).»); si el
  fisio cambia ese texto a mano, la app ya no lo toca.

## Enviar la semana al paciente (fase B, `src/data/cyclesShare.ts`, probado en `cyclesShare.test.ts`)

- Desde el plan, **Enviar la semana al paciente**: esta semana o la siguiente (si tienen ejercicios). Siempre van los
  ejercicios con sus series y repeticiones (o el tiempo, la distancia, el tempo, el lado y el descanso, si los tienen),
  «Cómo se hace» si el fisio lo ha escrito y sus próximas citas. **Solo si se marcan**: los kilos (un % del 1RM pasa a
  kilos si el ejercicio tiene 1RM calculado), el esfuerzo (RPE o RIR) y la línea de fases con «estás aquí» y el
  objetivo general. Antes de crear el enlace se ve «Así lo verá».
- **Mismo mecanismo que los formularios**: se cifra con una clave nueva que va después de «#» (no llega al servidor) y
  el servidor solo guarda bytes ilegibles (`kind: "ciclos-semana"`, `FormRequest.week`). No hizo falta cambiar el
  servidor. La página es de solo lectura: no hay nada que enviar.
- **Caduca** al acabar esa semana: el lunes siguiente a las 0:00, hora de Madrid (`weekEnd`). El servidor admite como
  mucho 14 días, por eso solo se ofrecen esta semana y la siguiente.
- **Por WhatsApp o correo** solo con el permiso de contacto firmado; si no, «Copiar el enlace» para dárselo en persona.
  El mensaje es fijo y no lleva datos de salud: «Hola, Lucía. Aquí tienes tus ejercicios de la semana de …».
- **Enlaces mandados**: los 8 últimos de cada plan, con «Copiar el enlace» y «Anular» (se borra del servidor y deja de
  abrirse). No van entre los formularios de su ficha porque no se contestan.
- **«Cómo se hace»**: un texto opcional por ejercicio (hasta 400 letras), que escribe el fisio en la semana. Como la
  biblioteca de ejercicios no se usa por ahora, se recuerda con el nombre del ejercicio para la próxima vez.

## Cómo se guarda

En la tabla `settings`, que ya se sincroniza fila a fila. No hay migración: un dispositivo sin actualizar sigue
sincronizando y ve el texto de Tratamiento de cada sesión como siempre (va en `sessions.treatment`).

| Clave | Qué guarda |
|---|---|
| `ciclos:<paciente>:<motivo>` | El macrociclo y la lista de fases |
| `ciclos:<paciente>:<motivo>:<fase>` | Las sesiones tipo, sus ejercicios y las casillas de cada semana de esa fase |
| `ciclos:<paciente>:<motivo>:envios` | Los enlaces de «Enviar la semana al paciente» (los 8 últimos) |
| `ciclos_hecho:<paciente>:<sesión>` | Lo marcado como hecho en una sesión |
| `ciclos_ej:<ejercicio>` | Los últimos parámetros con que se usó un ejercicio y su «Cómo se hace» (de la clínica, sin datos del paciente) |

- **Conflictos**: cada clave es una fila; si dos dispositivos cambian la misma a la vez, se queda la más reciente y la
  otra va tres meses a «Cambios sustituidos» (sale como «Plan por ciclos», con el paciente). Fases distintas no se
  pisan.
- **Borrado**: al borrar un paciente, un motivo o una sesión se borran sus claves. Lo que se queda sin dueño porque el
  borrado llegó de otro dispositivo se limpia tras cada sincronización que trae cambios (`cleanOrphanCycles`).
- **Exportación completa**: la historia de cada paciente lleva su plan (objetivo, fases y ejercicios semana a semana,
  con «Cómo se hace») y las semanas que se le enviaron.
  La copia de seguridad, como siempre, lo lleva todo.
- **Cifrado y accesos**: va en la misma base, cifrada igual; las pantallas del plan son de la ficha.

## Pendiente

- **Fase C**: plantillas de la clínica, gráfica de evolución por ejercicio y semana de valoración.
- La biblioteca de ejercicios de la clínica no se usa por ahora: los ejercicios se escriben a mano (con sugerencias de
  los ya usados).
