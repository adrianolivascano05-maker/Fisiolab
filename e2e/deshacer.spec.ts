// «Deshacer» (docs/rediseno-sencilla.md, bloque 12): al dar o anular una cita, cobrar o borrar un evento, el aviso
// lleva un botón que lo deja como estaba.
import { expect, test } from "./fixtures";

test("DH1 deshacer: una cita dada, una anulada y un cobro vuelven a como estaban", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill("Dario Deshace");
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name: "Dario Deshace" })).toBeVisible();
  const record = page.url();

  // Dar una cita y deshacerlo: vuelve a no tener cita.
  const give = async () => {
    await page.getByRole("button", { name: "Dar cita" }).click();
    const sheet = page.getByRole("dialog", { name: "Dar cita a Dario Deshace" });
    await sheet.getByRole("group", { name: "Huecos libres" }).getByRole("button", { pressed: false }).first().click();
    await sheet.getByRole("button", { name: /^Dar la cita · / }).click();
    await expect(page.getByText("Cita dada")).toBeVisible();
  };
  await give();
  await expect(page.getByRole("button", { name: /^Próxima cita: / })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: "Dar cita" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Próxima cita: / })).toHaveCount(0);

  // Anularla y deshacerlo: la cita sigue en pie.
  await give();
  await expect(page.getByRole("button", { name: "Deshacer" })).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole("button", { name: /^Próxima cita: / }).click();
  await page.getByRole("dialog", { name: "Cita de Dario Deshace" }).getByRole("button", { name: "Anular" }).click();
  await page.getByRole("dialog", { name: "Cita de Dario Deshace" }).getByRole("button", { name: "Sí, anular" }).click();
  await expect(page.getByRole("button", { name: "Dar cita" })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("button", { name: /^Próxima cita: / })).toBeVisible();

  // Un cobro apuntado por error se quita con «Deshacer».
  await page.goto(`${record}/cobros`);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  const pay = page.getByRole("dialog", { name: "Cobrar" });
  await pay.getByLabel("Cantidad").fill("30");
  await pay.getByText("Efectivo").click();
  await pay.getByRole("button", { name: "Guardar el cobro" }).click();
  await expect(page.getByRole("list", { name: "Cobros" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("Sin cobros apuntados.")).toBeVisible();
});
