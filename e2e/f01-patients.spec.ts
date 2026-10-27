import type { Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, smallTargets, test } from "./fixtures";

/** Un paciente con fecha de nacimiento, sexo y teléfono, desde su formulario. */
async function withData(page: Page, name: string, birth: string, sex: string, phone: string) {
  await page.goto("./pacientes/nuevo");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Fecha de nacimiento").fill(birth);
  await page.getByLabel("Sexo").selectOption(sex);
  await page.getByLabel("Teléfono").fill(phone);
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test.describe("F01 Dar de alta un paciente", () => {
  test("F01-H1 crear paciente y verlo en la lista", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByText("Todavía no hay pacientes")).toBeVisible();
    await expectAccessible(page);
    await createPatient(page, { name: "Ana Martín López", mass: "62,5", pushOff: "38" });
    await expect(page.getByText("62,5 kg", { exact: true })).toBeVisible();
    // El contacto va en la ficha (no en cada anamnesis) y sale en la cabecera.
    await page.getByRole("link", { name: "Editar datos", exact: true }).click();
    await expect(page.getByLabel("Distancia de empuje")).toHaveValue("38");
    await page.getByLabel("Teléfono").fill("612 34 56 78");
    await page.getByLabel("Email").fill("ana@");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Ese correo no parece completo.")).toBeVisible();
    await page.getByLabel("Email").fill("ana@correo.es");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("612 34 56 78 · 62,5 kg")).toBeVisible();
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
    await page.getByLabel("Peso").fill("900");
    await page.getByLabel("Estatura").fill("abc");
    await page.getByRole("button", { name: "Crear paciente" }).click();
    await expect(page.getByText("El peso debe estar entre 10 y 300 kg.")).toBeVisible();
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
    await page.getByRole("link", { name: "Editar datos", exact: true }).click();
    await page.getByLabel("Peso").fill("58.5");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("58,5 kg")).toBeVisible();
    await page.goto("./");
    await page.getByLabel("Buscar paciente").fill("JOR");
    await expect(page.getByRole("link", { name: /Jorge Ruiz/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lucía/ })).toHaveCount(0);
    await page.getByLabel("Buscar paciente").fill("zzz");
    await expect(page.getByText("Ningún paciente coincide con «zzz».")).toBeVisible();
  });

  test("F01-E7 buscar por teléfono o DNI y filtrar (edad, sexo); los filtros siguen al volver de una ficha", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await withData(page, "Ana Filtro", "1990-03-01", "female", "600 11 22 33");
    await withData(page, "Beto Filtro", "2015-06-01", "male", "611 44 55 66");
    await createPatient(page, { name: "Carla Sin Datos" });
    await page.goto("./");
    const list = page.getByRole("list", { name: "Pacientes" });
    await expect(list.getByRole("link")).toHaveCount(3);
    // El teléfono, escrito con o sin espacios.
    await page.getByLabel("Buscar paciente").fill("611445566");
    await expect(page.getByRole("link", { name: /Beto Filtro/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana Filtro/ })).toHaveCount(0);
    await page.getByLabel("Buscar paciente").fill("");

    // Filtros: se aplican al momento y el botón dice cuántos salen.
    await page.getByRole("button", { name: "Filtros" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByLabel("Sexo").selectOption("female");
    await expect(sheet.getByRole("button", { name: "Ver 1 paciente" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expectAccessible(page);
    await page.screenshot({ path: test.info().outputPath("filtros-360.png") });
    await sheet.getByRole("button", { name: "Ver 1 paciente" }).click();
    await page.screenshot({ path: test.info().outputPath("lista-filtrada-360.png") });
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByRole("link", { name: /Ana Filtro/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtros (1 puestos)" })).toBeVisible();

    // Edad: menores de 18 y mujer, nadie; quitando «Mujer», Beto.
    await page.getByRole("button", { name: "Filtros (1 puestos)" }).click();
    await sheet.getByLabel("Edad hasta").fill("17");
    await sheet.getByRole("button", { name: "Ver 0 pacientes" }).click();
    await expect(page.getByText("Ningún paciente con estos filtros.")).toBeVisible();
    const chips = page.getByRole("list", { name: "Filtros puestos" });
    await chips.getByRole("button", { name: "Quitar el filtro: Mujer" }).click();
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByRole("link", { name: /Beto Filtro/ })).toBeVisible();

    // Al volver de su ficha, la lista sigue filtrada; después, quitar los filtros.
    await list.getByRole("link", { name: /Beto Filtro/ }).click();
    await expect(page.getByRole("heading", { name: "Beto Filtro" })).toBeVisible();
    await page.goBack();
    await expect(chips.getByRole("button", { name: "Quitar el filtro: 17 años o menos" })).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(1);
    await page.getByRole("button", { name: "Filtros (1 puestos)" }).click();
    await sheet.getByRole("button", { name: "Quitar los filtros" }).click();
    await sheet.getByRole("button", { name: "Ver 3 pacientes" }).click();
    await expect(list.getByRole("link")).toHaveCount(3);
  });

  test("F01-N1 borrar paciente pide confirmación y lo borra", async ({ page }) => {
    await createPatient(page, { name: "Para borrar" });
    await page.getByRole("link", { name: "Editar datos", exact: true }).click();
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
