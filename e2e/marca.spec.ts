// La marca de la clínica (src/brand): nombre, dos colores y logo en Ajustes › Marca de la clínica. Se aplica a toda
// la app con contraste suficiente en claro y en oscuro, no parpadea al abrir, y «Volver a la marca de Cénit» la quita.
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import type { Locator, Page } from "@playwright/test";
import { createPatient, expect, expectAccessible, test } from "./fixtures";

/** Un PNG de un solo color, para subirlo como logo. */
function png(w: number, h: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const cssVar = (page: import("@playwright/test").Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(), name);

/** Contraste WCAG, igual que en src/brand/engine.ts. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Firma de mentira: un garabato con el ratón. */
async function scribble(page: Page, pad: Locator) {
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + box.height * (0.6 + 0.2 * Math.sin(i)));
  await page.mouse.up();
}

/** Guarda una marca desde Ajustes. */
async function setBrand(page: Page, name: string, primary: string, secondary: string, watermark: boolean) {
  await page.goto("./ajustes/marca");
  await page.getByLabel("Nombre de la clínica").fill(name);
  await page.getByLabel("Color principal en hexadecimal").fill(primary);
  await page.getByLabel("Color de acento en hexadecimal").fill(secondary);
  await page.getByRole("checkbox", { name: /Marca de agua/ }).setChecked(watermark);
  await page.getByRole("button", { name: "Guardar la marca" }).click();
  await expect(page.getByText("Marca guardada: ya se ve en toda la app")).toBeVisible();
}

test.describe("Marca de la clínica", () => {
  test("MB2 los documentos llevan la marca y la marca de agua; un consentimiento firmado se queda con la suya", async ({ page }) => {
    test.setTimeout(120_000);
    await setBrand(page, "Clínica Aurora", "#7A1F3D", "#D9A441", true);
    await createPatient(page, { name: "Marta Marca" });
    const patient = page.url().replace(/^.*\/pacientes\//, "./pacientes/");

    // El informe: membrete con la marca y la marca de agua.
    await page.goto(`${patient}/informe`);
    const report = page.getByRole("article", { name: "Informe" });
    await expect(report).toContainText("Clínica Aurora");
    await expect(report).toContainText("Documento generado con Cénit.");
    await expect(report.locator("[data-watermark] img")).toHaveCount(1);
    await expectAccessible(page);

    // El justificante en PDF se genera (con la marca de agua dibujada en cada página).
    await page.goto(`${patient}/justificante`);
    await page.getByLabel("Día y hora de la consulta").fill("2026-10-20T10:00");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Guardar en PDF" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^Justificante Marta Marca 2026-10-20\.pdf$/);
    const pdf = readFileSync((await dl.path())!);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);

    // Un consentimiento firmado con esta marca.
    await page.goto(`${patient}/consentimientos`);
    await page.getByRole("region", { name: "Propuestos para este paciente" }).getByRole("link", { name: /Valoración y tratamiento/ }).click();
    const doc = page.locator("article");
    await expect(doc).toContainText("Clínica Aurora");
    await expect(doc.locator("[data-watermark] img")).toHaveCount(1);
    await page.getByLabel("Fisioterapeuta que informa").fill("Laura Ruiz");
    await page.getByRole("button", { name: "Firmar en la pantalla" }).click();
    await scribble(page, page.getByRole("img", { name: /Firma de Marta Marca/ }));
    await scribble(page, page.getByRole("img", { name: /Firma del fisioterapeuta/ }));
    await page.getByRole("button", { name: "Guardar el consentimiento firmado" }).click();
    await expect(page.getByText(/Firmado el .* en la pantalla/)).toBeVisible();
    const signed = page.url().replace(/^.*\/pacientes\//, "./pacientes/");

    // La clínica cambia de marca y quita la marca de agua: los documentos nuevos cambian; el firmado, no.
    await setBrand(page, "Clínica Boreal", "#2B2F2B", "#B5D334", false);
    await page.goto(`${patient}/informe`);
    await expect(report).toContainText("Clínica Boreal");
    await expect(report.locator("[data-watermark]")).toHaveCount(0);
    await page.goto(signed);
    await expect(doc).toContainText("Clínica Aurora");
    await expect(doc).not.toContainText("Clínica Boreal");
    await expect(doc.locator("[data-watermark] img")).toHaveCount(1);
    await expect(page.getByRole("img", { name: "Firma: Marta Marca" })).toBeVisible();
    await expectAccessible(page);
  });

  test("MB1 dos colores y un nombre visten toda la app, con contraste, sin parpadeo, y se quitan", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("./ajustes");
    await page.getByRole("region", { name: "Clínica", exact: true }).getByRole("link", { name: /Marca de la clínica.*La marca de Cénit/ }).click();
    await expect(page.getByRole("heading", { name: "Marca de la clínica" })).toBeVisible();
    await expectAccessible(page);

    // Un azul clarito como principal: en los botones se oscurece solo.
    await page.getByLabel("Nombre de la clínica").fill("Fisioterapia Ruiz");
    await page.getByLabel("Color principal en hexadecimal").fill("#9CCBF3");
    await page.getByLabel("Color de acento en hexadecimal").fill("#E8794A");
    await expect(page.getByText(/tu color principal se oscurece un poco/)).toBeVisible();
    await page.getByRole("button", { name: "Guardar la marca" }).click();
    await expect(page.getByText("Marca guardada: ya se ve en toda la app")).toBeVisible();

    // Toda la app: la cabecera ya no es el verde de Cénit, el acento se lee sobre blanco y la pestaña lleva el nombre.
    expect(await cssVar(page, "--color-brand")).not.toBe("#0E3B2E");
    const accent = await cssVar(page, "--color-accent");
    expect(contrast(accent, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    await expect(page).toHaveTitle("Fisioterapia Ruiz");
    expect(await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href)).toMatch(/^data:image\/png/);
    await page.goto("./ajustes");
    await expect(page.getByRole("region", { name: "Clínica", exact: true }).getByRole("link", { name: /Marca de la clínica.*Fisioterapia Ruiz/ })).toBeVisible();
    await page.goto("./");
    await expect(page.getByRole("banner")).toContainText("Fisioterapia Ruiz");
    await expectAccessible(page);

    // Al volver a abrir, la marca está puesta antes de que abra la base: no se ve Cénit ni un instante.
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => !!document.getElementById("brand-css"))).toBe(true);
    await expect(page.getByRole("banner")).toContainText("Fisioterapia Ruiz");

    // En oscuro también se lee todo.
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    expect(contrast(await cssVar(page, "--color-accent"), await cssVar(page, "--color-bg"))).toBeGreaterThanOrEqual(4.5);
    await page.goto("./agenda");
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "light" });

    // Un logo: propone sus colores y se ve en la barra; a 360 px nada se sale.
    await page.goto("./ajustes/marca");
    await page.getByLabel("Elegir el archivo del logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png(32, 32, [211, 62, 106]) });
    await expect(page.getByText("Colores que salen del logo:")).toBeVisible();
    await page.getByRole("button", { name: "Usar estos colores" }).click();
    const picked = await page.getByLabel("Color principal en hexadecimal").inputValue();
    expect(picked).not.toBe("#9CCBF3");
    expect(parseInt(picked.slice(1, 3), 16)).toBeGreaterThan(parseInt(picked.slice(5, 7), 16)); // más rojo que azul
    await page.getByRole("radio", { name: /^tal cual/ }).check();
    await page.getByRole("button", { name: "Guardar la marca" }).click();
    await expect(page.getByText("Marca guardada: ya se ve en toda la app")).toBeVisible();
    expect(await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href)).toMatch(/^data:image\/png/);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("./");
    await expect(page.getByRole("banner").locator("img")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.goto("./ajustes/marca");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expectAccessible(page);

    // Volver a Cénit.
    await page.getByRole("button", { name: "Volver a la marca de Cénit" }).click();
    await expect(page.getByText("Vuelve la marca de Cénit")).toBeVisible();
    expect(await cssVar(page, "--color-brand")).toBe("#0E3B2E");
    await expect(page).toHaveTitle("Cénit · Fisiolab");
    await page.goto("./");
    await expect(page.getByRole("banner")).toContainText("Cénit");
    expect(await page.evaluate(() => localStorage.getItem("fisiolab.brand"))).toBeNull();
  });
});
