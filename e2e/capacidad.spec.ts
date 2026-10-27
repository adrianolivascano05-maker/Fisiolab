// Cuánto pide la app al servidor de la clínica (cloudflare/worker.js) con la pantalla abierta y sin tocar nada.
// El plan gratuito de Cloudflare da 100 000 peticiones al día para todo el servidor: este número dice cuántos
// dispositivos caben (cloudflare/README.md, «Cuántas clínicas caben»). Si alguien añade una consulta periódica nueva,
// esta prueba lo avisa antes de que se note en el servidor.
import type { Page } from "@playwright/test";
import { createPatient, expect, test } from "./fixtures";
import { FakeGoogle } from "./fakeGoogle";

const users = { ana: { sub: "2001", email: "ana@carga.test", name: "Ana Carga" } };
test.use({ serviceWorkers: "block" });

/** Entra en el servidor como fisio por su cuenta, con un paciente, y apunta cada petición al servidor. */
async function start(page: Page, google: FakeGoogle) {
  await google.install(page.context(), () => "ana", { server: true });
  const calls: { at: number; what: string }[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(FakeGoogle.SERVER) && r.method() !== "OPTIONS") calls.push({ at: Date.now(), what: `${r.method()} ${new URL(r.url()).pathname}` });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  await expect(page.getByLabel("Por mi cuenta")).toBeChecked({ timeout: 15_000 });
  await page.getByLabel("Nombre de tu consulta (o el tuyo)").fill("Ana Carga");
  await page.getByRole("button", { name: "Empezar" }).click();
  const choose = page.getByRole("heading", { name: "Elige tu PIN" });
  const list = page.getByRole("heading", { name: "Pacientes", exact: true });
  // En el servidor, la app pide elegir un PIN (puede salir un momento después de la lista).
  await expect(choose).toBeVisible({ timeout: 20_000 });
  {
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.keyboard.type("2580");
    await page.getByRole("button", { name: "Guardar el PIN" }).click();
  }
  await expect(list).toBeVisible({ timeout: 15_000 });
  await createPatient(page, { name: "Paciente de carga" });
  await page.goto("./");
  await expect(list).toBeVisible();
  return calls;
}

test("CAP1 con la app abierta y sin tocar nada, como mucho 1,5 peticiones por minuto al servidor", async ({ page }) => {
  test.setTimeout(180_000);
  const calls = await start(page, new FakeGoogle(users));
  // Que termine lo del arranque (entrar, primera copia) antes de medir.
  await page.waitForTimeout(8_000);

  const from = Date.now();
  const WINDOW = 125_000; // dos vueltas de la sincronización (cada minuto), que dice también si hay formularios
  await page.waitForTimeout(WINDOW);
  const idle = calls.filter((c) => c.at >= from);
  const perMinute = idle.length / (WINDOW / 60_000);
  const kinds = [...new Set(idle.map((c) => c.what))].sort();
  test.info().annotations.push({ type: "peticiones", description: `${idle.length} en ${WINDOW / 1000} s (${perMinute.toFixed(1)}/min): ${kinds.join(", ")}` });
  console.log(`[capacidad] ${idle.length} peticiones en ${WINDOW / 1000} s = ${perMinute.toFixed(1)}/min · ${kinds.join(" · ")}`);
  expect(perMinute).toBeGreaterThan(0); // la sincronización sigue viva
  expect(perMinute).toBeLessThanOrEqual(1.5);
  // Una sola consulta: la de la sincronización (los formularios ya no se preguntan aparte).
  expect(kinds.every((k) => k.endsWith("/copia/info"))).toBe(true);
});

test("CAP2 si nadie toca la app, se mira el servidor cada 5 minutos; al tocarla, enseguida", async ({ page }) => {
  test.setTimeout(240_000);
  // El reloj de la página, de mentira: así se pasan 20 minutos en segundos.
  await page.clock.install();
  const calls = await start(page, new FakeGoogle(users));
  await page.waitForTimeout(5_000);
  const minute = async () => {
    await page.clock.fastForward(60_000);
    await page.waitForTimeout(700);
  };
  const count = () => calls.filter((c) => c.what.endsWith("/copia/info")).length;
  // Los primeros minutos sin tocarla: cada minuto, como siempre.
  let before = count();
  for (let i = 0; i < 3; i++) await minute();
  expect(count() - before).toBeGreaterThanOrEqual(2);
  // Pasados 5 minutos sin tocarla: de 15 minutos más, como mucho 4 consultas (una cada 5).
  for (let i = 0; i < 3; i++) await minute();
  before = count();
  for (let i = 0; i < 15; i++) await minute();
  const idle = count() - before;
  test.info().annotations.push({ type: "peticiones sin uso", description: `${idle} en 15 min` });
  expect(idle).toBeGreaterThanOrEqual(2);
  expect(idle).toBeLessThanOrEqual(4);
  // Al tocarla, se mira enseguida.
  before = count();
  await page.mouse.click(5, 300);
  await expect.poll(count, { timeout: 5_000 }).toBeGreaterThan(before);
});
