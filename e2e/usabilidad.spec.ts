// Comodidad del día a día: el DNI de la ficha llega al justificante y la reevaluación pendiente pasa a la sesión
// siguiente hasta que se hace.
import { add, expect, expectAccessible, test } from "./fixtures";

test.describe("Comodidad del día a día", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("US1 el DNI de la ficha sale solo en el justificante", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Diana Documento");
    await page.getByLabel("DNI o NIE").fill("12345678z");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Diana Documento" })).toBeVisible();
    await page.goto(`${page.url()}/justificante`);
    await expect(page.getByLabel("DNI o NIE del paciente (opcional)")).toHaveValue("12345678Z");
    await page.getByLabel("Día y hora de la consulta").fill("2026-10-20T10:00");
    await expect(page.getByRole("article", { name: "Justificante de asistencia" })).toContainText("con DNI/NIE 12345678Z");
    await expectAccessible(page);
  });

  test("US2 la reevaluación pendiente sigue en la sesión siguiente hasta marcarla hecha", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Rita Reevalúa");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Rita Reevalúa" })).toBeVisible();
    const record = page.url();
    await add(page, "Sesión").click();
    await page.getByRole("button", { name: "Reevaluar en 1 semana" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText(/Reevaluar el/).first()).toBeVisible();

    await page.goto(record);
    await add(page, "Sesión").click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("2026-10-27");
    await expect(page.getByText(/Sigue la reevaluación pendiente del/)).toBeVisible();
    await expectAccessible(page);
    // Con fecha, «Reevaluar» sale plegado en una línea: se abre para cambiarla.
    await page.getByText(/^Reevaluar el /).click();
    await page.getByRole("button", { name: "Ya reevaluado hoy" }).click();
    await expect(page.getByLabel("Fecha de reevaluación")).toHaveValue("");
  });

  test("US3 la anamnesis avisa sola de las banderas rojas que se escriben, sin cuadros ni urgencias", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Óscar Alarma");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Óscar Alarma" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Cervical", { exact: true }).click();
    // Lo dicho en negativo no cuenta; lo demás sale mientras se escribe.
    await page.getByLabel("Motivo principal").fill("Dolor de cuello. No tiene fiebre. Desde ayer, mareo al girar la cabeza");
    const alarms = page.getByRole("region", { name: /Banderas rojas/ });
    await expect(alarms).toContainText("Mareo, visión doble");
    await expect(alarms).toContainText("En «Motivo principal»");
    await expect(alarms).not.toContainText("Fiebre o malestar general");
    await expect(alarms).not.toContainText(/Posible|Urgente|Preferente|No apliques|médico/);
    await expectAccessible(page);
    // Sin confirmar, la carta de derivación no la incluye; y el panel ya no enlaza a la carta (está en Resumen).
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Banderas rojas/ }).getByRole("link")).toHaveCount(0);
    const toLetter = async () => {
      await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Resumen" }).click();
      await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    };
    await toLetter();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("Solicito su valoración.");
    await expect(letter).not.toContainText(/Mareo|por confirmar|Banderas rojas/);

    // Confirmarla la marca en «Banderas rojas»; entonces sí va en la carta. La prioridad no la propone la app.
    await page.goBack();
    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Anamnesis" }).click();
    await page.getByRole("button", { name: "Editar" }).click();
    await alarms.getByRole("button", { name: /Confirmar.*Mareo/ }).click();
    await expect(page.getByRole("checkbox", { name: /^Mareo, visión doble/ })).toBeChecked();
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    const confirmed = page.getByRole("region", { name: /Banderas rojas/ }).locator("div", { has: page.getByText("Confirmadas", { exact: true }) });
    await expect(confirmed.getByRole("listitem")).toHaveText(/^Mareo, visión doble/);
    await toLetter();
    await expect(page.getByRole("radio", { name: "Sin indicar" })).toBeChecked();
    await expect(letter).toContainText("Banderas rojas (signos y síntomas)");
    await expect(letter).toContainText(/Refiere: mareo, visión doble/);
    await expect(letter).toContainText("Solicito su valoración.");
    await expect(letter).not.toContainText(/Prioridad|descartar|Posible|por confirmar/);
    await page.getByLabel("Dirigida a").fill("Dra. Ruiz, Atención Primaria");
    await expect(letter).toContainText("Dra. Ruiz, Atención Primaria");
    await expectAccessible(page);
  });

  test("US4 banderas amarillas: lo que se escribe propone el cuestionario que lo mide", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Pilar Miedo");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Pilar Miedo" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByLabel("Motivo principal").fill("Lumbalgia");
    await page.locator("summary", { hasText: "Tratamientos previos y expectativas" }).click();
    await page.getByLabel("Qué cree el paciente que le pasa").fill("Le da miedo agacharse: cree que se le va a romper la espalda y que no va a mejorar");
    await expect(page.getByRole("region", { name: /Banderas amarillas/ })).toContainText("Miedo al movimiento");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    // El miedo al movimiento se mide con cuestionarios de pago (fuera del servicio): sin enlace. El catastrofismo, con la PCS.
    await page.getByRole("region", { name: /Banderas amarillas/ }).getByRole("link", { name: /PCS/ }).click();
    await expect(page).toHaveURL(/cuestionarios\/nuevo\?tipo=pcs/);
  });

  test("US5 CIF: acotar por componente como un fisio, calificar con un toque y redactar; sale en la carta de derivación", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Carlos CIF");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Carlos CIF" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Lumbar", { exact: true }).click();
    await page.getByRole("button", { name: "Añadir códigos de la CIF" }).click();
    const sheet = page.getByRole("dialog", { name: "Añadir códigos de la CIF" });
    await expect(sheet.getByRole("radio", { name: "Funciones corporales" })).toHaveAttribute("aria-checked", "true");
    // Las estructuras de su zona, propuestas con los datos de la ficha.
    await sheet.getByRole("radio", { name: "Estructuras corporales" }).click();
    await expect(sheet.getByRole("button", { name: /^s76002 Columna vertebral lumbar/ })).toBeVisible();
    await sheet.getByRole("radio", { name: "Funciones corporales" }).click();

    // Atajo «Dolor» → dolor en la espalda, calificado en la misma hoja.
    await sheet.getByRole("button", { name: "Dolor", exact: true }).click();
    await expect(sheet.getByRole("navigation", { name: "Dónde estás" })).toContainText("Dolor");
    await sheet.getByRole("button", { name: /^b28013 Dolor en la espalda/ }).click();
    await expect(sheet.getByRole("button", { name: /^b28013 Dolor en la espalda/ })).toHaveAttribute("aria-pressed", "true");
    const painQ = sheet.getByRole("group", { name: "Calificador (b28013)" });
    await painQ.getByText("Moderada").click();
    await expect(painQ.getByRole("radio", { name: "2 Moderada" })).toBeChecked();

    // Acotar: movilidad → b710 → de varias articulaciones.
    await sheet.getByRole("navigation", { name: "Dónde estás" }).getByRole("button", { name: "Atrás" }).click();
    await sheet.getByRole("button", { name: "Movilidad y estabilidad articular" }).click();
    await sheet.getByRole("button", { name: "Acotar b710: 5 más concretas" }).click();
    await expect(sheet.getByRole("navigation", { name: "Dónde estás" })).toContainText("b710");
    await sheet.getByRole("button", { name: /^b7101 Movilidad de varias articulaciones/ }).click();

    // Buscar: «andar» no es una función; está en actividades y participación.
    await sheet.getByLabel("Buscar en funciones corporales").fill("andar");
    await sheet.getByRole("button", { name: /^Actividades y participación \(\d+\)/ }).click();
    await expect(sheet.getByRole("radio", { name: "Actividades y participación" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: /^d450 Andar/ }).click();
    await sheet.getByRole("group", { name: "Desempeño/realización (d450)" }).getByText("Moderada").click();
    await sheet.getByRole("button", { name: "Valorar también la capacidad de d450" }).click();
    await sheet.getByRole("group", { name: "Capacidad (d450)" }).getByText("Ligera").click();
    await expect(sheet.getByRole("group", { name: "Capacidad (d450)" }).getByRole("radio", { name: "1 Ligera" })).toBeChecked();
    await sheet.getByText("Cómo queda redactado").click();
    await expect(sheet.getByText(/dificultad moderada para andar en su entorno habitual, ligera en capacidad \(d450\.21\)/)).toBeVisible();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Listo" }).click();

    const chosen = page.getByRole("region", { name: "Códigos de la CIF elegidos" });
    await expect(chosen.getByRole("list", { name: "Funciones corporales" })).toContainText("b28013 Dolor en la espalda");
    await expect(chosen.getByRole("list", { name: "Funciones corporales" })).toContainText("b7101 Movilidad de varias articulaciones");
    await expect(chosen.getByRole("list", { name: "Actividades y participación" })).toContainText("d450 Andar");
    await page.getByRole("button", { name: "Redactar el diagnóstico con la CIF" }).click();
    const diagnosis = page.getByLabel("Diagnóstico fisioterapéutico (criterio del profesional)");
    await expect(diagnosis).toHaveValue(/Funciones corporales: deficiencia moderada en dolor en la espalda \(b28013\.2\)/);
    await expect(diagnosis).toHaveValue(/Actividades y participación: dificultad moderada para andar en su entorno habitual, ligera en capacidad \(d450\.21\)/);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Andar (d450.21): desempeño/realización: dificultad moderada; capacidad: dificultad ligera").first()).toBeVisible();

    await page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name: "Resumen" }).click();
    await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("Funcionamiento (CIF)");
    await expect(letter).toContainText("deficiencia moderada en dolor en la espalda (b28013.2)");
    // El motivo lo cuenta con la CIF.
    await expect(letter).toContainText(
      "Según la CIF, presenta deficiencia moderada en dolor en la espalda (b28013.2) y dificultad moderada para andar en su entorno habitual, ligera en capacidad (d450.21)",
    );
  });

  test("US6 CIF: borrador rápido con los datos de la ficha y calificadores propuestos", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Lola Lumbar");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByRole("heading", { name: "Lola Lumbar" })).toBeVisible();
    await page.goto(`${page.url()}/anamnesis`);
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Lumbar", { exact: true }).click();
    await page.getByRole("group", { name: "Lado", exact: true }).getByText("Izquierdo", { exact: true }).click();
    await page.locator("fieldset", { hasText: "Intensidad (EVA 0-10)" }).getByText("6", { exact: true }).click();
    await page.getByRole("button", { name: "Borrador rápido con los datos de la ficha" }).click();
    const chosen = page.getByRole("region", { name: "Códigos de la CIF elegidos" });
    await expect(chosen).toContainText("b28013 Dolor en la espalda");
    await expect(chosen).toContainText("s76002 Columna vertebral lumbar");
    // La estructura, con el lado de la anamnesis.
    await expect(chosen.getByLabel("Localización (s76002)")).toHaveValue("2");
    const painQ = chosen.getByRole("group", { name: "Calificador (b28013)" });
    await expect(painQ.getByRole("radio", { name: "3 Grave" })).toBeChecked();
    await expect(chosen).toContainText("Coincide con lo propuesto: Deficiencia GRAVE · EVA de la anamnesis: dolor 6/10 = 60 %");
    // Si se cambia, se puede volver a lo propuesto en un toque.
    await painQ.getByText("Ligera").click();
    await chosen.getByRole("button", { name: "Usar el propuesto para b28013" }).click();
    await expect(painQ.getByRole("radio", { name: "3 Grave" })).toBeChecked();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Redactar el diagnóstico con la CIF" }).click();
    await expect(page.getByLabel("Diagnóstico fisioterapéutico (criterio del profesional)")).toHaveValue(
      /deficiencia grave en dolor en la espalda \(b28013\.3\), según EVA 6\/10 en la anamnesis[\s\S]*deficiencia de gravedad sin especificar en columna vertebral lumbar: izquierda \(s76002\.882\)/,
    );
  });
});
