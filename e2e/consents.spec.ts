// Consentimientos informados (src/consent): se proponen con la anamnesis, llevan sus riesgos personales, se firman
// en la pantalla y se pueden retirar.
import type { Locator, Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Ficha del paciente" }).getByRole("link", { name });

/** Firma de mentira: un garabato con el ratón. */
async function scribble(page: Page, pad: Locator) {
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + box.height * (0.6 + 0.2 * Math.sin(i)));
  await page.mouse.up();
}

test.describe("Consentimientos", () => {
  test("CI1 la anamnesis propone la punción con sus riesgos, se firma en la pantalla y se retira", async ({ page }) => {
    test.slow();
    await createPatient(page, { name: "Marta Consentimiento" });
    await tab(page, "Anamnesis").click();
    await page.getByLabel("Motivo principal").fill("Dolor cervical");
    await page.getByRole("group", { name: "Zona", exact: true }).getByText("Cervical", { exact: true }).click();
    await page.getByLabel("Enfermedades previas").fill("Diabetes tipo 2");
    await page.getByText("Toma anticoagulantes o antiagregantes").click();
    await page.getByLabel("Plan de intervención propuesto").fill("Punción seca en trapecio superior y ejercicio");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();

    await tab(page, "Resumen").click();
    // En «Pendiente», el que falta por escrito; lleva a Consentimientos.
    const row = page.getByRole("link", { name: /^Consentimiento sin firmar: tratamientos invasivos/ });
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.getByRole("heading", { name: "Consentimientos" })).toBeVisible();
    // Escrito y sin marcar: lo avisa.
    await expect(page.getByText("Pone «diabetes»: ¿diabetes?")).toBeVisible();
    const proposed = page.getByRole("region", { name: "Propuestos para este paciente" });
    await expect(proposed).toContainText("Tratamientos invasivos");
    await expect(proposed).toContainText("Valoración y tratamiento de fisioterapia");
    await expectAccessible(page);

    await proposed.getByRole("link", { name: /Tratamientos invasivos/ }).click();
    await expect(page.getByRole("checkbox", { name: "Punción seca" })).toBeChecked();
    const doc = page.locator("article");
    await expect(doc).toContainText("Marta Consentimiento");
    await expect(doc).toContainText("En su caso, según su historia");
    await expect(doc).toContainText(/anticoagulantes/);
    await expect(doc).toContainText(/neumotórax/);
    await expectAccessible(page);

    await page.getByLabel("Fisioterapeuta que informa").fill("Adrián Olivas");
    await page.getByRole("button", { name: "Firmar en la pantalla" }).click();
    await page.getByRole("button", { name: "Guardar el consentimiento firmado" }).click();
    await expect(page.getByText(/Faltan las firmas/)).toBeVisible();
    await scribble(page, page.getByRole("img", { name: /Firma de Marta Consentimiento/ }));
    await scribble(page, page.getByRole("img", { name: /Firma del fisioterapeuta/ }));
    await page.getByRole("button", { name: "Guardar el consentimiento firmado" }).click();

    await expect(page.getByText(/Firmado el .* en la pantalla/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Firma: Marta Consentimiento" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Firma: Adrián Olivas" })).toBeVisible();
    await expectAccessible(page);

    // Retirarlo: queda con la fecha y el documento no se borra.
    await page.getByRole("button", { name: "Retirar el consentimiento" }).click();
    const sheet = page.getByRole("dialog", { name: "¿Retirar el consentimiento?" });
    await sheet.getByLabel(/Motivo/).fill("Prefiere no recibir punción");
    await sheet.getByRole("button", { name: "Retirar", exact: true }).click();
    await expect(page.getByText(/Retirado el/).first()).toBeVisible();
    await expect(page.locator("article")).toContainText("Prefiere no recibir punción");

    await page.getByRole("link", { name: "Volver a Consentimientos" }).click();
    await expect(page.getByRole("region", { name: "Firmados" })).toContainText("Retirado el");
    // Retirado: vuelve a proponerse.
    await expect(page.getByRole("region", { name: "Propuestos para este paciente" })).toContainText("Tratamientos invasivos");
  });

  test("CI2 con osteoporosis y manipulación, la app no dice «contraindicado»: enseña lo que consta y la decisión es del fisio", async ({ page }) => {
    await createPatient(page, { name: "Rosa Osteoporosis" });
    await tab(page, "Anamnesis").click();
    await page.getByLabel("Motivo principal").fill("Dolor lumbar");
    await page.getByText("Osteoporosis", { exact: true }).click();
    await page.getByLabel("Plan de intervención propuesto").fill("Manipulación lumbar y ejercicio");
    await page.getByRole("button", { name: "Guardar anamnesis" }).click();
    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
    await page.goto(page.url().replace(/\/anamnesis$/, "/consentimientos"));
    await expect(page.getByRole("heading", { name: "Consentimientos" })).toBeVisible();
    const proposed = page.getByRole("region", { name: "Propuestos para este paciente" });
    await expect(proposed).toContainText("Manipulaciones articulares");
    await expect(page.getByText(/Contraindicado/)).toHaveCount(0);
    await proposed.getByRole("link", { name: /Manipulaciones articulares/ }).click();
    const notice = page.getByRole("status").filter({ hasText: "Consta en la anamnesis" });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("listitem")).toHaveText(["Osteoporosis"]);
    await expect(notice).toContainText("La decisión es tuya.");
    await expect(page.getByText(/Contraindicado|no se le debe/)).toHaveCount(0);
    // En el documento, el riesgo y que el fisioterapeuta lo valora con el paciente.
    await expect(page.locator("article")).toContainText("Como tiene osteoporosis, el hueso es más frágil y las manipulaciones tienen más riesgo. Su fisioterapeuta valorará con usted");
    await expectAccessible(page);
  });
});
