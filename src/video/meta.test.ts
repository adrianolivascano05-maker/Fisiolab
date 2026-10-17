import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nominalFps, readContainerMeta } from "./meta";

const fixture = (name: string) => new Blob([readFileSync(new URL(`./fixtures/${name}`, import.meta.url))]);

describe("lectura del contenedor", () => {
  it("vídeo a 240 fps con el índice al final (como el iPhone)", async () => {
    const m = await readContainerMeta(fixture("cmj240.mov"));
    expect(nominalFps(m.fps)).toBe(240);
    expect(m.frameCount).toBe(240);
    expect(m.durationS).toBeCloseTo(1, 3);
  });

  it("cámara lenta exportada ralentizada: el archivo dice 30 fps y dura 8 s", async () => {
    const m = await readContainerMeta(fixture("slowmo-export30.mov"));
    expect(nominalFps(m.fps)).toBe(30);
    expect(m.frameCount).toBe(240);
    expect(m.durationS).toBeCloseTo(8, 2);
  });

  it("rechaza lo que no es vídeo", async () => {
    await expect(readContainerMeta(new Blob(["hola"]))).rejects.toThrow();
  });

  it("redondea fps casi nominales", () => {
    expect(nominalFps(239.76)).toBe(240);
    expect(nominalFps(29.97)).toBe(30);
    expect(nominalFps(77.3)).toBe(77.3);
  });
});

describe("vídeos VP9 de las pruebas en navegador", () => {
  it("240 fps y cámara lenta exportada a 30", async () => {
    expect(nominalFps((await readContainerMeta(fixture("e2e-240.mp4"))).fps)).toBe(240);
    const slow = await readContainerMeta(fixture("e2e-slowmo-30.mp4"));
    expect([nominalFps(slow.fps), slow.frameCount]).toEqual([30, 240]);
  });
});
