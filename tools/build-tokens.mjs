// Genera src/styles/tokens.css desde replica/design/tokens.json.
// El bloque @theme de Tailwind 4 crea las variables CSS y las clases (bg-surface, text-muted...).
// Se vacían los valores por defecto de Tailwind para que solo existan los roles del sistema.
import { readFileSync, writeFileSync } from "node:fs";

const src = new URL("../replica/design/tokens.json", import.meta.url);
const out = new URL("../src/styles/tokens.css", import.meta.url);
const t = JSON.parse(readFileSync(src, "utf8"));
const px = (n) => `${n}px`;

const lines = [
  "/* Generado por tools/build-tokens.mjs desde replica/design/tokens.json. No editar a mano. */",
  "@theme {",
  "  --color-*: initial;",
  "  --color-white: #ffffff;",
  "  --color-transparent: transparent;",
  "  --color-current: currentColor;",
];
for (const [name, value] of Object.entries(t.color)) lines.push(`  --color-${name}: ${value};`);

lines.push("", "  --font-*: initial;", `  --font-sans: ${t.font.sans};`, `  --font-display: ${t.font.display ?? t.font.sans};`, `  --font-mono: ${t.font.mono};`);

lines.push("", "  --text-*: initial;");
for (const [name, s] of Object.entries(t.type)) {
  lines.push(`  --text-${name}: ${px(s.size)};`);
  lines.push(`  --text-${name}--line-height: ${px(s.line)};`);
  lines.push(`  --text-${name}--font-weight: ${s.weight};`);
}

// La escala de espaciado es de base 4: p-1 = 4px, p-4 = 16px, p-12 = 48px.
lines.push("", `  --spacing: ${px(t.space[1])};`);

lines.push("", "  --radius-*: initial;");
for (const [name, v] of Object.entries(t.radius)) lines.push(`  --radius-${name}: ${px(v)};`);

lines.push("", "  --shadow-*: initial;");
for (const [name, v] of Object.entries(t.shadow)) lines.push(`  --shadow-${name}: ${v};`);

lines.push("", `  --ease-standard: ${t.motion.ease};`);
lines.push("}", "", ":root {");
lines.push(`  --motion-fast: ${t.motion.fast};`, `  --motion-base: ${t.motion.base};`);
for (const [name, v] of Object.entries(t.layout)) lines.push(`  --layout-${name}: ${px(v)};`);
lines.push("}", "");

writeFileSync(out, lines.join("\n"));
console.log(`tokens: ${Object.keys(t.color).length} colores -> src/styles/tokens.css`);
