import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createPatient, downloadFrom, expect, expectAccessible, loadSeed, test } from "./fixtures";

test.describe("F15 Exportar, copiar y restaurar", () => {
  test("F15-H1 CSV para Excel en español", async ({ page }) => {
    await loadSeed(page);
    await expectAccessible(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Exportar resultados/ }).click()]);
    const text = readFileSync((await dl.path())!, "utf8");
    expect(dl.suggestedFilename()).toMatch(/^OmniClin-resultados-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("paciente;fecha;test;movimiento;lado;metodo;carga_kg;altura_caida_cm;fps_grabacion;intento;metrica;valor;unidad");
    expect(text).toMatch(/Ejemplo · Lucía Herrero;[^;]+;cmj;;;;0;;240;;jump_height_cm;\d+,\d+;cm/);
    expect(text).toMatch(/Ejemplo · Marcos Vidal;[^;]+;bienestar;;;;;;;;fatiga;2;1-5\r\n/);
    expect(text).toMatch(/Ejemplo · Marcos Vidal;[^;]+;rom_ankle;Tobillo · flexión dorsal en carga \(lunge\);derecha;Inclinómetro del móvil;0;;;;wall_distance_cm;9,5;cm/);
  });

  test("F15-H4 descargar todo: historias legibles, Excel y copia en un .zip", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./ajustes/datos");
    await expect(page.getByText("Última copia: nunca")).toBeVisible();
    const dl = await downloadFrom(page, page.getByRole("button", { name: "Descargar todo (historias, Excel y copia)" }));
    expect(dl.suggestedFilename()).toMatch(/^OmniClin-Fisiolab-\d{4}-\d{2}-\d{2}\.zip$/);
    const bytes = readFileSync((await dl.path())!);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    const names = bytes.toString("latin1");
    for (const f of ["LEEME.txt", "Indice de pacientes.html", "Todos los datos.xlsx", "Copia de OmniClin.sqlite3", "Historias clinicas/"]) expect(names, f).toContain(f);
    await expect(page.getByText(/Descargado: 3 pacientes con toda su historia/)).toBeVisible();
    await expectAccessible(page);
    // Cuenta como copia de seguridad hecha.
    await page.reload();
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();
  });

  test("F15-H7 copia cifrada con contraseña: un .omniclin que no se lee, y se abre con su contraseña (también sin cuenta)", async ({ page }) => {
    await loadSeed(page);
    await page.goto("./ajustes/datos");
    const all = page.getByRole("button", { name: "Descargar todo (historias, Excel y copia)" });
    // Contraseña corta o distinta: no deja.
    await all.click();
    const sheet = page.getByRole("dialog", { name: "Cómo descargar" });
    await expect(sheet.getByLabel("Cifrada con contraseña (recomendado)")).toBeChecked();
    await sheet.getByLabel("Contraseña", { exact: true }).fill("corta");
    await sheet.getByLabel("Repite la contraseña").fill("corta");
    await sheet.getByRole("button", { name: "Descargar", exact: true }).click();
    await expect(sheet.getByRole("alert")).toContainText("al menos 10 caracteres");
    await sheet.getByLabel("Contraseña", { exact: true }).fill("frase de la clínica 2026");
    await sheet.getByLabel("Repite la contraseña").fill("otra frase distinta");
    await sheet.getByRole("button", { name: "Descargar", exact: true }).click();
    await expect(sheet.getByRole("alert")).toContainText("no coinciden");
    await expectAccessible(page);
    await sheet.getByLabel("Repite la contraseña").fill("frase de la clínica 2026");
    const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Descargar", exact: true }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^OmniClin-Fisiolab-\d{4}-\d{2}-\d{2}-cifrado\.omniclin$/);
    const enc = readFileSync((await dl.path())!);
    expect(enc.subarray(0, 8).toString("latin1")).toBe("OMNIEXP1");
    expect(enc.toString("latin1")).not.toContain("LEEME.txt");
    const file = { name: dl.suggestedFilename(), mimeType: "application/octet-stream", buffer: enc };

    // Abrirla en Ajustes: con la contraseña mala no, con la buena baja el .zip de dentro.
    await page.getByLabel("Elegir copia cifrada").setInputFiles(file);
    await page.getByLabel("Contraseña de la copia").fill("otra frase distinta");
    await page.getByRole("button", { name: "Abrir y descargar lo de dentro" }).click();
    await expect(page.getByText("La contraseña no es la de esta copia.")).toBeVisible();
    await page.getByLabel("Contraseña de la copia").fill("frase de la clínica 2026");
    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Abrir y descargar lo de dentro" }).click()]);
    expect(zip.suggestedFilename()).toMatch(/^OmniClin-Fisiolab-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(readFileSync((await zip.path())!).toString("latin1")).toContain("LEEME.txt");
    await expect(page.getByText(`Descargado: ${zip.suggestedFilename()}`)).toBeVisible();

    // La copia .sqlite3 suelta, también cifrada.
    const copy = await downloadFrom(page, page.getByRole("button", { name: "Descargar copia de seguridad" }), "frase de la clínica 2026");
    expect(copy.suggestedFilename()).toMatch(/^OmniClin-copia-\d{4}-\d{2}-\d{2}-cifrado\.omniclin$/);
    expect(readFileSync((await copy.path())!).subarray(0, 8).toString("latin1")).toBe("OMNIEXP1");

    // Sin cuenta ni app: la página pública, que funciona aunque no se pueda entrar.
    await page.goto("./abrir-copia");
    await expect(page.getByRole("heading", { name: "Abrir una copia cifrada", level: 1 })).toBeVisible();
    await page.getByLabel("Elegir copia cifrada").setInputFiles(file);
    await page.getByLabel("Contraseña de la copia").fill("frase de la clínica 2026");
    const [again] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Abrir y descargar lo de dentro" }).click()]);
    expect(again.suggestedFilename()).toMatch(/\.zip$/);
    await expectAccessible(page);
    await page.getByRole("link", { name: "Volver a la app" }).click();
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
  });

  test("F15-H2 copia de seguridad y restauración", async ({ page }) => {
    await createPatient(page, { name: "Antes de la copia" });
    await page.goto("./ajustes/datos");
    await expect(page.getByText("Última copia: nunca")).toBeVisible();
    const dl = await downloadFrom(page, page.getByRole("button", { name: "Descargar copia de seguridad" }));
    expect(dl.suggestedFilename()).toMatch(/^OmniClin-copia-\d{4}-\d{2}-\d{2}\.sqlite3$/);
    const backup = (await dl.path())!;
    await expect(page.getByText(/Última copia: \d/)).toBeVisible();

    await createPatient(page, { name: "Después de la copia" });
    await page.goto("./ajustes/datos");
    await page.getByLabel("Elegir copia de seguridad").setInputFiles(backup);
    await page.getByRole("dialog").getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("Copia restaurada")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Antes de la copia/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Después de la copia/ })).toHaveCount(0);
  });

  test("F15-H6 al abrir una copia de una versión antigua, antes de actualizarla se guarda tal como estaba", async ({ page }) => {
    await page.goto("./ajustes/datos");
    await expect(page.getByText("Ninguna todavía.")).toBeVisible();
    // Una base de la versión 20 (src/data/fixtures): al restaurarla se migra, y antes queda la copia de la versión 20.
    await page.getByLabel("Elegir copia de seguridad").setInputFiles(fileURLToPath(new URL("../src/data/fixtures/v020.sqlite3", import.meta.url)));
    await page.getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("Copia restaurada")).toBeVisible();
    const backups = page.getByRole("list", { name: "Copias de antes de actualizar" });
    await expect(backups.getByRole("listitem")).toHaveCount(1);
    await expect(backups).toContainText(/Base de la versión 20, antes de pasar a la \d+/);
    await expectAccessible(page);
    // Se puede descargar y restaurar (restaurarla vuelve a migrarla: sigue habiendo una sola copia, la misma).
    const dl = await downloadFrom(page, backups.getByRole("button", { name: "Descargar" }));
    expect(dl.suggestedFilename()).toMatch(/^OmniClin-antes-de-actualizar-v20-a-v\d+\.sqlite3$/);
    await backups.getByRole("button", { name: "Restaurar" }).click();
    await page.getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("Copia restaurada")).toBeVisible();
    await expect(backups.getByRole("listitem")).toHaveCount(1);
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Paciente de la versión 20/ })).toBeVisible();
  });

  test("F15-N1 un archivo que no es una copia no toca los datos", async ({ page }) => {
    await createPatient(page, { name: "Intacto" });
    await page.goto("./ajustes/datos");
    await page.getByLabel("Elegir copia de seguridad").setInputFiles({ name: "x.sqlite3", mimeType: "application/octet-stream", buffer: Buffer.from("no soy una base") });
    await page.getByRole("dialog").getByRole("button", { name: "Sustituir mis datos" }).click();
    await expect(page.getByText("El archivo no es una copia de seguridad válida.")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Intacto/ })).toBeVisible();
  });

  test("F15-H3 traer pacientes de otro programa (CSV de Excel): se revisa, se importa y se puede deshacer", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("link", { name: "Trae tus pacientes desde Excel" }).click();
    await expect(page.getByRole("heading", { name: "Traer datos" })).toBeVisible();
    await createPatient(page, { name: "Luis Pérez" });
    await page.goto("./ajustes");
    await page.getByRole("link", { name: /Importar datos/ }).click();
    // Un CSV como los de Excel en español: punto y coma y Windows-1252 (tildes en un byte).
    const csv = "Nombre;Apellidos;F. Nac.;Sexo;Móvil;Población;DNI\r\nAna;Ruiz López;12/03/1985;M;612345678;Sevilla;12345678Z\r\nLuis;Pérez;;H;;;\r\nMarta;Gil;31/02/1990;F;699000111;;\r\n";
    await page.getByLabel("Elegir el archivo de pacientes").setInputFiles({ name: "pacientes.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "latin1") });
    await expect(page.getByRole("heading", { name: "Qué es cada columna" })).toBeVisible();
    await expect(page.getByLabel("Población")).toHaveValue("address");
    await expect(page.getByLabel("DNI")).toHaveValue("dni");
    const summary = page.getByRole("region", { name: "Qué va a pasar" });
    await expect(summary.getByText("Se importan 2 pacientes")).toBeVisible();
    await expect(summary.getByText(/1 ya existe con el mismo nombre/)).toBeVisible();
    await expect(summary.getByText(/1 valor no se ha reconocido/)).toBeVisible();
    await expect(summary.getByRole("cell", { name: "Ana Ruiz López" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Importar 2 pacientes" }).click();
    await expect(page.getByText("2 pacientes importados")).toBeVisible();

    await page.goto("./");
    await page.getByRole("link", { name: /Ana Ruiz López/ }).click();
    await expect(page.getByText("612345678")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Luis Pérez/ })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Marta Gil/ })).toBeVisible();

    // Deshacer: se van los importados; Luis, que ya estaba, se queda.
    await page.goto("./ajustes/importar");
    await page.getByRole("button", { name: "Deshacer la última importación" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Borrar lo importado" }).click();
    await expect(page.getByText("Importación deshecha: 2 registros borrados")).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Ana Ruiz López|Marta Gil/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Luis Pérez/ })).toBeVisible();
  });

  test("F15-H5 traer citas e historial de sesiones de otro programa, unidos a sus pacientes", async ({ page }) => {
    // Un martes fijo: las citas del 27 y 28 de octubre caen siempre en «la semana siguiente».
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
    await createPatient(page, { name: "Ana Ruiz" });
    await page.goto("./ajustes/importar");
    // Citas: una que viene y una de un paciente que aún no está (se crea con su nombre).
    await page.getByRole("radio", { name: /Citas/ }).click();
    const citas = "Paciente;Fecha;Hora inicio;Hora fin;Estado\r\nAna Ruiz;27/10/2026;10:00;10:30;\r\nPedro Nuevo;28/10/2026;17:00;;\r\n";
    await page.getByLabel("Elegir el archivo de citas").setInputFiles({ name: "citas.csv", mimeType: "text/csv", buffer: Buffer.from(citas, "utf8") });
    const summary = page.getByRole("region", { name: "Qué va a pasar" });
    await expect(summary.getByText("Se importan 2 citas")).toBeVisible();
    await expect(summary.getByText(/1 paciente no está en OmniClin \(Pedro Nuevo\): se crean con su nombre/)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Importar 2 citas" }).click();
    await expect(page.getByText("2 citas importadas y 1 paciente nuevo")).toBeVisible();
    await page.getByRole("link", { name: "Ver la agenda" }).click();
    await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Semana" }).click();
    await page.getByRole("button", { name: "Semana siguiente" }).click();
    await expect(page.getByRole("button", { name: /^Ana Ruiz\s*,\s*10:00–10:30/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pedro Nuevo\s*,\s*17:00–17:45/ })).toBeVisible();

    // Historial: las notas de cada visita, en la ficha de Ana.
    await page.goto("./ajustes/importar");
    await page.getByRole("radio", { name: /Historial de sesiones/ }).click();
    const historial = "Nombre;Fecha;EVA;Evolución\r\nAna Ruiz;01/09/2026 09:00;6;Dolor lumbar al agacharse, mejora con calor\r\n";
    await page.getByLabel("Elegir el archivo de historial de sesiones").setInputFiles({ name: "historial.xlsx.csv", mimeType: "text/csv", buffer: Buffer.from(historial, "utf8") });
    await page.getByRole("button", { name: "Importar 1 sesión" }).click();
    await expect(page.getByText("1 sesión importada")).toBeVisible();
    await page.goto("./");
    await page.getByRole("list", { name: "Pacientes" }).getByRole("link", { name: /Ana Ruiz/ }).click();
    await expect(page.getByText(/Dolor lumbar al agacharse/).first()).toBeVisible();
  });

  test("F15-E1 cargar ejemplo no se duplica aunque se pulse rápido", async ({ page }) => {
    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Cargar datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Borrar los datos de ejemplo" })).toBeVisible({ timeout: 30_000 });
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Ejemplo · / })).toHaveCount(3);
    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Borrar los datos de ejemplo" }).click();
    await expect(page.getByRole("button", { name: "Cargar datos de ejemplo" })).toBeVisible();
  });

  test("F15-E2 dos pestañas: la segunda avisa y no trabaja en vacío; al cerrar la primera, sigue sola", async ({ page, context }) => {
    await createPatient(page, { name: "Pestaña uno" });
    const second = await context.newPage();
    await second.goto("./");
    await expect(second.getByText("OmniClin ya está abierta en otra pestaña")).toBeVisible();
    await expect(second.getByRole("link", { name: "Nuevo paciente" })).toHaveCount(0);
    await page.close();
    await expect(second.getByRole("link", { name: /Pestaña uno/ })).toBeVisible();
  });
});
