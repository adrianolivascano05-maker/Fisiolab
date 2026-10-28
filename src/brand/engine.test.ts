// El motor de la marca tiene que dar contraste AA con cualquier pareja de colores que elija una clínica: se prueban
// las mismas parejas de tokens.json que vigila tokens.test.ts, con colores al azar y con los casos límite.
import { describe, expect, it } from "vitest";
import tokens from "../styles/tokens.json";
import { brandCss, brandTokens, contrast, fit, fromLch, isHex, omniclinTokens, scale, toLch } from "./engine";

type Colors = Record<string, string>;

function fails(colors: Colors): string[] {
  return tokens.pairs
    .map(([fg, bg, kind]) => ({ fg: fg!, bg: bg!, need: kind ? 3 : 4.5, ratio: contrast(colors[fg!]!, colors[bg!]!) }))
    .filter((p) => p.ratio < p.need)
    .map((p) => `${p.fg} sobre ${p.bg}: ${p.ratio.toFixed(2)} < ${p.need}`);
}

/** Números repetibles (sin depender de Math.random) para que el fallo, si lo hay, sea siempre el mismo. */
function* lcg(seed: number) {
  let x = seed;
  for (;;) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    yield x / 4294967296;
  }
}
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const EDGES = ["#FFFFFF", "#000000", "#FFFF00", "#00FFFF", "#FF00FF", "#FF0000", "#0000FF", "#00FF00", "#808080", "#9CCBF3", "#7A1F3D", "#2B2F2B", "#B5D334", "#1F6B4F", "#C9A227", "#F5F5DC"];

describe("motor de la marca", () => {
  it("convierte ida y vuelta sin perder el color", () => {
    for (const h of EDGES) {
      const back = fromLch(toLch(h));
      expect(contrast(back, h)).toBeLessThan(1.05);
    }
    expect(isHex("#1F6B4F")).toBe(true);
    expect(isHex("1F6B4F")).toBe(false);
  });

  it("fit oscurece o aclara hasta el contraste pedido sin pasarse de la cuenta", () => {
    const d = fit("#9CCBF3", "#FFFFFF", 4.5, -1);
    expect(contrast(d, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(toLch(d).h - toLch("#9CCBF3").h)).toBeLessThan(6);
    const l = fit("#0E3B2E", "#171F1B", 4.5, +1);
    expect(contrast(l, "#171F1B")).toBeGreaterThanOrEqual(4.5);
    // Un color que ya cumple se queda como está.
    expect(fit("#1F6B4F", "#FFFFFF", 4.5, -1)).toBe("#1F6B4F");
  });

  it("la escala va de claro a oscuro y los últimos tonos sirven para texto", () => {
    const s = scale("#9CCBF3");
    expect(s.map((x) => x.step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    for (let i = 1; i < s.length; i++) expect(toLch(s[i]!.hex).L).toBeLessThan(toLch(s[i - 1]!.hex).L);
    expect(contrast(s[9]!.hex, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("contraste AA en claro y en oscuro con 300 parejas de colores al azar y los casos límite", () => {
    const rnd = lcg(7);
    const pairs: [string, string][] = [];
    for (let i = 0; i < 300; i++) pairs.push([hex(rnd.next().value!, rnd.next().value!, rnd.next().value!), hex(rnd.next().value!, rnd.next().value!, rnd.next().value!)]);
    for (const a of EDGES) for (const b of ["#FFFFFF", "#000000", "#C9A227", a]) pairs.push([a, b]);
    const problems: string[] = [];
    for (const [primary, secondary] of pairs) {
      const t = brandTokens(primary, secondary);
      const light: Colors = { ...tokens.color, ...t.light };
      const dark: Colors = { ...tokens.color, ...tokens.colorDark, ...t.dark };
      for (const f of fails(light)) problems.push(`${primary}/${secondary} claro: ${f}`);
      for (const f of fails(dark)) problems.push(`${primary}/${secondary} oscuro: ${f}`);
    }
    expect(problems).toEqual([]);
  });

  it("los acabados vivo y metálico y las tres cabeceras siguen dando contraste AA con las paletas y los casos límite", () => {
    const palettes: [string, string][] = [
      ["#1F6B4F", "#C9A227"],
      ["#1F5F8B", "#E07A5F"],
      ["#3D4A52", "#6CC39D"],
      ["#6B3A5B", "#D9B88A"],
      ["#A5472F", "#7A8A3E"],
      ["#3B4A9E", "#E0A447"],
      ["#15696B", "#F0A48F"],
      ["#7F2231", "#E9D8B4"],
    ];
    for (const a of EDGES) palettes.push([a, "#C9A227"], ["#1F6B4F", a], [a, a]);
    const problems: string[] = [];
    for (const [primary, secondary] of palettes)
      for (const finish of ["matte", "vivid", "metal"] as const)
        for (const header of ["dark", "color", "light"] as const) {
          const t = brandTokens(primary, secondary, { finish, header });
          const light: Colors = { ...tokens.color, ...t.light };
          const dark: Colors = { ...tokens.color, ...tokens.colorDark, ...t.dark };
          for (const f of fails(light)) problems.push(`${primary}/${secondary} ${finish} ${header} claro: ${f}`);
          for (const f of fails(dark)) problems.push(`${primary}/${secondary} ${finish} ${header} oscuro: ${f}`);
        }
    expect(problems).toEqual([]);
    // Vivo sube el croma; la cabecera «color» es la de los botones y la «clara» es el fondo.
    const matte = brandTokens("#1F6B4F", "#C9A227");
    const vivid = brandTokens("#1F6B4F", "#C9A227", { finish: "vivid" });
    expect(toLch(vivid.light.accent!).C).toBeGreaterThan(toLch(matte.light.accent!).C);
    expect(brandTokens("#1F6B4F", "#C9A227", { header: "color" }).light.brand).toBe(matte.light.accent);
    expect(brandTokens("#1F6B4F", "#C9A227", { header: "light" }).light.brand).toBe("#FFFFFF");
    // Los tonos del acabado: uno más claro y uno más oscuro de cada color de acción.
    for (const k of ["brand", "accent", "highlight"]) {
      expect(toLch(matte.light[`${k}-hi`]!).L).toBeGreaterThan(toLch(matte.light[k]!).L);
      expect(toLch(matte.light[`${k}-lo`]!).L).toBeLessThan(toLch(matte.light[k]!).L);
    }
  });

  it("la identidad de OmniClin con otro aspecto parte de sus colores de siempre y sigue dando contraste AA", () => {
    const plain = omniclinTokens();
    // Mate y cabecera oscura: los colores de tokens.json tal cual (más los tonos de los degradados).
    for (const k of ["brand", "accent", "on-brand", "on-brand-accent", "highlight", "canvas"]) {
      expect(plain.light[k], k).toBe((tokens.color as Record<string, string>)[k]);
    }
    expect(plain.dark.brand).toBe(tokens.colorDark.brand);
    expect(plain.light["accent-hi"]).toBeTruthy();
    const problems: string[] = [];
    for (const finish of ["matte", "vivid", "metal"] as const)
      for (const header of ["dark", "color", "light"] as const) {
        const t = omniclinTokens({ finish, header });
        for (const f of fails({ ...tokens.color, ...t.light })) problems.push(`${finish} ${header} claro: ${f}`);
        for (const f of fails({ ...tokens.color, ...tokens.colorDark, ...t.dark })) problems.push(`${finish} ${header} oscuro: ${f}`);
      }
    expect(problems).toEqual([]);
    expect(omniclinTokens({ header: "color" }).light.brand).toBe(tokens.color.accent);
    expect(omniclinTokens({ header: "light" }).light.brand).toBe("#FFFFFF");
  });

  it("el color forzado a mano se respeta en claro aunque no dé contraste, y en oscuro se corrige", () => {
    const t = brandTokens("#1F6B4F", "#C9A227", { accentOverride: "#9CCBF3" });
    expect(t.light.accent).toBe("#9CCBF3");
    expect(contrast(t.dark.accent!, t.dark.surface!)).toBeGreaterThanOrEqual(4.5);
    // Un valor que no es un color se ignora.
    expect(brandTokens("#1F6B4F", "#C9A227", { accentOverride: "azul" }).light.accent).toBe(brandTokens("#1F6B4F", "#C9A227").light.accent);
  });

  it("la hoja de estilos lleva los cinco bloques con los mismos nombres que tokens.css", () => {
    const css = brandCss(brandTokens("#7A1F3D", "#D9A441"));
    expect(css).toContain("html:root {");
    expect(css).toContain('html:root:not([data-theme="light"])');
    expect(css).toContain('html:root[data-theme="dark"]');
    expect(css).toContain(":root .theme-light");
    expect(css).toContain("@media print");
    for (const name of ["accent", "accent-hover", "accent-soft", "on-accent", "brand", "on-brand", "brand-ink", "highlight", "canvas", "surface", "border", "text", "text-muted", "focus"]) {
      expect(css, name).toContain(`--color-${name}:`);
      expect(tokens.color, name).toHaveProperty(name);
    }
    // Las variables de más (esquinas, letras) van solo en el bloque de arriba.
    const extra = brandCss(brandTokens("#7A1F3D", "#D9A441"), { "--radius-md": "0px" });
    expect(extra.split("--radius-md: 0px;").length).toBe(2);
    expect(extra.indexOf("--radius-md: 0px;")).toBeLessThan(extra.indexOf("@media"));
  });
});
