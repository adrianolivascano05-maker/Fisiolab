import { readFileSync } from "node:fs";
import { add, createPatient, expect, expectAccessible, loadSeed, test } from "./fixtures";
import type { Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });

test.describe("F16 Ficha clínica", () => {
  test("F16-H1 anamnesis: se rellena, se guarda y resume la ficha", async ({ page }) => {
    await createPatient(page, { name: "Lucía Anamnesis" });
    await tab(page, "Anamnesis").click();
    await expect(page.getByRole("heading", { name: "Anamnesis", exact: true })).toBeVisible();
    await expect(page.getByText("1. Datos personales")).toBeVisible();
    await expect(page.getByText("9. Observaciones")).toBeVisible();
    await page.getByLabel("Motivo principal").fill("Dolor de rodilla al bajar escaleras");
    await page.getByText("Rodilla", { exact: true }).click();
    await page.getByText("Derecho", { exact: true }).click();
    await page.locator("fieldset", { hasText: "Intensidad (EVA 0-10)" }).getByText("6", { exact: true }).click();
    await page.getByText("Fiebre o malestar general").click();
    await page.getByLabel("Diagnóstico fisioterapéutico (criterio del profesional)").fill("Tendinopatía rotuliana");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();

    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(page.getByText("Banderas rojas: 1")).toBeVisible();
    await expect(page.getByText("6/10")).toBeVisible();
    await expectAccessible(page);

    await tab(page, "Resumen").click();
    await expect(page.getByRole("button", { name: "Motivo: Dolor de rodilla al bajar escaleras" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Dolor de rodilla al bajar escaleras", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Diagnóstico fisioterápico: Tendinopatía rotuliana")).toBeVisible();
    await expect(page.getByText("Banderas rojas: 1")).toBeVisible();
    // El dolor de la anamnesis ya dibuja la gráfica.
    await expect(page.getByRole("img", { name: /Dolor de 0 a 10/ })).toBeVisible();

    // Editar conserva lo escrito.
    await tab(page, "Anamnesis").click();
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Motivo principal")).toHaveValue("Dolor de rodilla al bajar escaleras");
    await page.getByLabel("Alergias").fill("Ninguna");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByText("Ninguna")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main").getByText("Dolor de rodilla al bajar escaleras", { exact: true }).last()).toBeVisible();
  });

  test("F16-H2 exploración: registrar un test, ver su evidencia, editarlo y borrarlo", async ({ page }) => {
    await createPatient(page, { name: "Pablo Exploración" });
    await add(page, "Exploración").click();
    await page.getByRole("searchbox", { name: "Buscar test" }).fill("lachman");
    await page.getByRole("button", { name: /Test de Lachman/ }).first().click();
    await page.getByRole("button", { name: "Guardar resultado" }).click();
    await expect(page.getByText("Marca si ha sido positivo, negativo o dudoso.")).toBeVisible();
    await page.getByText("Positivo", { exact: true }).click();
    await expect(page.getByText(/LR\+ .* · /).first()).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar resultado" }).click();

    await expect(page.getByRole("heading", { name: "Exploración", exact: true })).toBeVisible();
    const row = page.getByRole("link", { name: /Test de Lachman.*Positivo/ });
    await expect(row).toBeVisible();
    await expectAccessible(page);

    await tab(page, "Resumen").click();
    await expect(page.getByRole("list", { name: "Tests de exploración" })).toContainText("Test de Lachman");

    // Editar: pasa a negativo.
    await tab(page, "Exploración").click();
    await row.click();
    await page.getByText("Negativo", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("link", { name: /Test de Lachman.*Negativo/ })).toBeVisible();

    // Borrar.
    await page.getByRole("link", { name: /Test de Lachman.*Negativo/ }).click();
    await page.getByRole("button", { name: "Borrar este resultado" }).click();
    await page.getByRole("dialog", { name: "¿Borrar este resultado?" }).getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByText("Ningún test registrado")).toBeVisible();
  });

  test("F16-H3 registrar el resultado desde la galería", async ({ page }) => {
    test.slow(); // la ficha del test carga la figura en 3D: 25-30 s en las pruebas
    await createPatient(page, { name: "Marta Galería" });
    await page.goto("./exploracion/rodilla/rod-lachman");
    // Se acaba de ver su ficha: la guía ofrece apuntarlo en ella directamente.
    await page.getByRole("link", { name: "Registrar el resultado en Marta Galería" }).click();
    await expect(page.getByText("Test de Lachman", { exact: true })).toBeVisible();
    await page.getByText("Negativo", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar resultado" }).click();
    await expect(page.getByRole("link", { name: /Test de Lachman.*Negativo/ })).toBeVisible();
  });

  test("F16-H4 sesiones: dolor, tratamiento y reevaluación en la ficha", async ({ page }) => {
    await createPatient(page, { name: "Diego Sesiones" });
    await add(page, "Sesión").click();
    await page.locator("fieldset", { hasText: "Dolor hoy" }).getByText("4", { exact: true }).click();
    await page.getByLabel("Tratamiento").fill("Isométricos de cuádriceps");
    await page.getByRole("button", { name: "En 1 semana" }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar sesión" }).click();

    await expect(page.getByRole("heading", { name: "Sesiones", exact: true })).toBeVisible();
    await expect(page.getByText("Dolor 4/10")).toBeVisible();
    await expect(page.getByText("Isométricos de cuádriceps")).toBeVisible();
    await expect(page.getByText(/Próxima reevaluación/)).toBeVisible();
    await expectAccessible(page);

    await tab(page, "Resumen").click();
    await expect(page.getByRole("img", { name: /Dolor de 0 a 10/ })).toBeVisible();
    await expect(page.getByText(/Próxima reevaluación/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Historia del paciente" })).toContainText("Sesión");
    // En la lista de pacientes sale para reevaluar (la semana que viene).
    await page.goto("./");
    await expect(page.getByRole("region", { name: "Para reevaluar" })).toContainText("Diego Sesiones");
    await page.getByRole("region", { name: "Para reevaluar" }).getByRole("link", { name: /Diego Sesiones/ }).click();

    // Editar y borrar.
    await tab(page, "Sesiones").click();
    await page.getByRole("link", { name: "Editar la sesión 1" }).click();
    await page.getByRole("button", { name: "Borrar sesión" }).click();
    await page.getByRole("dialog", { name: "¿Borrar esta sesión?" }).getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByText("Sin sesiones todavía")).toBeVisible();
  });

  test("F16-H5 cuestionarios: la PSFS en la app, el KOOS por puntuación y su evolución", async ({ page }) => {
    await createPatient(page, { name: "Irene Cuestionarios" });
    await add(page, "Cuestionario").click();
    await page.getByRole("button", { name: /PSFS/ }).click();
    await page.getByLabel("Fecha y hora").fill("2026-09-01T10:00");
    await page.getByLabel("Actividad 1", { exact: true }).fill("Bajar escaleras");
    await page.getByRole("group", { name: "Cómo hace la actividad 1" }).getByText("4", { exact: true }).click();
    await page.getByRole("button", { name: "Añadir actividad" }).click();
    await page.getByLabel("Actividad 2", { exact: true }).fill("Correr");
    await page.getByRole("group", { name: "Cómo hace la actividad 2" }).getByText("2", { exact: true }).click();
    await expect(page.getByText("Media: 3,0/10")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    const list = page.getByRole("list", { name: "Cuestionarios" });
    await expect(list).toContainText("PSFS");
    await expect(list).toContainText("3/10");

    // La siguiente PSFS trae las mismas actividades y lo que puntuó la última vez.
    await page.getByRole("link", { name: "Nuevo cuestionario" }).click();
    await page.getByRole("button", { name: /PSFS/ }).click();
    await expect(page.getByLabel("Actividad 1", { exact: true })).toHaveValue("Bajar escaleras");
    await expect(page.getByText("La última vez: 4")).toBeVisible();
    await page.getByRole("group", { name: "Cómo hace la actividad 1" }).getByText("7", { exact: true }).click();
    await page.getByRole("group", { name: "Cómo hace la actividad 2" }).getByText("5", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(list).toContainText("6/10");
    await expect(list).toContainText("+3 desde el primero (mejor)");

    // KOOS: solo la puntuación, con su subescala y su rango.
    await page.getByRole("link", { name: "Nuevo cuestionario" }).click();
    await page.getByRole("button", { name: /KOOS/ }).click();
    await page.getByText("Solo anotar la nota").click();
    await page.getByLabel("Puntuación", { exact: true }).fill("62");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByText("Elige la subescala.")).toBeVisible();
    await page.getByText("Dolor", { exact: true }).click();
    await page.getByLabel("Puntuación", { exact: true }).fill("120");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByText("La puntuación va de 0 a 100.")).toBeVisible();
    await page.getByLabel("Puntuación", { exact: true }).fill("62");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(list).toContainText("KOOS (rodilla) · Dolor");
    await expect(list).toContainText("62/100");

    await tab(page, "Resumen").click();
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("KOOS");
    await expect(page.getByRole("list", { name: "Historia del paciente" })).toContainText("Cuestionario");

    // Corregir y borrar.
    await page.getByRole("list", { name: "Cuestionarios" }).getByRole("link", { name: /KOOS/ }).click();
    await expect(page.getByLabel("Puntuación", { exact: true })).toHaveValue("62");
    await page.getByRole("button", { name: "Borrar cuestionario" }).click();
    await page.getByRole("dialog", { name: "¿Borrar este cuestionario?" }).getByRole("button", { name: "Borrar" }).click();
    await expect(list).toContainText("PSFS");
    await expect(list).not.toContainText("KOOS");
  });

  test("F16-H8 cuestionarios enteros en la app: la nota se calcula sola y se guarda", async ({ page }) => {
    await createPatient(page, { name: "Tomás Rellena" });
    await add(page, "Cuestionario").click();
    await page.getByRole("button", { name: /LEFS/ }).click();
    const result = page.getByRole("heading", { name: "Resultado" }).locator("..");
    await expect(result).toContainText("Faltan 20");
    const questions = page.getByRole("group").filter({ has: page.getByText("Ninguna dificultad") });
    await expect(questions).toHaveCount(20);
    for (let i = 0; i < 20; i++) await questions.nth(i).getByText(i < 2 ? "Dificultad moderada" : "Ninguna dificultad").click();
    // 18 × 4 + 2 × 2 = 76
    await expect(result).toContainText("76/80");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    const list = page.getByRole("list", { name: "Cuestionarios" });
    await expect(list).toContainText("LEFS");
    await expect(list).toContainText("76/80");

    // KOOS: una nota por subescala; con solo el dolor contestado, solo se guarda el dolor.
    await page.getByRole("link", { name: "Nuevo cuestionario" }).click();
    await page.getByRole("button", { name: /KOOS/ }).click();
    const section = (name: string) => page.getByRole("region", { name }).getByRole("group");
    const firstOfEach = async (name: string) => {
      const qs = section(name);
      await qs.first().waitFor();
      for (let i = 0; i < (await qs.count()); i++) await qs.nth(i).locator("label").first().click();
    };
    await firstOfEach("Dolor");
    await expect(result).toContainText("Dolor");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(list).toContainText("KOOS (rodilla) · Dolor");
    await expect(list).not.toContainText("Calidad de vida");
    // Al editarlo vuelven las respuestas; contestando la calidad de vida se añade su nota.
    await list.getByRole("link", { name: /KOOS/ }).click();
    await expect(result).toContainText("100/100");
    await firstOfEach("Calidad de vida");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(list).toContainText("KOOS (rodilla) · Dolor");
    await expect(list).toContainText("KOOS (rodilla) · Calidad de vida");

    // Oswestry: cada apartado con sus seis frases; la nota en %.
    await page.getByRole("link", { name: "Nuevo cuestionario" }).click();
    await page.getByRole("button", { name: /Oswestry/ }).click();
    const odi = page.getByRole("region", { name: "Apartados" }).getByRole("group");
    await expect(odi).toHaveCount(10);
    // La tercera frase vale 2 y la segunda 1.
    for (let i = 0; i < 10; i++) await odi.nth(i).locator("label").nth(i < 5 ? 2 : 1).click();
    // (5 × 2 + 5 × 1) / 50 = 30 %
    await expect(result).toContainText("30 %");
    await expect(result).toContainText("Limitación moderada");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(list).toContainText("30 %");
  });

  test("F16-H10 cuestionarios generales: agrupados por tema, ánimo y actividad física", async ({ page }) => {
    await createPatient(page, { name: "Pablo Generales" });
    await add(page, "Cuestionario").click();
    for (const topic of ["Calidad de vida", "Estado de ánimo", "Dolor, miedo y creencias", "Actividad física"])
      await expect(page.getByRole("heading", { name: topic, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Calidad de vida" })).toContainText("RAND-36");
    await expectAccessible(page);

    await page.getByRole("button", { name: /GAD-7/ }).click();
    const result = page.getByRole("heading", { name: "Resultado" }).locator("..");
    const qs = page.getByRole("group").filter({ hasText: "Casi todos los días" });
    await expect(qs).toHaveCount(7);
    for (let i = 0; i < 7; i++) await qs.nth(i).getByText(i === 0 ? "Casi todos los días" : "Nunca", { exact: true }).click();
    await expect(result).toContainText("3/21");
    await expect(result).toContainText("mínima");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    const list = page.getByRole("list", { name: "Cuestionarios" });
    await expect(list).toContainText("GAD-7");

    // IPAQ: días con botones y minutos escritos; la nota en MET-min por semana y su nivel.
    await page.getByRole("link", { name: "Nuevo cuestionario" }).click();
    await page.getByRole("button", { name: /IPAQ/ }).click();
    await page.getByRole("region", { name: "Actividad intensa" }).getByRole("group").getByText("0", { exact: true }).click();
    await page.getByRole("region", { name: "Actividad moderada" }).getByRole("group").getByText("0", { exact: true }).click();
    const walk = page.getByRole("region", { name: "Caminar" });
    await walk.getByRole("group").getByText("5", { exact: true }).click();
    await walk.getByRole("textbox").fill("30");
    // 3,3 × 30 min × 5 días = 495
    await expect(result).toContainText("495 MET-min/sem");
    await expect(result).toContainText("Moderado");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(list).toContainText("495 MET-min/sem");
  });

  test("F16-H9 motivos de consulta: cada uno con su anamnesis y sus registros, y un filtro en la ficha", async ({ page }) => {
    await createPatient(page, { name: "Elena Motivos" });
    await tab(page, "Anamnesis").click();
    await page.getByLabel("Motivo principal").fill("Esguince de tobillo");
    // Los datos personales van plegados al empezar.
    await page.getByText("1. Datos personales").click();
    await page.getByLabel("Profesión").fill("Enfermera");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByRole("button", { name: /Motivo: Esguince de tobillo/ })).toBeVisible();
    await tab(page, "Resumen").click();
    await add(page, "Sesión").click();
    await page.getByLabel("Tratamiento").fill("Propiocepción");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Propiocepción")).toBeVisible();

    // Vuelve meses después por otra cosa: motivo nuevo, con su anamnesis (se copian los datos personales).
    await page.getByRole("button", { name: /Motivo:/ }).click();
    const sheet = page.getByRole("dialog", { name: "Motivo de consulta" });
    await expect(sheet).toContainText("1 registro");
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Nuevo motivo de consulta" }).click();
    const form = page.getByRole("dialog", { name: "Nuevo motivo de consulta" });
    await form.getByLabel("¿Por qué viene ahora?").fill("Dolor lumbar");
    await form.getByRole("button", { name: "Crear y rellenar su anamnesis" }).click();
    await expect(page.getByLabel("Motivo principal")).toHaveValue("Dolor lumbar");
    await expect(page.getByLabel("Profesión")).toHaveValue("Enfermera");
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Lumbar", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByRole("button", { name: /Motivo: Dolor lumbar/ })).toBeVisible();

    // Las sesiones del motivo nuevo empiezan vacías; lo que se añade va a este motivo.
    await tab(page, "Sesiones").click();
    await expect(page.getByText("Propiocepción")).toHaveCount(0);
    await tab(page, "Resumen").click();
    await add(page, "Sesión").click();
    await page.getByLabel("Tratamiento").fill("Control motor");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Control motor")).toBeVisible();
    await expect(page.getByText("Propiocepción")).toHaveCount(0);

    // Al primer motivo: su anamnesis y su sesión.
    await page.getByRole("button", { name: /Motivo:/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: /Esguince de tobillo/ }).click();
    await expect(page.getByText("Propiocepción")).toBeVisible();
    await expect(page.getByText("Control motor")).toHaveCount(0);
    await tab(page, "Anamnesis").click();
    await expect(page.getByText("Esguince de tobillo").first()).toBeVisible();

    // Todos juntos.
    await page.getByRole("button", { name: /Motivo:/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: /Todos los motivos/ }).click();
    await tab(page, "Sesiones").click();
    await expect(page.getByText("Propiocepción")).toBeVisible();
    await expect(page.getByText("Control motor")).toBeVisible();

    // Borrar el segundo motivo se lleva lo suyo.
    await page.getByRole("button", { name: /Motivo:/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: /Dolor lumbar/ }).click();
    await page.getByRole("button", { name: /Motivo: Dolor lumbar/ }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: "Borrar este motivo" }).click();
    await page.getByRole("dialog", { name: "Motivo de consulta" }).getByRole("button", { name: "Borrar el motivo" }).click();
    await expect(page.getByRole("button", { name: /Motivo: Esguince de tobillo/ })).toBeVisible();
    await expect(page.getByText("Propiocepción")).toBeVisible();
    await expect(page.getByText("Control motor")).toHaveCount(0);
  });

  test("F16-H6 simetría entre lados e informe imprimible con los datos de ejemplo", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./");
    await page.getByRole("link", { name: /Marcos Vidal/ }).click();
    await tab(page, "Mediciones").click();
    const sym = page.getByRole("list", { name: "Simetría entre lados" });
    await expect(sym).toContainText("CMJ a una pierna");
    await expect(sym).toContainText("bajo el 90 %");
    await expectAccessible(page);

    await tab(page, "Resumen").click();
    await page.getByRole("link", { name: /^Informe/ }).click();
    const report = page.getByRole("article", { name: "Informe" });
    await expect(report).toContainText("Informe de fisioterapia");
    await expect(report).toContainText("Marcos Vidal");
    await expect(report).toContainText("Simetría entre lados");
    await expectAccessible(page);
    // Lo que no se marca no sale.
    await page.getByRole("checkbox", { name: "Mediciones" }).uncheck();
    await expect(report).not.toContainText("Simetría entre lados");
    await expect(page.getByRole("button", { name: "Imprimir o guardar en PDF" })).toBeVisible();
  });

  test("F16-H7 siguiente cita: se guarda con la sesión y se pasa al calendario", async ({ page }) => {
    await createPatient(page, { name: "Nora Calendario" });
    await add(page, "Sesión").click();
    await page.getByLabel("Tratamiento").fill("Ejercicio de carga");
    await page.getByRole("button", { name: "Dentro de 1 semana" }).click();
    await page.getByText("60 min", { exact: true }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Guardar sesión" }).click();

    // Al guardar se ofrece: Google Calendar con el evento escrito o el archivo .ics.
    const sheet = page.getByRole("dialog", { name: "¿Añadir la cita a tu calendario?" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("60 min");
    await expect(sheet.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
      "href",
      /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=Fisioterapia\+%C2%B7\+Nora\+Calendario&dates=\d{8}T\d{6}Z%2F\d{8}T\d{6}Z&/,
    );
    await expectAccessible(page);
    // El enlace se abre de verdad en otra pestaña (sin salir a internet: la respuesta es local).
    await page.context().route("https://calendar.google.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>Google Calendar</title>" }));
    const [google] = await Promise.all([page.waitForEvent("popup"), sheet.getByRole("link", { name: "Google Calendar" }).click()]);
    await google.waitForURL(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
    await google.close();
    await expect(sheet).toBeHidden();
    // Y el .ics, desde el botón de la próxima cita.
    await page.getByRole("button", { name: "Añadir al calendario" }).click();
    const again = page.getByRole("dialog", { name: "Añadir al calendario" });
    const [dl] = await Promise.all([page.waitForEvent("download"), again.getByRole("button", { name: /\.ics/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^cita-fisioterapia-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = readFileSync((await dl.path())!, "utf8");
    expect(ics).toContain("SUMMARY:Fisioterapia · Nora Calendario");
    const at = (k: string) => {
      const [, y, mo, d, h, mi] = ics.match(new RegExp(`${k}:(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})00Z`))!.map(Number);
      return Date.UTC(y!, mo! - 1, d!, h!, mi!);
    };
    expect(at("DTEND") - at("DTSTART")).toBe(60 * 60_000);
    // Dentro de una semana, al cuarto de hora.
    expect(new Date(at("DTSTART")).getUTCMinutes() % 15).toBe(0);
    expect(at("DTSTART") - Date.now()).toBeGreaterThan(6.9 * 24 * 3600_000);
    await expect(again).toBeHidden();
    await expect(page.getByText("Próxima cita:")).toBeVisible();
    await expect(page.getByText(/Siguiente cita: .* · 60 min/)).toBeVisible();

    // En el resumen, la próxima cita con su botón.
    await tab(page, "Resumen").click();
    await expect(page.getByText("Próxima cita:")).toBeVisible();
    await page.getByRole("button", { name: "Añadir al calendario" }).click();
    await expect(page.getByRole("dialog", { name: "Añadir al calendario" }).getByRole("link", { name: "Google Calendar" })).toBeVisible();
  });
});
