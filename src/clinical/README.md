# Ficha clínica

Lo que el fisioterapeuta registra de cada paciente además de las mediciones: la anamnesis, los tests de
exploración que hace (positivos, negativos o dudosos), los cuestionarios y cada sesión. Todo se guarda en el dispositivo, en la misma
base que el resto (migración `src/data/migrations/006_clinical.sql`), entra en la copia de seguridad y en el CSV.

La ficha del paciente tiene una cabecera común (`PatientShell.tsx`: nombre y datos, y una fila de chips de 44 px con
el motivo de consulta, la próxima cita o «Dar cita» y lo que debe; «Editar» arriba a la derecha) y cuatro pestañas que
se quedan fijas arriba al bajar. Cada cosa sale una sola vez: lo que se ve en una pestaña no se repite en otra.

**Motivos de consulta** (`EpisodePicker.tsx`, `../data/episodes.ts`, migración `010_episodes.sql`). Un paciente que vuelve
por otro problema tiene otro motivo, con su propia anamnesis (al crearlo se copian los datos personales, los antecedentes
y los hábitos). Las pestañas y el informe enseñan lo del motivo elegido, o todo junto; lo que se añade va al motivo que se
ve (o, viendo todos, al último abierto): lo apunta un disparador de la base, así que vale para cualquier forma de crear
sesiones, hallazgos, cuestionarios y mediciones. El primer motivo tiene el id del paciente y su anamnesis sigue en la
tabla `anamnesis`; sus registros tienen `episode_id` nulo. Qué motivo se ve es de cada dispositivo (`episode_focus`, no se
sincroniza); los motivos y a cuál pertenece cada registro, sí. Un motivo se puede renombrar, dar por terminado o borrar
con todo lo suyo (el primero no se borra).

| Pestaña | Ruta | Qué hay |
| --- | --- | --- |
| Resumen | `/pacientes/:id` | «Nueva sesión» y «Valorar» (hoja: registrar un test, pasar un cuestionario, nueva medición); «Situación», que informa y no es un menú (diagnóstico, alarmas, última sesión, último cuestionario o medición, simetría bajo el 90 % y reevaluación); «Pendiente» solo si falta algo (consentimiento por escrito, hoja de protección de datos, reevaluación atrasada); y tres grupos: Documentos, Legal y Cuenta (`src/pages/PatientPage.tsx`) |
| Anamnesis | `/pacientes/:id/anamnesis` | la ficha de anamnesis de la clínica, en apartados plegables sin números; «Editar anamnesis» y «Mandar su parte al paciente» en una fila. El apartado de exploración física enlaza a Valoración. El contacto (teléfono, email, dirección) no va aquí sino en los datos del paciente |
| Valoración | `/pacientes/:id/valoracion` | una página con tres bloques y saltos entre ellos (`AssessmentPage` en `ExplorationPages.tsx`): Exploración (tests registrados con lo que aporta cada resultado; los de la zona encabezan el selector de «Registrar un test»), Cuestionarios (con «Enviar al móvil», la evolución de cada uno y el bienestar diario) y Mediciones (análisis, simetría entre lados y la lista). Se abre en el último bloque usado con ese paciente. Las direcciones de antes (`/exploracion`, `/mediciones`, `/cuestionarios`) abren su bloque |
| Sesiones | `/pacientes/:id/sesiones` | cada visita: dolor 0-10, qué refiere, qué encuentras, tratamiento, plan y cuándo reevaluar; con lo que se midió ese día. Arriba, cuántas lleva de las previstas y la curva del dolor; al final, la historia (línea de tiempo). En «Nueva sesión», «Dar la siguiente cita» y «Reevaluar» (plegado si ya hay fecha); «Repetir el tratamiento de la última sesión» copia su tratamiento y su plan |

Además:

- **Informe** (`/pacientes/:id/informe`, en Resumen › Documentos): datos, anamnesis, exploración con
  la evidencia de cada resultado, curva del dolor, mediciones con la simetría, cuestionarios y sesiones. Se eligen
  los apartados y se imprime o se guarda en PDF con el diálogo del navegador (`window.print()`, A4). Con la cuenta de
  Google, «Guardar en mi Drive (PDF)» lo sube a la carpeta «OmniClin» de Drive (`reportPdf.ts`).
- **Cuestionarios** (`/pacientes/:id/cuestionarios/nuevo`): la PSFS (el paciente elige sus actividades; la
  siguiente vez se proponen las mismas) y el cambio global percibido (−7 a +7) tienen su propia pantalla. Los demás
  se rellenan enteros en la app, con el texto de cada pregunta y de cada respuesta (`forms/`), y la nota se calcula
  sola con su regla:
  - por zona: KOOS, HOOS, LEFS, FAAM, VISA-A, VISA-P, ACL-RSI, NDI, Oswestry, QuickDASH y SPADI;
  - generales: RAND-36 (calidad de vida, ocho dimensiones), PHQ-9 y GAD-7 (ánimo), TSK-11, PCS, PSEQ, FABQ, CSI y
    Örebro corto (dolor, miedo y creencias) e IPAQ corto (actividad física).

  KOOS, HOOS, RAND-36 y FABQ guardan una nota por subescala. Si se pasó en papel, «Solo anotar la nota». Al elegir,
  salen primero los de la zona de la anamnesis y después los generales por tema. El texto de los ítems es una
  traducción de trabajo: hay que revisarlo con la versión española publicada antes de usarlo en consulta, y algunos
  instrumentos (Oswestry, NDI, QuickDASH…) tienen titulares de derechos cuyas condiciones de uso debe mirar la clínica.
- **Simetría entre lados** (`symmetry.ts`): lado peor / lado mejor × 100 con la última medición de cada lado
  (salto a una pierna, 5-0-5 con cada pierna, movilidad por lados). La raya del 90 % es la referencia habitual de
  vuelta al deporte; es una ayuda para leer los datos, no un criterio de alta.
- **Reevaluaciones**: la fecha que se pone en la última sesión. Agenda › Hoy muestra en «Pendiente» las de hoy y
  las atrasadas.
- **Informe de alta** (`/pacientes/:id/alta`, `DischargePage.tsx`): del motivo de consulta que se ve, las fechas,
  el número de sesiones, el diagnóstico, la evolución (dolor, cuestionarios y mediciones: primero y último), el
  tratamiento hecho y las recomendaciones al alta (se guardan en su anamnesis). Se abre al «Dar por terminado» un
  motivo y desde el informe. Membrete y firma salen de Ajustes → Clínica (`reportParts.tsx`, común con el informe).
- **Agenda** (migración 013, `../data/appointments.ts`, `AppointmentSheet.tsx`): cada cita es una fila, con su estado
  (pendiente, atendida, no vino, anulada). Se da desde la cabecera de la ficha («Dar cita», sin sesión) o al guardar
  una sesión (la siguiente cita, que lleva el id de la sesión). En Agenda › Hoy (src/schedule/TodayView.tsx) salen todas las citas del día, con «Atender» y «Cobrar»;
  tocando una se apunta la sesión, se marca que no vino, se anula, se cambia o se borra. Al apuntar una sesión, las
  citas pendientes de ese día quedan atendidas. La próxima cita de cada paciente sale debajo de su nombre en la lista de Pacientes.
- **Siguiente cita** (migración 007): día, hora y duración al guardar una sesión. Se pasa al calendario del
  fisioterapeuta sin conectar ninguna cuenta (`calendar.ts`, `CalendarButton.tsx`): un enlace que abre Google
  Calendar con el evento escrito (se confirma con «Guardar») o un archivo .ics para el calendario del iPhone y
  del Mac, Outlook y los demás. El evento lleva el nombre del paciente y la hora, nada de su historia clínica.
  Con la cuenta de Google conectada, la cita se apunta sola en el calendario «OmniClin · Citas» y se mueve si se
  cambia (`src/cloud/googleCalendar.ts`). Sin ella, si se cambia la cita, hay que volver a añadirla.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `anamnesis.ts` | plantilla de la anamnesis (la «Ficha de anamnesis de fisioterapia» de la clínica). Para cambiar la ficha basta con cambiar esta lista: las respuestas se guardan por id de campo y lo ya escrito no se pierde |
| `AnamnesisPage.tsx`, `AssessmentSections.tsx`, `SessionPages.tsx`, `QuestionnaireFormPage.tsx`, `ExplorationPages.tsx`, `pageKit.tsx`, `routes.tsx` | pantallas de las pestañas (la Exploración aparte, porque carga la Biblioteca), sus piezas comunes y sus rutas (se cargan al entrar) |
| `parts.tsx` | pestañas del paciente, escalas numéricas (dolor, PSFS, cambio global), chips, resultado de un test y gráficas pequeñas en SVG |
| `measures.ts`, `measureParts.tsx` | el dato principal de cada medición, sus tarjetas con tendencia y la lista |
| `timeline.ts` | historia del paciente y serie del dolor |
| `forms/`, `FormFill.tsx` | cuestionarios enteros: ítems, respuestas y cálculo de la nota de cada uno, y la pantalla para rellenarlos |
| `questionnaires.ts`, `outcomeParts.tsx` | catálogo de cuestionarios (rango, qué es mejor, zonas), puntuación de la PSFS, tarjetas de cuestionarios y barras de simetría |
| `symmetry.ts` | índice de simetría entre lados |
| `ReportPage.tsx` | informe imprimible |
| `calendar.ts`, `CalendarButton.tsx` | la siguiente cita como enlace de Google Calendar o archivo .ics, y el botón «Añadir al calendario» |
| `galleryLink.ts`, `RegisterInPatient.tsx` | enlace con la galería de tests: buscar tests, proponer los de la zona, la evidencia de un resultado y el botón «Registrar el resultado en un paciente» de la ficha de cada test |
| `../data/clinical.ts` | datos: anamnesis, sesiones, hallazgos, cuestionarios y reevaluaciones pendientes |

Los hallazgos guardan el nombre y la región del test: se siguen leyendo aunque la galería cambie o se quite. Si se
quita la galería (`src/gallery/README.md`), hay que quitar también `galleryLink.ts`, `RegisterInPatient.tsx` y su
línea en `src/gallery/GalleryPages.tsx`, y el registro de tests de `ExplorationPages.tsx`.
