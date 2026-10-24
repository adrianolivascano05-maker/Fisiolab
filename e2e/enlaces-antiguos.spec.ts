// La reserva por internet y los enlaces para anular ya no existen (las citas las gestiona la clínica). Quien abra un
// enlace antiguo ve qué hacer, y la dirección antigua de los ajustes lleva a Ajustes.
import { expect, expectAccessible, test } from "./fixtures";

test.describe("Enlaces antiguos de la reserva por internet", () => {
  for (const path of ["./reservar/fisiolab-centro", "./cita/codigo-de-una-cita-antigua"]) {
    test(`EA1 ${path.split("/")[1]}: dice que se hable con la clínica`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Este enlace ya no funciona" })).toBeVisible();
      await expect(page.getByText("Escribe o llama a tu clínica")).toBeVisible();
      await expectAccessible(page);
    });
  }

  test("EA2 la dirección antigua de los ajustes de la reserva lleva a Ajustes, sin «Reserva online»", async ({ page }) => {
    await page.goto("./ajustes/reservas");
    await expect(page).toHaveURL(/\/ajustes$/);
    await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
    await expect(page.getByText("Reserva online")).toHaveCount(0);
  });
});
