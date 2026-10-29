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

    // La carta: el funcionamiento con la CIF (propuesto con el cuestionario) y el cuestionario con sus códigos.
    await page.goto(`${record}`);
    await page.getByRole("link", { name: /^Carta de derivación/ }).click();
    const letter = page.getByRole("article", { name: "Carta de derivación" });
    await expect(letter).toContainText("RMDQ (lumbar, Roland-Morris)");
    // Qué valora, dicho con la CIF y con el calificador que propone: 12/24 = 50 % de problema, GRAVE.
    await expect(letter).toContainText(
      "Valora: dolor en la espalda (b28013.3), cambiar las posturas corporales básicas (d410.3), mantener la posición del cuerpo (d415.3), andar (d450.3) y vestirse (d540.3).",
    );
    await expect(letter).toContainText("Según la CIF, presenta");
    await expect(letter).toContainText("dificultad grave para cambiar las posturas corporales básicas (d410.3)");
    // Redactado: lo que respalda el mismo cuestionario con la misma gravedad, de una vez.
    await expect(page.getByLabel("Funcionamiento según la CIF")).toHaveValue(
      /Actividades y participación: dificultad grave para cambiar las posturas corporales básicas \(d410\.3\), para mantener la posición del cuerpo \(d415\.3\), para andar \(d450\.3\) y para vestirse \(d540\.3\), según RMDQ 12\/24 el 20 oct\./,
    );
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

  test("CQ3 con permiso de su titular, solo la nota: a quién pedirlo", async ({ page }) => {
    const record = await newPatient(page, "Nuria Neuropática");
    await page.goto(`${record}/cuestionarios/nuevo`);
    await page.getByLabel("Buscar cuestionario").fill("paindetect");
    await page.getByRole("button", { name: /^painDETECT/ }).click();
    await expect(page.getByText("Permiso: formulario de IQVIA")).toBeVisible();
    await page.getByLabel("Puntuación").fill("20");
    await expect(page.getByText("Componente neuropático probable (19 o más)")).toBeVisible();
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
  });
});
