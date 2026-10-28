// Las opciones de la marca que van más allá de los dos colores (Ajustes › Marca de la clínica): paletas listas,
// estilo de la cabecera, esquinas, acabado y pareja de letras. Aquí están sus nombres, sus valores y lo que cada una
// cambia en la página; brand.ts las guarda y engine.ts las convierte en colores. Puro salvo `loadFont` (carga la letra).
import type { Corners, Finish, FontPair, HeaderStyle } from "./brand";

/** Ocho parejas de colores cuidadas, para la clínica que no tiene diseñador: un toque y listo. */
export const PALETTES: { name: string; primary: string; secondary: string }[] = [
  { name: "Bosque y oro", primary: "#1F6B4F", secondary: "#C9A227" },
  { name: "Mar y coral", primary: "#1F5F8B", secondary: "#E07A5F" },
  { name: "Pizarra y menta", primary: "#3D4A52", secondary: "#6CC39D" },
  { name: "Ciruela y arena", primary: "#6B3A5B", secondary: "#D9B88A" },
  { name: "Teja y oliva", primary: "#A5472F", secondary: "#7A8A3E" },
  { name: "Índigo y ámbar", primary: "#3B4A9E", secondary: "#E0A447" },
  { name: "Petróleo y salmón", primary: "#15696B", secondary: "#F0A48F" },
  { name: "Granate y crema", primary: "#7F2231", secondary: "#E9D8B4" },
];

export type Option<T extends string> = { id: T; label: string; hint: string };

export const HEADERS: Option<HeaderStyle>[] = [
  { id: "dark", label: "Oscura", hint: "el color principal, oscurecido, con la línea de acento" },
  { id: "color", label: "Del color principal", hint: "tal como va en los botones" },
  { id: "light", label: "Clara", hint: "blanca, con la línea de acento; para logos a color" },
];

export const CORNERS: Option<Corners>[] = [
  { id: "round", label: "Redondeadas", hint: "como hasta ahora" },
  { id: "soft", label: "Suaves", hint: "apenas redondeadas" },
  { id: "square", label: "Rectas", hint: "sin redondear" },
];
/** Los radios de cada opción, en píxeles, con los nombres de tokens.json (null: los de OmniClin). */
export const RADII: Record<Corners, Record<"sm" | "md" | "lg", number> | null> = {
  round: null,
  soft: { sm: 3, md: 5, lg: 7 },
  square: { sm: 0, md: 0, lg: 0 },
};

export const FINISHES: Option<Finish>[] = [
  { id: "matte", label: "Mate", hint: "colores planos, como hasta ahora" },
  { id: "vivid", label: "Vivo", hint: "más saturado, con un degradado suave en cabecera y botones" },
  { id: "metal", label: "Metálico", hint: "brillo y relieve, como lacado" },
];

export type Font = Option<FontPair> & {
  /** La letra de los títulos y la del texto, como valores de `font-family`. */
  display: string;
  sans: string;
  /** Carga los archivos de la letra (van dentro de la app, no se descargan de fuera); null si ya está cargada. */
  load: (() => Promise<unknown>) | null;
};
const SOURCE_SANS = "'Source Sans 3 Variable', 'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const DM_SANS = "'DM Sans Variable', 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONTS: Font[] = [
  { id: "bricolage", label: "Actual", hint: "Bricolage Grotesque y Source Sans 3", display: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', sans-serif", sans: SOURCE_SANS, load: null },
  { id: "fraunces", label: "Clásica", hint: "Fraunces y Source Sans 3", display: "'Fraunces Variable', Fraunces, Georgia, 'Times New Roman', serif", sans: SOURCE_SANS, load: () => import("@fontsource-variable/fraunces/index.css") },
  { id: "manrope", label: "Geométrica", hint: "Manrope y DM Sans", display: "'Manrope Variable', Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif", sans: DM_SANS, load: () => Promise.all([import("@fontsource-variable/manrope/index.css"), import("@fontsource-variable/dm-sans/index.css")]) },
  { id: "lora", label: "Editorial", hint: "Lora y DM Sans", display: "'Lora Variable', Lora, Georgia, 'Times New Roman', serif", sans: DM_SANS, load: () => Promise.all([import("@fontsource-variable/lora/index.css"), import("@fontsource-variable/dm-sans/index.css")]) },
];
export const fontOf = (id: FontPair): Font => FONTS.find((f) => f.id === id) ?? FONTS[0]!;

/**
 * Las variables que, además de los colores, cambian con la marca: los radios de las esquinas y las letras. Van en la
 * misma hoja de estilos que los colores (engine.ts, brandCss), encima de las de tokens.css.
 */
export function brandVars(b: { corners: Corners; font: FontPair }): Record<string, string> {
  const out: Record<string, string> = {};
  const r = RADII[b.corners];
  if (r) for (const [k, v] of Object.entries(r)) out[`--radius-${k}`] = `${v}px`;
  const f = fontOf(b.font);
  if (f.load) {
    out["--font-sans"] = f.sans;
    out["--font-display"] = f.display;
  }
  return out;
}

const loaded = new Set<FontPair>();
/** Carga la letra elegida (una vez por sesión); mientras llega, se ve la de reserva del sistema. */
export async function loadFont(id: FontPair): Promise<void> {
  const f = fontOf(id);
  if (!f.load || loaded.has(f.id)) return;
  loaded.add(f.id);
  try {
    await f.load();
  } catch {
    loaded.delete(f.id); // sin conexión y sin caché: se queda la de reserva; a la próxima se vuelve a intentar
  }
}
