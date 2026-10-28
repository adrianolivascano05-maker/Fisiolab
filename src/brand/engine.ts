// Motor de la marca por clínica: de dos colores (el principal y el de acento) salen todos los colores de la app en
// claro y en oscuro, con el contraste de WCAG AA garantizado. Trabaja en OKLCH (claridad, croma y matiz que se ven
// como tales) y, cuando un color no da contraste, lo oscurece o lo aclara sin cambiar su matiz. Los nombres de los
// colores son los de src/styles/tokens.json; lo que no está aquí (peligro, aviso, éxito, medios) no cambia de marca.
// Puro: sin DOM. La prueba engine.test.ts comprueba las parejas de contraste de tokens.json con cientos de colores.

export type Lch = { L: number; C: number; h: number };
export type Tokens = Record<string, string>;
export type BrandTokens = { light: Tokens; dark: Tokens };

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
}
function rgbToHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab([r0, g0, b0]: [number, number, number]): [number, number, number] {
  const [r, g, b] = [lin(r0), lin(g0), lin(b0)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, a, b]: [number, number, number]): number[] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

/** Un color en OKLCH: claridad 0–1, croma (0 = gris) y matiz en grados. */
export function toLch(hex: string): Lch {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * (180 / Math.PI) + 360) % 360 };
}

/** De OKLCH a hexadecimal, bajando el croma hasta que el color quepa en la pantalla (sRGB). */
export function fromLch({ L, C, h }: Lch): string {
  const rad = (h * Math.PI) / 180;
  for (let c = C; c >= 0; c -= 0.004) {
    const rgb = oklabToRgb([L, c * Math.cos(rad), c * Math.sin(rad)]);
    if (rgb.every((v) => v >= -0.002 && v <= 1.002)) return rgbToHex(rgb);
  }
  return rgbToHex(oklabToRgb([L, 0, 0]));
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
/** Contraste de WCAG entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Oscurece (dir -1) o aclara (dir +1) `hex` sobre `bg` hasta dar `min` de contraste, sin cambiar el matiz. */
export function fit(hex: string, bg: string, min: number, dir: -1 | 1): string {
  const c = toLch(hex);
  let out = fromLch(c);
  for (let i = 0; i < 90 && contrast(out, bg) < min; i++) {
    c.L = clamp(c.L + dir * 0.01, 0.02, 0.99);
    out = fromLch(c);
  }
  return out;
}

/** La escala de tonos de un color, de 50 (casi blanco) a 900 (casi negro), para el apartado avanzado. */
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const SCALE_L = [0.97, 0.93, 0.87, 0.79, 0.7, 0.61, 0.52, 0.44, 0.36, 0.28];
export function scale(hex: string): { step: number; hex: string }[] {
  const { C, h } = toLch(hex);
  return SCALE_STEPS.map((step, i) => {
    const L = SCALE_L[i]!;
    const bell = C * Math.sin(Math.PI * clamp((L - 0.12) / 0.85, 0, 1)) * 1.15;
    return { step, hex: fromLch({ L, C: Math.min(C + 0.03, bell), h }) };
  });
}

/**
 * El color de acento sobre la cabecera (la línea de abajo y los destacados) y el texto que va encima. Sobre una
 * cabecera oscura el acento se aclara hasta separarse de ella (3:1); sobre una clara (la cabecera «clara» o la del
 * color de los botones en modo oscuro) se oscurece. Si ni el texto oscuro ni el blanco se leen encima, se sigue en la
 * misma dirección hasta que uno se lea (lo que nunca le quita contraste con la cabecera).
 */
function highlightPair(secondary: string, brand: string, darkText: string): [string, string] {
  const dir: -1 | 1 = contrast("#FFFFFF", brand) >= 4.5 ? +1 : -1;
  let highlight = fit(secondary, brand, 3, dir);
  if (contrast(darkText, highlight) < 4.5 && contrast("#FFFFFF", highlight) < 4.5) highlight = fit(highlight, dir === 1 ? darkText : "#FFFFFF", 4.5, dir);
  return [highlight, contrast(darkText, highlight) >= contrast("#FFFFFF", highlight) ? darkText : "#FFFFFF"];
}

export type BrandOptions = {
  /** El color de los botones en claro, puesto a mano (apartado avanzado); si no, lo calcula el motor. */
  accentOverride?: string | null;
  /** Vivo y metálico suben el croma de los dos colores antes de calcular nada; el contraste se corrige igual. */
  finish?: "matte" | "vivid" | "metal";
  /** La cabecera: oscura (lo de siempre), del color principal tal cual, o clara con la línea de acento. */
  header?: "dark" | "color" | "light";
};

/** Sube el croma (la viveza) de un color, hasta lo que cabe en pantalla. */
function saturate(hex: string, factor: number): string {
  const c = toLch(hex);
  return fromLch({ ...c, C: Math.min(0.32, c.C * factor) });
}

/**
 * Todos los colores de la marca a partir del principal y el de acento. Los neutros (fondo, bordes, texto) toman un
 * poco del matiz del principal; los de acción salen del principal con el contraste corregido; el de acento va a la
 * línea de la cabecera y a los destacados.
 */
export function brandTokens(primary: string, secondary: string, opts: BrandOptions = {}): BrandTokens {
  if (opts.finish === "vivid" || opts.finish === "metal") {
    primary = saturate(primary, opts.finish === "vivid" ? 1.45 : 1.3);
    secondary = saturate(secondary, 1.3);
  }
  const p = toLch(primary);
  const tint = (L: number, C: number) => fromLch({ L, C, h: p.h });
  const darkText = tint(0.14, 0.03);
  const soft = (L: number, c: Lch) => fromLch({ L, C: Math.min(0.06, c.C * 0.6), h: c.h });

  // ---- Claro: tarjetas blancas; lo más oscuro de los fondos claros es «surface», que es contra lo que se ajusta.
  const light: Tokens = {
    canvas: tint(0.965, 0.008),
    bg: "#FFFFFF",
    surface: tint(0.93, 0.014),
    border: tint(0.85, 0.02),
    text: tint(0.22, 0.02),
  };
  light["accent-soft"] = soft(0.93, p);
  const darkestLight = [light.surface!, light["accent-soft"]].sort((a, b) => luminance(a) - luminance(b))[0]!;
  light["border-input"] = fit(tint(0.58, 0.03), darkestLight, 3, -1);
  light["text-muted"] = fit(tint(0.46, 0.03), darkestLight, 4.5, -1);
  const manual = opts.accentOverride && isHex(opts.accentOverride) ? opts.accentOverride : null;
  light.accent = manual ?? fit(primary, darkestLight, 4.5, -1);
  light["accent-hover"] = fit(light.accent, darkestLight, 5.5, -1);
  light["on-accent"] = contrast("#FFFFFF", light.accent) >= contrast(light.text, light.accent) ? "#FFFFFF" : light.text;
  light.focus = light.accent;
  light["chart-primary"] = light.accent;
  light["brand-ink"] = fit(primary, darkestLight, 4.5, -1);
  // La cabecera: el principal, bastante oscuro, con texto casi blanco.
  let brand = p.L > 0.42 ? fromLch({ L: 0.36, C: Math.min(p.C, 0.12), h: p.h }) : fromLch({ L: Math.max(p.L, 0.2), C: Math.min(p.C, 0.12), h: p.h });
  brand = fit(brand, tint(0.96, 0.02), 4.5, -1);
  light.brand = brand;
  light["on-brand"] = tint(0.96, 0.02);
  [light.highlight, light["on-highlight"]] = highlightPair(secondary, brand, darkText);

  // ---- Oscuro: fondos oscuros teñidos; «surface» y «accent-soft» son los más claros, contra los que se ajusta.
  const dark: Tokens = {
    canvas: tint(0.16, 0.012),
    bg: tint(0.2, 0.014),
    surface: tint(0.25, 0.016),
    border: tint(0.34, 0.02),
    text: tint(0.93, 0.01),
  };
  dark["accent-soft"] = soft(0.3, p);
  const lightestDark = [dark.surface!, dark["accent-soft"]].sort((a, b) => luminance(b) - luminance(a))[0]!;
  dark["border-input"] = fit(tint(0.55, 0.03), lightestDark, 3, +1);
  dark["text-muted"] = fit(tint(0.7, 0.02), lightestDark, 4.5, +1);
  dark.accent = fit(manual ?? primary, lightestDark, 4.5, +1);
  dark["accent-hover"] = fit(dark.accent, lightestDark, 6, +1);
  dark["on-accent"] = tint(0.14, 0.03);
  dark.focus = dark.accent;
  dark["chart-primary"] = dark.accent;
  dark["brand-ink"] = dark.accent;
  dark.brand = tint(0.24, Math.min(0.08, p.C));
  dark["on-brand"] = tint(0.9, 0.03);
  [dark.highlight, dark["on-highlight"]] = highlightPair(secondary, dark.brand, darkText);

  // ---- La cabecera, si no es la oscura: del color de los botones (con su texto) o clara (el fondo con la tinta de la
  // marca); la línea de acento se vuelve a ajustar contra el fondo nuevo.
  if (opts.header === "color") {
    light.brand = light.accent;
    light["on-brand"] = light["on-accent"];
    dark.brand = dark.accent;
    dark["on-brand"] = dark["on-accent"];
  } else if (opts.header === "light") {
    light.brand = light.bg!;
    light["on-brand"] = light["brand-ink"];
    dark.brand = dark.bg!;
    dark["on-brand"] = dark.text!;
  }
  if (opts.header === "color" || opts.header === "light") {
    [light.highlight, light["on-highlight"]] = highlightPair(secondary, light.brand, darkText);
    [dark.highlight, dark["on-highlight"]] = highlightPair(secondary, dark.brand, darkText);
  }
  // El segundo color del logo de OmniClin sobre la cabecera no se ve con marca de clínica; se iguala a la línea de acento
  // para que la pareja de contraste de tokens.json se cumpla también.
  light["on-brand-accent"] = light.highlight;
  dark["on-brand-accent"] = dark.highlight;
  // Un paso más claro y uno más oscuro de la cabecera, los botones y los destacados: los degradados y brillos del
  // acabado vivo y metálico (index.css). No cambian el color de ningún texto.
  for (const t of [light, dark])
    for (const k of ["brand", "accent", "highlight"]) {
      const c = toLch(t[k]!);
      t[`${k}-hi`] = fromLch({ L: Math.min(0.98, c.L + 0.09), C: Math.min(0.32, c.C * 1.15), h: c.h });
      t[`${k}-lo`] = fromLch({ L: Math.max(0.05, c.L - 0.08), C: c.C, h: c.h });
    }
  return { light, dark };
}

const vars = (t: Tokens, indent = "  ") =>
  Object.entries(t)
    .map(([k, v]) => `${indent}--color-${k}: ${v};`)
    .join("\n");

/**
 * La hoja de estilos de la marca: los mismos nombres y la misma estructura que tokens.css (claro, oscuro por el
 * ajuste del dispositivo, oscuro a mano, documentos en claro e impresión), con un selector un punto más específico
 * para ganar siempre, se cargue en el orden que se cargue. `extra`: otras variables que cambian con la marca y no
 * dependen del modo (los radios de las esquinas y las letras, src/brand/options.ts); van en el bloque de arriba.
 */
export function brandCss({ light, dark }: BrandTokens, extra: Record<string, string> = {}): string {
  const extras = Object.entries(extra).map(([k, v]) => `  ${k}: ${v};`);
  return [
    `html:root {\n${[vars(light), ...extras].join("\n")}\n}`,
    `@media (prefers-color-scheme: dark) {\n  html:root:not([data-theme="light"]) {\n${vars(dark, "    ")}\n  }\n}`,
    `html:root[data-theme="dark"] {\n${vars(dark)}\n}`,
    `:root .theme-light {\n${vars(light)}\n}`,
    `@media print {\n  html:root, html:root[data-theme] {\n${vars(light, "    ")}\n  }\n}`,
  ].join("\n");
}
