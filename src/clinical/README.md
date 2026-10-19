# Ficha clínica

Lo que el fisioterapeuta registra de cada paciente además de las mediciones: la anamnesis, los tests de
exploración que hace (positivos, negativos o dudosos), los cuestionarios y cada sesión. Todo se guarda en el dispositivo, en la misma
base que el resto (migración `src/data/migrations/006_clinical.sql`), entra en la copia de seguridad y en el CSV.

La ficha del paciente tiene cinco pestañas:

| Pestaña | Ruta | Qué hay |
| --- | --- | --- |
| Resumen | `/pacientes/:id` | motivo de consulta, banderas rojas, curva del dolor, próxima reevaluación, tests de exploración, tarjetas de las últimas mediciones con su tendencia, simetrías bajo el 90 %, cuestionarios e historia del paciente (`src/pages/PatientPage.tsx`) |
| Anamnesis | `/pacientes/:id/anamnesis` | la ficha de anamnesis de la clínica, apartado por apartado |
| Exploración | `/pacientes/:id/exploracion` | tests especiales registrados, con lo que aporta cada resultado (razón de verosimilitud de la galería) y los tests propuestos para la zona |
| Mediciones | `/pacientes/:id/mediciones` | análisis, simetría entre lados, cuestionarios y lista completa de saltos, fuerza, sprint, carrera, movilidad y nórdico |
| Sesiones | `/pacientes/:id/sesiones` | cada visita: dolor 0-10, qué refiere, qué encuentras, tratamiento, plan y cuándo reevaluar; con lo que se midió ese día |

Además:

- **Informe** (`/pacientes/:id/informe`, icono de documento arriba en el resumen): datos, anamnesis, exploración con
  la evidencia de cada resultado, curva del dolor, mediciones con la simetría, cuestionarios y sesiones. Se eligen
  los apartados y se imprime o se guarda en PDF con el diálogo del navegador (`window.print()`, A4). Con la cuenta de
  Google, «Guardar en mi Drive (PDF)» lo sube a la carpeta «Cénit · Fisiolab» de Drive (`reportPdf.ts`).
- **Cuestionarios** (`/pacientes/:id/cuestionarios/nuevo`): la PSFS (el paciente elige sus actividades; la
  siguiente vez se proponen las mismas) y el cambio global percibido (−7 a +7) se contestan en la app. Del resto
  (KOOS, HOOS, LEFS, FAAM, VISA-A, VISA-P, ACL-RSI, NDI, Oswestry, QuickDASH, SPADI, TSK-11 u otro con su nombre
  y rango) solo se anota la puntuación de su hoja oficial: así no se copian sus ítems ni sus traducciones, que
  tienen derechos. Los de la zona de la anamnesis salen primero.
- **Simetría entre lados** (`symmetry.ts`): lado peor / lado mejor × 100 con la última medición de cada lado
  (salto a una pierna, 5-0-5 con cada pierna, movilidad por lados). La raya del 90 % es la referencia habitual de
  vuelta al deporte; es una ayuda para leer los datos, no un criterio de alta.
- **Reevaluaciones**: la fecha que se pone en la última sesión. La lista de pacientes muestra «Para reevaluar»
  con las de los próximos 7 días y las atrasadas.
- **Siguiente cita** (migración 007): día, hora y duración al guardar una sesión. Se pasa al calendario del
  fisioterapeuta sin conectar ninguna cuenta (`calendar.ts`, `CalendarButton.tsx`): un enlace que abre Google
  Calendar con el evento escrito (se confirma con «Guardar») o un archivo .ics para el calendario del iPhone y
  del Mac, Outlook y los demás. El evento lleva el nombre del paciente y la hora, nada de su historia clínica.
  Con la cuenta de Google conectada, la cita se apunta sola en el calendario «Cénit · Citas» y se mueve si se
  cambia (`src/cloud/googleCalendar.ts`). Sin ella, si se cambia la cita, hay que volver a añadirla.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `anamnesis.ts` | plantilla de la anamnesis (la «Ficha de anamnesis de fisioterapia» de la clínica). Para cambiar la ficha basta con cambiar esta lista: las respuestas se guardan por id de campo y lo ya escrito no se pierde |
| `ClinicalPages.tsx`, `routes.tsx` | pantallas de las pestañas y sus rutas (se cargan al entrar) |
| `parts.tsx` | pestañas del paciente, escalas numéricas (dolor, PSFS, cambio global), chips, resultado de un test y gráficas pequeñas en SVG |
| `measures.ts`, `measureParts.tsx` | el dato principal de cada medición, sus tarjetas con tendencia y la lista |
| `timeline.ts` | historia del paciente y serie del dolor |
| `questionnaires.ts`, `outcomeParts.tsx` | catálogo de cuestionarios (rango, qué es mejor, zonas), puntuación de la PSFS, tarjetas de cuestionarios y barras de simetría |
| `symmetry.ts` | índice de simetría entre lados |
| `ReportPage.tsx` | informe imprimible |
| `calendar.ts`, `CalendarButton.tsx` | la siguiente cita como enlace de Google Calendar o archivo .ics, y el botón «Añadir al calendario» |
| `galleryLink.ts`, `RegisterInPatient.tsx` | enlace con la galería de tests: buscar tests, proponer los de la zona, la evidencia de un resultado y el botón «Registrar el resultado en un paciente» de la ficha de cada test |
| `../data/clinical.ts` | datos: anamnesis, sesiones, hallazgos, cuestionarios y reevaluaciones pendientes |

Los hallazgos guardan el nombre y la región del test: se siguen leyendo aunque la galería cambie o se quite. Si se
quita la galería (`src/gallery/README.md`), hay que quitar también `galleryLink.ts`, `RegisterInPatient.tsx` y su
línea en `src/gallery/GalleryPages.tsx`, y el registro de tests de `ClinicalPages.tsx`.
