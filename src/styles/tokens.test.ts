// Contraste de la paleta en los dos modos (claro y oscuro): cada pareja de «pairs» en tokens.json, con el umbral de
// WCAG 2.2 AA: 4,5 para texto, 3 para texto grande ("large") y para piezas de la interfaz ("ui").
import { describe, expect, it } from "vitest";
import tokens from "./tokens.json";

type Colors = Record<string, string>;
const light: Colors = tokens.color;
const dark: Colors = { ...light, ...tokens.colorDark };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("paleta", () => {
  it("el modo oscuro solo cambia colores que existen en el claro", () => {
    for (const name of Object.keys(tokens.colorDark)) expect(light, name).toHaveProperty(name);
  });

  for (const [mode, colors] of [
    ["claro", light],
    ["oscuro", dark],
  ] as const) {
    it(`contraste AA en modo ${mode}`, () => {
      const fails = tokens.pairs
        .map(([fg, bg, kind]) => ({ fg: fg!, bg: bg!, need: kind ? 3 : 4.5, ratio: contrast(colors[fg!]!, colors[bg!]!) }))
        .filter((p) => p.ratio < p.need)
        .map((p) => `${p.fg} sobre ${p.bg}: ${p.ratio.toFixed(2)} < ${p.need}`);
      expect(fails).toEqual([]);
    });
  }
});
