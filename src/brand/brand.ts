// La marca de la clínica: su nombre, dos colores, el logo y cómo se usan. Se guarda en los ajustes de la base de la
// clínica (cifrada y sincronizada, como todo) y se aplica a la página como una hoja de estilos encima de la de Cénit
// (src/brand/engine.ts). Sin marca guardada, la app es Cénit tal cual. Para que no se vea Cénit un instante al abrir,
// la última marca aplicada se guarda también en este navegador y se pone antes de pintar (main.tsx); en cuanto la
// base está abierta se comprueba (DbGate).
import { useSyncExternalStore } from "react";
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { brandCss, brandTokens, isHex, type BrandTokens } from "./engine";

export type Brand = {
  v: 1;
  /** El nombre que se ve en la barra, la pestaña y los documentos. */
  name: string;
  /** Color principal (botones, cabecera, enlaces) y de acento (línea de la cabecera, destacados), en hexadecimal. */
  primary: string;
  secondary: string;
  /** El logo como data: URL (PNG reducido o SVG pequeño), o null para usar la inicial del nombre. */
  logo: string | null;
  /** En fondos oscuros, el logo va sobre una placa blanca. */
  logoPlate: boolean;
  /** Marca de agua con el logo en los documentos (la usan los documentos desde el bloque 2). */
  watermark: boolean;
  /** El color de los botones en claro puesto a mano (apartado avanzado), o null. */
  accentOverride: string | null;
};

export const BRAND_KEY = "clinic_brand";
/** Los colores de Cénit, para empezar desde ellos. */
export const CENIT_PRIMARY = "#1F6B4F";
export const CENIT_SECONDARY = "#C9A227";
export const MAX_NAME = 60;
/** El logo guardado no pasa de esto (va en la base y se sincroniza): un PNG de 512 px comprimido cabe de sobra. */
export const MAX_LOGO_CHARS = 200_000;

export function emptyBrand(name = ""): Brand {
  return { v: 1, name, primary: CENIT_PRIMARY, secondary: CENIT_SECONDARY, logo: null, logoPlate: true, watermark: true, accentOverride: null };
}

/** Comprueba lo que va a guardarse; devuelve el texto del fallo o null si está bien. */
export function brandProblem(b: Brand): string | null {
  if (!b.name.trim()) return "Escribe el nombre de la clínica.";
  if (b.name.trim().length > MAX_NAME) return `El nombre no puede pasar de ${MAX_NAME} caracteres.`;
  if (!isHex(b.primary) || !isHex(b.secondary)) return "Los colores tienen que ser hexadecimales, como #1F6B4F.";
  if (b.accentOverride && !isHex(b.accentOverride)) return "El color forzado de los botones tiene que ser hexadecimal, como #1F6B4F.";
  if (b.logo && (b.logo.length > MAX_LOGO_CHARS || !/^data:image\/(png|svg\+xml);base64,/.test(b.logo))) return "El logo tiene que ser un PNG o un SVG pequeño.";
  return null;
}

/** La marca tal como se guarda: sin espacios de más y con los colores en mayúsculas. */
export function cleanBrand(b: Brand): Brand {
  return {
    v: 1,
    name: b.name.trim(),
    primary: b.primary.toUpperCase(),
    secondary: b.secondary.toUpperCase(),
    logo: b.logo,
    logoPlate: !!b.logoPlate,
    watermark: !!b.watermark,
    accentOverride: b.accentOverride && isHex(b.accentOverride) ? b.accentOverride.toUpperCase() : null,
  };
}

export function tokensOf(b: Brand): BrandTokens {
  return brandTokens(b.primary, b.secondary, { accentOverride: b.accentOverride });
}

// ---------- Guardar y leer ----------

function parseBrand(v: unknown): Brand | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Partial<Brand>;
  if (typeof b.name !== "string" || typeof b.primary !== "string" || typeof b.secondary !== "string") return null;
  const brand = cleanBrand({ ...emptyBrand(), ...b, logo: typeof b.logo === "string" ? b.logo : null, accentOverride: typeof b.accentOverride === "string" ? b.accentOverride : null });
  return brandProblem(brand) ? null : brand;
}

export async function getBrand(db: Db): Promise<Brand | null> {
  return parseBrand(await getSetting<unknown>(db, BRAND_KEY));
}

/** Guarda la marca (o la quita con null) y la aplica a la página. */
export async function saveBrand(db: Db, b: Brand | null): Promise<void> {
  if (b) {
    const problem = brandProblem(b);
    if (problem) throw new RangeError(problem);
  }
  await setSetting(db, BRAND_KEY, b ? cleanBrand(b) : null);
  applyBrand(b ? cleanBrand(b) : null);
}

/** Lee la marca de la base y la aplica (al abrir la base). */
export async function loadBrand(db: Db): Promise<void> {
  try {
    applyBrand(await getBrand(db));
  } catch {
    /* sin ajustes aún (base recién creada): se queda Cénit */
  }
}

// ---------- Aplicar a la página ----------

const CACHE_KEY = "fisiolab.brand";
const STYLE_ID = "brand-css";
let current: Brand | null = null;
const listeners = new Set<() => void>();
let originalIcon: string | null = null;
let originalTitle: string | null = null;

/** La marca que está puesta ahora (null: Cénit). */
export function useBrand(): Brand | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
export const currentBrand = () => current;

/** Antes de pintar nada: la última marca que se aplicó en este navegador. */
export function applyCachedBrand() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) applyBrand(parseBrand(JSON.parse(raw)), false);
  } catch {
    /* sin almacenamiento o caché rota: Cénit hasta que abra la base */
  }
}

export function applyBrand(b: Brand | null, remember = true) {
  if (typeof document === "undefined") return;
  current = b;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (b) {
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.append(style);
    }
    style.textContent = brandCss(tokensOf(b));
  } else style?.remove();
  applyIcon(b);
  applyTitle(b);
  syncThemeColor();
  if (remember) {
    try {
      if (b) localStorage.setItem(CACHE_KEY, JSON.stringify(b));
      else localStorage.removeItem(CACHE_KEY);
    } catch {
      /* sin almacenamiento: se aplicará al abrir la base */
    }
  }
  for (const l of listeners) l();
}

function applyIcon(b: Brand | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  if (originalIcon === null) originalIcon = link.href;
  link.href = b ? (b.logo ?? initialIcon(b)) : originalIcon;
}

function applyTitle(b: Brand | null) {
  if (originalTitle === null) originalTitle = document.title;
  document.title = b ? b.name : originalTitle;
}

/** El color de la barra del navegador en el móvil: el de la cabecera, en el modo que esté puesto. */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  if (!current) return void (meta.content = "#0E3B2E");
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "dark" || (theme !== "light" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
  const t = tokensOf(current);
  meta.content = (dark ? t.dark.brand : t.light.brand) ?? "#0E3B2E";
}

/** Un icono con la inicial del nombre sobre el color principal: la pestaña (64 px) o la marca de agua (512 px) sin logo. */
export function initialIcon(b: Pick<Brand, "name" | "primary" | "secondary" | "accentOverride">, size = 64): string {
  const t = brandTokens(b.primary, b.secondary, { accentOverride: b.accentOverride });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  if (!x) return "";
  x.fillStyle = t.light.accent!;
  x.beginPath();
  x.roundRect(0, 0, size, size, size / 4);
  x.fill();
  x.fillStyle = t.light["on-accent"]!;
  x.font = `700 ${Math.round(size * 0.6)}px 'Bricolage Grotesque', system-ui, sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(initialOf(b.name), size / 2, size * 0.55);
  return c.toDataURL("image/png");
}

export const initialOf = (name: string) => (name.trim()[0] ?? "C").toUpperCase();
