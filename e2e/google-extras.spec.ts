// Con la cuenta de Google: las citas solas en Google Calendar (src/cloud/googleCalendar.ts), con Google simulado
// (fakeGoogle.ts). La app ya no guarda archivos en el Drive de nadie: ni lo ofrece ni pide el permiso.
import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

const users = { ana: { sub: "1001", email: "ana@clinica.test", name: "Ana Ruiz" } };
test.use({ serviceWorkers: "block" });

async function login(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe("Google Calendar, y nada de archivos en Drive", () => {
  test("GC1 la siguiente cita se apunta sola en el calendario de la app, se cambia y se quita", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana");
    await login(page);
    // El permiso del calendario no se pide al entrar: se activa en Ajustes y entonces se va a Google a darlo.
    await page.goto("./ajustes/cuenta");
    await expect(page.getByText("Las citas no se apuntan solas.")).toBeVisible();
    await page.getByLabel("Apuntar solas las citas en mi Google Calendar").check();
    await expect(page.getByRole("status").filter({ hasText: /^(Las citas se apuntarán|La próxima cita|Las próximas citas)/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Apuntar solas las citas en mi Google Calendar")).toBeChecked();
    const url = await createPatient(page, { name: "Lucía Cita" });
    const pid = url.split("/").pop()!;

    await page.goto(`./pacientes/${pid}/sesiones/nueva`);
    await expect(page.getByText("Al guardar se apunta sola en tu Google Calendar.")).toBeVisible();
    await page.getByLabel("Tratamiento").fill("Terapia manual");
    await page.getByLabel("Día y hora").fill("2030-05-06T10:00");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByRole("dialog", { name: "¿Añadir la cita a tu calendario?" })).toHaveCount(0);
    // La hoja de la próxima cita dice que ya está en el calendario.
    await page.getByRole("button", { name: /^Próxima cita/ }).click();
    await expect(page.getByRole("dialog", { name: "Cita de Lucía Cita" }).getByText("Apuntada en tu Google Calendar")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect.poll(() => google.events("ana").length, { timeout: 20_000 }).toBe(1);
    expect(google.calendars).toHaveLength(1);
    expect(google.calendars[0]!.summary).toBe("OmniClin · Citas");
    const [ev] = google.events("ana");
    expect(ev!.summary).toBe("L. C.");
    expect(ev!.description ?? "").not.toMatch(/Lucía|Fisioterapia|http/);
    expect(Date.parse(ev!.start.dateTime)).toBe(Date.parse("2030-05-06T08:00:00Z")); // 10:00 en Madrid (verano)
    expect(Date.parse(ev!.end.dateTime) - Date.parse(ev!.start.dateTime)).toBe(45 * 60_000);

    // Se cambia la hora: el mismo evento, movido.
    await page.getByRole("link", { name: "Editar la sesión 1" }).click();
    await page.getByLabel("Día y hora").fill("2030-05-06T11:30");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(() => google.events("ana").map((e) => Date.parse(e.start.dateTime)), { timeout: 20_000 }).toEqual([Date.parse("2030-05-06T09:30:00Z")]);

    // Siempre solo las iniciales: ya no se puede elegir el nombre entero.
    await page.goto("./ajustes/cuenta");
    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
    await expectAccessible(page);
    await expect(page.getByLabel("En el evento sale")).toHaveCount(0);
    expect(google.events("ana")[0]?.summary).toBe("L. C.");
    await expect(page.getByText(/La próxima cita está en el calendario «OmniClin · Citas»/)).toBeVisible();

    // Paciente borrado: su cita futura se quita del calendario.
    await page.goto(`./pacientes/${pid}/editar`);
    await page.getByRole("button", { name: "Borrar paciente" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Borrar este paciente?" });
    await dialog.getByText(/Lo borro igualmente/).click();
    await dialog.getByRole("button", { name: "Borrar para siempre" }).click();
    await expect.poll(() => google.events("ana").length, { timeout: 20_000 }).toBe(0);
    expect(google.calendars).toHaveLength(1);
  });

  test("GD1 sin «Guardar en mi Drive»: ni el botón en los documentos ni el permiso de archivos de Drive", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana");
    await login(page);
    expect(google.requestedScopes.length).toBeGreaterThan(0);
    for (const scope of google.requestedScopes) expect(scope).not.toContain("drive.file");
    const url = await createPatient(page, { name: "Pablo Informe", mass: "70" });
    await page.goto(`${url}/informe`);
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
    await expect(page.getByText(/Guardar en mi Drive/)).toHaveCount(0);
    await page.goto("./ajustes/datos");
    await expect(page.getByRole("button", { name: "Exportar resultados a Excel (CSV)" })).toBeVisible();
    await expect(page.getByText(/en mi Drive/)).toHaveCount(0);
    // Quien nunca guardó nada en Drive no ve el aviso de los archivos de antes.
    await page.goto("./ajustes/cuenta");
    await expect(page.getByText("Las citas no se apuntan solas.")).toBeVisible();
    await expect(page.getByText("Archivos que guardaste antes en tu Google Drive")).toHaveCount(0);
    expect(google.visible("ana")).toHaveLength(0);
  });

  test("GD2 sin el permiso de calendario, la app lo dice y no falla", async ({ page }) => {
    const google = new FakeGoogle(users);
    google.withheld = ["calendar.app.created"];
    await google.install(page.context(), () => "ana");
    await login(page);
    await page.goto("./ajustes/cuenta");
    await page.getByLabel("Apuntar solas las citas en mi Google Calendar").check();
    await expect(page.getByText("Falta el permiso de Google Calendar.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Dar el permiso de Google Calendar" })).toBeVisible();
    await expectAccessible(page);
  });
});
