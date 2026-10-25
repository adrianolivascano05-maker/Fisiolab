// La marca en la página que abre el paciente: el nombre, los dos colores y una versión pequeña del logo viajan dentro
// del sobre cifrado del formulario (FormRequest.brand), igual que el nombre de la clínica. El servidor sigue sin ver
// nada. Los formularios enviados antes de haber marca no la llevan y se abren con la de Cénit.
import { cleanBrand, brandProblem, type Brand } from "./brand";
import { shrinkLogo } from "./logo";

/** Lo que viaja en el formulario: sin la marca de agua (no hay documentos) y con el logo reducido. */
export type FormBrand = Pick<Brand, "name" | "primary" | "secondary" | "logo" | "logoPlate" | "accentOverride">;

/** Lado del logo que va en el formulario: de sobra para la cabecera del móvil y pesa poco (el sobre tiene límite). */
export const FORM_LOGO_SIDE = 160;

export async function formBrand(b: Brand | null): Promise<FormBrand | undefined> {
  if (!b) return undefined;
  return { name: b.name, primary: b.primary, secondary: b.secondary, logo: b.logo ? await shrinkLogo(b.logo, FORM_LOGO_SIDE) : null, logoPlate: b.logoPlate, accentOverride: b.accentOverride };
}

/** La marca que trae un formulario, comprobada (viene de fuera): null si no trae o no es válida. */
export function brandFromForm(v: unknown): Brand | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Partial<FormBrand>;
  if (typeof f.name !== "string" || typeof f.primary !== "string" || typeof f.secondary !== "string") return null;
  const brand = cleanBrand({
    v: 1,
    name: f.name,
    primary: f.primary,
    secondary: f.secondary,
    logo: typeof f.logo === "string" ? f.logo : null,
    logoPlate: f.logoPlate !== false,
    watermark: false,
    accentOverride: typeof f.accentOverride === "string" ? f.accentOverride : null,
  });
  return brandProblem(brand) ? null : brand;
}
