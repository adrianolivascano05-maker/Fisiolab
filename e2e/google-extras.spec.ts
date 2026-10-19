// Con la cuenta de Google: las citas solas en Google Calendar y el informe y los resultados en una carpeta del
// Drive (src/cloud/googleCalendar.ts, src/cloud/saveToDrive.ts), con Google simulado (fakeGoogle.ts).
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

test.describe("Google Calendar y archivos en Drive", () => {
  test("GC1 la siguiente cita se apunta sola en el calendario de la app, se cambia y se quita", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana");
    await login(page);
    const url = await createPatient(page, { name: "Lucía Cita" });
    const pid = url.split("/").pop()!;

    await page.goto(`./pacientes/${pid}/sesiones/nueva`);
    await expect(page.getByText("Al guardar se apunta sola en tu Google Calendar.")).toBeVisible();
    await page.getByLabel("Tratamiento").fill("Terapia manual");
    await page.getByLabel("Día y hora").fill("2030-05-06T10:00");
    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await expect(page.getByText("Apuntada en tu Google Calendar.")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "¿Añadir la cita a tu calendario?" })).toHaveCount(0);

    await expect.poll(() => google.events("ana").length, { timeout: 20_000 }).toBe(1);
    expect(google.calendars).toHaveLength(1);
    expect(google.calendars[0]!.summary).toBe("Cénit · Citas");
    const [ev] = google.events("ana");
    expect(ev!.summary).toBe("Fisioterapia · Lucía Cita");
    expect(Date.parse(ev!.start.dateTime)).toBe(Date.parse("2030-05-06T08:00:00Z")); // 10:00 en Madrid (verano)
    expect(Date.parse(ev!.end.dateTime) - Date.parse(ev!.start.dateTime)).toBe(45 * 60_000);

    // Se cambia la hora: el mismo evento, movido.
    await page.getByRole("link", { name: "Editar la sesión 1" }).click();
    await page.getByLabel("Día y hora").fill("2030-05-06T11:30");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(() => google.events("ana").map((e) => Date.parse(e.start.dateTime)), { timeout: 20_000 }).toEqual([Date.parse("2030-05-06T09:30:00Z")]);

    // Solo las iniciales en el evento.
    await page.goto("./ajustes/cuenta");
    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel("En el evento sale").selectOption("initials");
    await expect.poll(() => google.events("ana")[0]?.summary, { timeout: 20_000 }).toBe("Fisioterapia · L. C.");
    await expect(page.getByText(/La próxima cita está en el calendario «Cénit · Citas»/)).toBeVisible();

    // Paciente borrado: su cita futura se quita del calendario.
    await page.goto(`./pacientes/${pid}/editar`);
    await page.getByRole("button", { name: "Borrar paciente" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Borrar este paciente?" });
    await dialog.getByText(/Lo borro igualmente/).click();
    await dialog.getByRole("button", { name: "Borrar para siempre" }).click();
    await expect.poll(() => google.events("ana").length, { timeout: 20_000 }).toBe(0);
    expect(google.calendars).toHaveLength(1);
  });

  test("GD1 el informe en PDF y los resultados en CSV, en la carpeta «Cénit · Fisiolab» de Drive", async ({ page }) => {
    test.slow();
    const google = new FakeGoogle(users);
    await google.install(page.context(), () => "ana");
    await login(page);
    const url = await createPatient(page, { name: "Pablo Informe", mass: "70" });
    await page.goto(`${url}/informe`);
    await page.getByRole("button", { name: "Guardar en mi Drive (PDF)" }).click();
    await expect(page.getByRole("status").getByText(/está en tu Drive, carpeta «Cénit · Fisiolab»/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Abrir en Drive" })).toHaveAttribute("href", /drive\.google\.com/);

    const folder = google.visible("ana").find((f) => f.mimeType === "application/vnd.google-apps.folder")!;
    expect(folder.name).toBe("Cénit · Fisiolab");
    const pdf = google.visible("ana").find((f) => f.mimeType === "application/pdf")!;
    expect(pdf.name).toMatch(/^Informe Pablo Informe \d{4}-\d{2}-\d{2}\.pdf$/);
    expect(pdf.parents).toEqual([folder.id]);
    expect(pdf.bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdf.bytes.byteLength).toBeGreaterThan(10_000);

    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Guardar los resultados en mi Drive (CSV)" }).click();
    await expect(page.getByText(/fisiolab-resultados-.*\.csv» está en tu Drive/)).toBeVisible({ timeout: 20_000 });
    const csv = google.visible("ana").find((f) => f.mimeType === "text/csv")!;
    expect(csv.parents).toEqual([folder.id]); // la misma carpeta, no otra
    expect(csv.bytes.toString("utf8")).toContain("paciente;fecha;test");
  });

  test("GD2 sin el permiso de archivos ni el de calendario, la app lo dice y no falla", async ({ page }) => {
    const google = new FakeGoogle(users);
    google.withheld = ["drive.file", "calendar.app.created"];
    await google.install(page.context(), () => "ana");
    await login(page);
    await page.goto("./ajustes/cuenta");
    await expect(page.getByText("Falta el permiso de Google Calendar.")).toBeVisible();
    await page.goto("./ajustes/datos");
    await page.getByRole("button", { name: "Guardar los resultados en mi Drive (CSV)" }).click();
    await expect(page.getByRole("alert").getByText(/Falta el permiso para guardar archivos en tu Drive/)).toBeVisible();
    await expectAccessible(page);
    expect(google.visible("ana")).toHaveLength(0);
  });
});
