// Los cuestionarios (docs/cuestionarios.md): buscarlos, anotarlos, que lleguen con sus códigos CIF a la carta de
// derivación (qué valoran, con las palabras de la CIF), los de solo nota con su hoja oficial y los de pago, fuera.
import type { Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";

async function newPatient(page: Page, name: string) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

test.describe("Cuestionarios nuevos", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  });

  test("CQ1 buscar el Roland-Morris, anotar la nota de su hoja oficial y verlo en la carta de derivación con su CIF", async ({ page }) => {
    const record = await newPatient(page, "Rosa Roland");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("roland");
    await expect(page.getByRole("button", { name: /^RMDQ/ })).toContainText("Con su hoja oficial: anotas la nota");
    await expectAccessible(page);
    await page.getByRole("button", { name: /^RMDQ/ }).click();
    // La app no trae sus preguntas: su hoja oficial, de dónde sale y la nota.
    await expect(page.getByText("Rellenarlo aquí")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /rmdq\.org/ })).toHaveAttribute("href", "https://www.rmdq.org");
    await expect(page.getByText(/Roland y Morris, 1983/)).toBeVisible();
    await page.getByLabel("Puntuación").fill("12");
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("12/24");

    // La carta: el cuestionario con los códigos de la CIF que valora, sin calificador (la app no gradúa: eso lo
    // decide el fisio en el perfil CIF de la anamnesis, y este paciente aún no lo tiene).
    await page.goto(`${record}`);
    await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("RMDQ (lumbar, Roland-Morris)");
    await expect(letter).toContainText(
      "Valora: dolor en la espalda (b28013), cambiar las posturas corporales básicas (d410), mantener la posición del cuerpo (d415), andar (d450) y vestirse (d540).",
    );
    await expect(letter).not.toContainText("Según la CIF");
    await expect(letter).not.toContainText(/d410\.\d/);
    await expect(page.getByLabel("Funcionamiento según la CIF")).toHaveValue("");
    await expect(page.getByText("Sale del perfil CIF de la anamnesis. Aún no tiene.")).toBeVisible();
    await expectAccessible(page);
  });

  test("CQ2 los de pago, fuera del servicio: ni se buscan, ni se pasan, ni están en la Biblioteca", async ({ page }) => {
    const record = await newPatient(page, "Kiko Koos");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("koos");
    await expect(page.getByText("Ningún cuestionario con «koos».")).toBeVisible();
    await page.goto(`${record}/cuestionarios/nuevo?tipo=koos12`);
    await expect(page.getByText("Fuera del servicio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cuestionario" })).toHaveCount(0);
    await expectAccessible(page);

    // En la Biblioteca tampoco; sin la lista de permisos (la antigua dirección lleva a los cuestionarios).
    await page.goto("./ajustes/cuestionarios");
    await expect(page.getByRole("heading", { name: "Cuestionarios", level: 1 })).toBeVisible();
    await expect(page.getByText("Permisos y licencias")).toHaveCount(0);
    await page.getByLabel("Buscar cuestionario").fill("womac");
    await expect(page.getByText("Ningún cuestionario con «womac».")).toBeVisible();
    await page.goto("./biblioteca/cuestionarios/koos12");
    await expect(page.getByText(/fuera del servicio/)).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("CQ3 con permiso de su titular, solo la nota: a quién pedirlo y sus rangos publicados", async ({ page }) => {
    const record = await newPatient(page, "Nuria Neuropática");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("paindetect");
    await page.getByRole("button", { name: /^painDETECT/ }).click();
    await expect(page.getByText("Permiso: formulario de IQVIA")).toBeVisible();
    await page.getByLabel("Puntuación").fill("20");
    // La nota y, al lado, la tabla de rangos publicada con su cita; sin frases sobre el paciente.
    const ranges = page.getByRole("table", { name: /^Rangos publicados/ });
    await expect(ranges).toContainText("19–38");
    await expect(page.getByText(/^Fuente: Freynhagen et al., 2006/)).toBeVisible();
    await expect(page.getByText(/la app no las aplica a la nota del paciente/)).toBeVisible();
    await expect(page.getByText(/neuropático probable \(19 o más\)$/)).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(page.getByRole("list", { name: "Cuestionarios" })).toContainText("painDETECT");
  });

  test("CQ4 los libres, enteros en la app, con sus autores y el aviso de que la traducción es de trabajo", async ({ page }) => {
    const record = await newPatient(page, "Laura Libre");
    await page.goto(`${record}/cuestionarios/nuevo?tipo=phq9`);
    await expect(page.getByText(/^Autores: Kroenke, Spitzer y Williams, 2001/)).toBeVisible();
    await expect(page.getByText(/^Traducción de trabajo: no se ha comprobado/)).toBeVisible();
    await expectAccessible(page);
    await page.goto("./biblioteca/cuestionarios/rand36");
    await expect(page.getByRole("heading", { name: /^RAND-36/, level: 1 })).toBeVisible();
    await expect(page.getByText(/^Autores: RAND Health, 1992/)).toBeVisible();
    await expect(page.getByText(/^Traducción de trabajo/)).toBeVisible();
    await expect(page.getByText(/SF-36/)).toHaveCount(0);
    // En la Biblioteca, «Cómo se lee»: la tabla de rangos publicada con su cita (los que la tienen).
    await page.goto("./biblioteca/cuestionarios/phq9");
    await expect(page.getByRole("table", { name: "Rangos publicados: gravedad de los síntomas depresivos" })).toContainText("20–27");
    await expect(page.getByText(/^Fuente: Kroenke, Spitzer y Williams, 2001/)).toBeVisible();
    await expectAccessible(page);
  });
});
