// La marca en la página que abre el paciente: el nombre, los dos colores, una versión pequeña del logo y las opciones
// de aspecto (lema, cabecera, esquinas, acabado, letra y lo propio de esa página) viajan dentro del sobre cifrado del
// formulario (FormRequest.brand), igual que el nombre de la clínica. El servidor sigue sin ver nada. Los formularios
// enviados antes de haber marca no la llevan y se abren con la de OmniClin.
import { cleanBrand, brandProblem, emptyBrand, type Brand } from "./brand";
import { shrinkLogo } from "./logo";

/**
 * Lo que viaja en el formulario: sin la marca de agua ni el membrete (no hay documentos) y con el logo reducido.
 * `contact`: el teléfono y el correo de la clínica (Ajustes › Clínica) para el pie de la página, si la clínica lo quiere.
 */
export type FormBrand = Pick<Brand, "identity" | "name" | "primary" | "secondary" | "logo" | "logoPlate" | "accentOverride" | "slogan" | "header" | "corners" | "finish" | "font" | "patient"> & { contact?: string };

/** La línea de contacto que va al pie de la página del paciente: teléfono y correo, lo que haya. */
export const contactLine = (c: { phone?: string; email?: string }) => [c.phone?.trim(), c.email?.trim()].filter(Boolean).join(" · ");

/** Lado del logo que va en el formulario: de sobra para la cabecera del móvil y pesa poco (el sobre tiene límite). */
export const FORM_LOGO_SIDE = 160;

export async function formBrand(b: Brand | null, clinic: { phone?: string; email?: string } = {}): Promise<FormBrand | undefined> {
  if (!b) return undefined;
  const contact = b.patient.contact ? contactLine(clinic) : "";
  return {
    ...(contact ? { contact } : {}),
    identity: b.identity,
    name: b.name,
    primary: b.primary,
    secondary: b.secondary,
    logo: b.logo ? await shrinkLogo(b.logo, FORM_LOGO_SIDE) : null,
    logoPlate: b.logoPlate,
    accentOverride: b.accentOverride,
    slogan: b.slogan,
    header: b.header,
    corners: b.corners,
    finish: b.finish,
    font: b.font,
    patient: b.patient,
  };
}

/** La marca que trae un formulario, comprobada (viene de fuera): null si no trae o no es válida. */
export function brandFromForm(v: unknown): Brand | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Partial<FormBrand>;
  if (typeof f.name !== "string" || typeof f.primary !== "string" || typeof f.secondary !== "string") return null;
  // cleanBrand deja cada opción entre las conocidas (la identidad incluida) (y la de OmniClin si no lo es).
  const brand = cleanBrand({
    ...emptyBrand(),
    ...f,
    name: f.name,
    primary: f.primary,
    secondary: f.secondary,
    logo: typeof f.logo === "string" ? f.logo : null,
    logoPlate: f.logoPlate !== false,
    watermark: false,
    accentOverride: typeof f.accentOverride === "string" ? f.accentOverride : null,
  } as Brand);
  return brandProblem(brand) ? null : brand;
}
