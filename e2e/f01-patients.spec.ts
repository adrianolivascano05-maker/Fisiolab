import { createPatient, expect, expectAccessible, test } from "./fixtures";

test.describe("F01 Dar de alta un paciente", () => {
  test("F01-H1 crear paciente y verlo en la lista", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByText("Todavía no hay pacientes")).toBeVisible();
    await expectAccessible(page);
    await createPatient(page, { name: "Ana Martín López", mass: "62,5", pushOff: "38" });
    await expect(page.getByText("62,5 kg · empuje 38,0 cm")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("link", { name: /Ana Martín López.*Sin visitas todavía/ })).toBeVisible();
  });

  test("F01-E1 nombre vacío", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByText("Escribe el nombre.")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeFocused();
    await expectAccessible(page);
  });

  test("F01-E2 valores fuera de rango y texto en un número", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("X");
    await page.getByLabel("Masa").fill("900");
    await page.getByLabel("Estatura").fill("abc");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByText("La masa debe estar entre 10 y 300 kg.")).toBeVisible();
    await expect(page.getByText("La estatura debe estar entre 50 y 250 cm.")).toBeVisible();
    await expect(page).toHaveURL(/\/pacientes\/nuevo$/);
  });

  test("F01-E3 nombre largo con tildes y emoji", async ({ page }) => {
    const name = "María José Fernández-Ñúñez de la Cruz y Ortega 💪 Pérez";
    await createPatient(page, { name });
    await page.goto("./");
    await expect(page.getByRole("link", { name: new RegExp(name.slice(0, 20)) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("F01-E4 doble pulsación en crear da un solo paciente", async ({ page }) => {
    await page.goto("./pacientes/nuevo");
    await page.getByLabel("Nombre").fill("Doble");
    await page.getByRole("button", { name: "Crear paciente" }).dblclick();
    await expect(page.getByRole("heading", { name: "Doble" })).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("link", { name: /Doble/ })).toHaveCount(1);
  });

  test("F01-E5 editar y buscar", async ({ page }) => {
    await createPatient(page, { name: "Jorge Ruiz" });
    await createPatient(page, { name: "Lucía Herrero" });
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await page.getByLabel("Masa").fill("58.5");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("58,5 kg")).toBeVisible();
    await page.goto("./");
    await page.getByLabel("Buscar paciente").fill("JOR");
    await expect(page.getByRole("link", { name: /Jorge Ruiz/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lucía/ })).toHaveCount(0);
    await page.getByLabel("Buscar paciente").fill("zzz");
    await expect(page.getByText("Ningún paciente se llama «zzz».")).toBeVisible();
  });

  test("F01-N1 borrar paciente pide confirmación y lo borra", async ({ page }) => {
    await createPatient(page, { name: "Para borrar" });
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await page.getByRole("button", { name: "Borrar paciente" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Borrar este paciente?" });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Borrar paciente" }).click();
    await dialog.getByRole("button", { name: "Borrar para siempre" }).click();
    await expect(page.getByText("Todavía no hay pacientes")).toBeVisible();
  });

  test("F01-N2 abrir un paciente que no existe", async ({ page }) => {
    await page.goto("./pacientes/no-existe");
    await expect(page.getByText("Este paciente no existe.")).toBeVisible();
  });

  test("F01-E6 solo con teclado", async ({ page }) => {
    await page.goto("./");
    // Del buscador al enlace de añadir y al formulario, sin ratón.
    await page.getByRole("link", { name: "Nuevo paciente" }).focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Nombre").focus();
    await page.keyboard.type("Teclado");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Teclado" })).toBeVisible();
  });

  test("F01-E7 los avisos salen arriba y no tapan los botones de abajo", async ({ page }) => {
    await createPatient(page, { name: "Aviso" });
    const toast = page.getByText("Paciente añadido");
    await expect(toast).toBeVisible();
    const box = (await toast.boundingBox())!;
    expect(box.y).toBeLessThan(844 / 3);
  });
});
