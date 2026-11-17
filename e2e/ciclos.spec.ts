// Organizar el tratamiento por ciclos (docs/ciclos.md, fase A): crear el plan, poner los ejercicios de la semana 1,
// rellenar la progresión y, en una sesión, «Todo hecho como estaba», que escribe solo el texto de Tratamiento.
import { allowContact, expect, expectAccessible, smallTargets, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

test("CI1 crear un plan por ciclos con ejercicios, rellenar la progresión y apuntar una sesión con «Todo hecho como estaba»", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Lucía Ciclos");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Lucía Ciclos" })).toBeVisible();
  const record = page.url();

  // Sin plan, la sesión solo enseña el botón discreto bajo Tratamiento.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByRole("region", { name: "Tratamiento · hoy toca" })).toHaveCount(0);
  await page.getByRole("link", { name: /Organizar por ciclos/ }).click();

  // Crear: el macrociclo, cuatro fases y las semanas.
  await expect(page.getByRole("heading", { name: "Organizar por ciclos" })).toBeVisible();
  await page.getByLabel("Objetivo general").fill("Volver a jugar al fútbol sin dolor");
  await expect(page.getByText(/^20 semanas · del /)).toBeVisible();
  const fases = page.getByRole("list", { name: "Fases" });
  await expect(fases.getByRole("listitem")).toHaveCount(4);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  // Abajo del todo: la barra fija de «Siguiente» no tapa ninguna fila al revisar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Siguiente: ejercicios de la semana 1" }).click();

  // La semana 1: dos ejercicios escritos a mano, con sus casillas.
  await expect(page.getByRole("heading", { name: "Semana 1 · Adaptación" })).toBeVisible();
  await page.getByLabel("Objetivo de la fase").fill("Bajar la inflamación");
  const add = async (name: string, values: string[]) => {
    await page.getByLabel("Añadir un ejercicio").fill(name);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const card = page.getByRole("list", { name: /^Ejercicios de la sesión A/ }).getByRole("listitem").filter({ has: page.locator(`input[value="${name}"]`) });
    const inputs = card.locator('input[inputmode="decimal"]');
    for (const [i, v] of values.entries()) await inputs.nth(i).fill(v);
  };
  await add("Sentadilla a cajón", ["3", "10", "", "5"]);
  await add("Prensa bilateral", ["3", "10", "40", "6"]);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Siguiente: cómo progresa" }).click();

  // Cómo progresa: +1 rep para la sentadilla, +5 kg para la prensa; la vista previa y rellenar.
  await expect(page.getByRole("heading", { name: "Cómo progresa" })).toBeVisible();
  await page.getByLabel("Cómo progresa Sentadilla a cajón").selectOption("rep1");
  await page.getByLabel("Cómo progresa Prensa bilateral").selectOption("kg5");
  const preview = page.getByRole("table", { name: /^Vista previa/ });
  await expect(preview.getByRole("row", { name: /Prensa bilateral/ })).toContainText("45 kg");
  // La semana 4 es de descarga: una serie menos y un 40 % menos de carga.
  await expect(preview.getByRole("row", { name: /Prensa bilateral/ })).toContainText("2×1030 kg");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Rellenar las 4 semanas" }).click();

  // El plan: el objetivo y la fase de hoy con su tabla.
  await expect(page.getByRole("heading", { name: "Plan por ciclos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Volver a jugar al fútbol sin dolor" })).toBeVisible();
  await expect(page.getByRole("table", { name: /^1 · Adaptación/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // La sesión de hoy: la línea del plan y lo que toca; «Todo hecho como estaba» escribe Tratamiento.
  await page.goto(`${record}/sesiones/nueva`);
  await expect(page.getByRole("link", { name: /Fase 1 · Adaptación · semana 1 de 4/ })).toBeVisible();
  const today = page.getByRole("region", { name: "Tratamiento · hoy toca" });
  await expect(today).toBeVisible();
  await today.getByRole("button", { name: "Todo hecho como estaba" }).click();
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Sentadilla a cajón 3 × 10 (RPE 5). Prensa bilateral 3 × 10 con 40 kg (RPE 6).");
  // Lo real distinto de lo previsto: el esfuerzo notado.
  await today.getByRole("button", { name: /^Prensa bilateral/ }).click();
  await today.getByRole("group", { name: "Esfuerzo de Prensa bilateral" }).getByRole("button", { name: "8" }).click();
  await expect(page.getByLabel("Tratamiento", { exact: true })).toHaveValue("Sentadilla a cajón 3 × 10 (RPE 5). Prensa bilateral 3 × 10 con 40 kg (RPE 8).");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" }).first()).toContainText("Prensa bilateral 3 × 10 con 40 kg (RPE 8).");
  // En Sesiones, la tarjeta del plan lleva a él.
  await expect(page.getByRole("link", { name: /Plan por ciclos: Volver a jugar/ })).toBeVisible();
});

test("CI2 enviar la semana al paciente: qué se enseña, el enlace por WhatsApp, lo que ve en su móvil y anularlo", async ({ page, context, browser }) => {
  test.slow();
  await page.setViewportSize({ width: 360, height: 780 });
  const google = new FakeGoogle({ ana: { sub: "3101", email: "ana@ciclos.test", name: "Ana Ciclos" } });
  await google.install(context, () => "ana", { server: true });
  await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp</title>" }));
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  await expect(page.getByLabel("Por mi cuenta")).toBeChecked({ timeout: 15_000 });
  await page.getByLabel("Nombre de tu consulta (o el tuyo)").fill("Consulta Ana");
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu PIN" })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.type("2580");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.keyboard.type("2580");
  await page.getByRole("button", { name: "Guardar el PIN" }).click();
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });

  // Paciente con móvil, permiso de contacto y una cita dentro de unos días.
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Lucía Semana");
  await page.getByLabel("Teléfono").fill("612 345 678");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Lucía Semana" })).toBeVisible();
  const record = page.url();
  const d = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" })}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  await page.getByRole("button", { name: "Dar cita" }).click();
  const sheet = page.getByRole("dialog", { name: "Dar cita a Lucía Semana" });
  await sheet.getByLabel("Día y hora").fill(`${d.toISOString().slice(0, 10)}T10:00`);
  await sheet.getByRole("button", { name: "Dar la cita" }).click();
  await expect(page.getByRole("button", { name: /Próxima cita/ })).toBeVisible();
  await allowContact(page, "Lucía Semana");

  // El plan, que empieza esta semana, con un ejercicio y «Cómo se hace».
  await page.goto(`${record}/ciclos/nuevo`);
  await page.getByLabel("Objetivo general").fill("Volver a correr");
  await page.getByRole("button", { name: "Siguiente: ejercicios de la semana 1" }).click();
  await page.getByLabel("Añadir un ejercicio").fill("Puente de glúteo");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const inputs = page.getByRole("list", { name: /^Ejercicios de la sesión A/ }).locator('input[inputmode="decimal"]');
  for (const [i, v] of ["3", "12", "10", "6"].entries()) await inputs.nth(i).fill(v);
  await page.getByRole("button", { name: "Cómo se hace Puente de glúteo" }).click();
  await page.getByLabel("Cómo se hace Puente de glúteo").fill("Aprieta arriba dos segundos.");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await page.getByRole("button", { name: "Guardar y ver el plan" }).click();

  // Enviar: sin marcar nada, sin kilos ni RPE; con las fases, «estás aquí».
  await page.getByRole("link", { name: "Enviar la semana al paciente" }).click();
  await expect(page.getByRole("heading", { name: "Enviar la semana" })).toBeVisible();
  const preview = page.getByRole("region", { name: "Así lo verá" });
  await expect(preview).toContainText("Puente de glúteo");
  await expect(preview).toContainText("3 × 12");
  await expect(preview).not.toContainText("kg");
  await expect(preview).not.toContainText("RPE");
  await expect(preview).toContainText("Cómo se hace: Aprieta arriba dos segundos.");
  await page.getByLabel("Con las fases («estás aquí») y el objetivo general").check();
  await expect(preview).toContainText("Volver a correr");
  await expect(preview.getByRole("listitem").filter({ hasText: "Estás aquí" })).toContainText("Adaptación");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Crear el enlace" }).click();
  const message = page.getByLabel("Mensaje");
  await expect(message).toContainText("Hola, Lucía. Aquí tienes tus ejercicios de la semana de Consulta Ana", { timeout: 15_000 });
  await expect(message).toContainText("/formulario/");
  expect(google.forms.size).toBe(1);
  const url = (await message.textContent())!.match(/https?:\/\/\S+/)![0]!;
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "WhatsApp" }).click()]);
  expect(decodeURIComponent(popup.url())).toContain("/formulario/");
  await popup.close();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);

  // En su móvil, sin cuenta: sus ejercicios, «Cómo se hace», sus fases y su cita; nada que enviar.
  const { baseURL, viewport, locale, timezoneId, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ baseURL, viewport: viewport ?? { width: 360, height: 780 }, locale, timezoneId, isMobile, hasTouch, serviceWorkers: "block" });
  await google.install(ctx, () => "ana", { server: true });
  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 360, height: 780 });
  await phone.goto(url);
  await expect(phone.getByRole("heading", { name: "Hola, Lucía" })).toBeVisible({ timeout: 15_000 });
  await expect(phone.getByText("Puente de glúteo")).toBeVisible();
  await expect(phone.getByText("3 × 12", { exact: true })).toBeVisible();
  await expect(phone.getByText("Aprieta arriba dos segundos.")).toBeVisible();
  await expect(phone.getByRole("listitem").filter({ hasText: "Estás aquí" })).toContainText("Adaptación");
  await expect(phone.getByRole("heading", { name: "Tus próximas citas" })).toBeVisible();
  await expect(phone.getByRole("button", { name: /Enviar/ })).toHaveCount(0);
  await expect(phone.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(phone)).toEqual([]);
  await expectAccessible(phone);

  // Anularlo: el enlace deja de abrirse.
  await page.getByRole("button", { name: "Mandar otra semana" }).click();
  await page.getByRole("button", { name: /^Anular el enlace de la semana 1/ }).click();
  await page.getByRole("button", { name: "Sí, anularlo" }).click();
  await expect(page.getByText("Anulado", { exact: true })).toBeVisible();
  expect(google.forms.size).toBe(0);
  await phone.reload();
  await expect(phone.getByText(/Este enlace ya no vale/)).toBeVisible({ timeout: 15_000 });
  await ctx.close();

  // Los colores de las fases: los filtros del plan y la franja bajo cada día del calendario.
  await page.goto(`${record}/ciclos`);
  await expect(page.getByRole("group", { name: "Ir a una fase" }).getByRole("button", { name: /^1 · Adaptación/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("group", { name: "Ir a una fase" }).getByRole("button", { name: /^2 · Desarrollo/ }).click();
  await expect(page.getByRole("button", { name: /Desarrollo/, expanded: true })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await page.goto(`${record}/calendario`);
  await expect(page.getByRole("button", { name: /fase 1 \(Adaptación\)/ }).first()).toBeVisible();
  const legend = page.getByRole("link", { name: "1 · Adaptación", exact: true });
  await expect(legend).toBeVisible();
  await page.getByRole("button", { name: /, hoy, fase 1 \(Adaptación\)/ }).click();
  await expect(page.getByRole("link", { name: /^Fase 1 · Adaptación · semana 1 de 4/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
  expect(await smallTargets(page)).toEqual([]);
  await expectAccessible(page);
  await legend.click();
  await expect(page.getByRole("heading", { name: "Plan por ciclos" })).toBeVisible();
});

test("CI3 semana de valoración, evolución por ejercicio y plantillas de la clínica (guardar, usar, renombrar, duplicar y archivar)", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 360, height: 780 });
  const check = async () => {
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 360);
    expect(await smallTargets(page)).toEqual([]);
    await expectAccessible(page);
  };
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Marta Plantilla");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Marta Plantilla" })).toBeVisible();
  const record = page.url();

  // El plan con un ejercicio y la semana 1 de valoración.
  await page.goto(`${record}/ciclos/nuevo`);
  await page.getByLabel("Objetivo general").fill("Subir escaleras sin dolor");
  await page.getByRole("button", { name: "Siguiente: ejercicios de la semana 1" }).click();
  await page.getByLabel("Semana de valoración").check();
  await page.getByLabel("Añadir un ejercicio").fill("Prensa bilateral");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const inputs = page.getByRole("list", { name: /^Ejercicios de la sesión A/ }).locator('input[inputmode="decimal"]');
  for (const [i, v] of ["3", "10", "40", "6"].entries()) await inputs.nth(i).fill(v);
  await page.getByRole("button", { name: "Guardar y ver el plan" }).click();
  await expect(page.getByRole("table", { name: /^1 · Adaptación/ }).getByRole("columnheader", { name: /valoración/ })).toBeVisible();

  // En la sesión: la etiqueta y los accesos a valorar; «Todo hecho» y guardar.
  await page.goto(`${record}/sesiones/nueva`);
  const assess = page.getByRole("navigation", { name: "Semana de valoración" });
  await expect(assess.getByRole("link", { name: "Nueva medición" })).toBeVisible();
  await expect(assess.getByRole("link", { name: "Pasar un cuestionario" })).toBeVisible();
  await page.getByRole("region", { name: "Tratamiento · hoy toca" }).getByRole("button", { name: "Todo hecho como estaba" }).click();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Sesión 1" }).first()).toContainText("Prensa bilateral 3 × 10 con 40 kg");

  // Evolución: previsto y hecho de la semana 1.
  await page.goto(`${record}/ciclos`);
  await page.getByRole("link", { name: "Evolución por ejercicio" }).click();
  await expect(page.getByRole("heading", { name: "Evolución por ejercicio" })).toBeVisible();
  await expect(page.getByLabel("Ejercicio")).toHaveValue("Prensa bilateral");
  await expect(page.getByRole("img", { name: /^Kilos \(kg\)/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Esfuerzo \(RPE\)/ })).toBeVisible();
  const row = page.getByRole("table", { name: "Prensa bilateral, semana a semana" }).getByRole("row").nth(1);
  await expect(row).toContainText("40");
  await expect(row.getByRole("cell").nth(1)).toHaveText("40");
  await check();

  // Guardar como plantilla.
  await page.goto(`${record}/ciclos`);
  await page.getByRole("button", { name: "Guardar como plantilla" }).click();
  await page.getByLabel("Nombre de la plantilla").fill("Rodilla 20 semanas");
  await page.getByRole("button", { name: "Guardar la plantilla" }).click();
  await expect(page.getByText("Plantilla guardada: sale al organizar otro plan")).toBeVisible();

  // Otro paciente: la plantilla de la clínica trae las fases y el ejercicio.
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Pablo Plantilla");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Pablo Plantilla" })).toBeVisible();
  const second = page.url();
  await page.goto(`${second}/ciclos/nuevo`);
  const clinic = page.getByRole("group", { name: "Plantillas de la clínica" });
  await clinic.getByRole("button", { name: /Rodilla 20 semanas/ }).click();
  await expect(page.getByText(/Con los ejercicios de la plantilla/)).toBeVisible();
  // Abajo del todo: la barra fija de «Siguiente» no tapa ninguna fila al revisar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await check();
  await page.getByRole("button", { name: "Crear y ver el plan" }).click();
  const table = page.getByRole("table", { name: /^1 · Adaptación/ });
  await expect(table.getByRole("row", { name: /Prensa bilateral/ })).toContainText("40 kg");
  await expect(table.getByRole("columnheader", { name: /valoración/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin objetivo escrito" })).toBeVisible();

  // Ajustes: renombrar, duplicar y archivar.
  await page.goto("./ajustes");
  await page.getByRole("link", { name: /Plantillas de plan por ciclos/ }).click();
  await expect(page.getByRole("heading", { name: "Plantillas de plan por ciclos" })).toBeVisible();
  await page.getByRole("button", { name: "Renombrar «Rodilla 20 semanas»" }).click();
  await page.getByRole("dialog").getByLabel("Nombre de la plantilla").fill("Rodilla");
  await page.getByRole("button", { name: "Guardar el nombre" }).click();
  await page.getByRole("button", { name: "Duplicar «Rodilla»" }).click();
  await expect(page.getByRole("list", { name: "Plantillas" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Archivar «Rodilla (copia)»" }).click();
  await expect(page.getByRole("list", { name: "Plantillas" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Ver las archivadas (1)" }).click();
  await expect(page.getByRole("button", { name: "Recuperar «Rodilla (copia)»" })).toBeVisible();
  await check();
  // La archivada ya no sale al organizar un plan.
  await page.goto(`${second}/ciclos/nuevo?editar=1`);
  await expect(page.getByRole("group", { name: "Plantillas de la clínica" }).getByRole("button")).toHaveCount(1);
});
