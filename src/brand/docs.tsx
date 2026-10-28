// La marca en los documentos (informes, justificantes, recibos, hojas de ejercicios, consentimientos): los colores
// del documento como variables en su propio recuadro, la marca de agua y el pie. Un documento firmado guarda la
// marca con la que se firmó (ConsentDocument.brand) y se pinta siempre con esa; sin marca guardada, con la de OmniClin.
import type { CSSProperties } from "react";
import tokens from "../styles/tokens.json";
import { initialIcon, tokensOf, type Brand } from "./brand";
import { brandTokens } from "./engine";

/** Lo que figura al pie de todo documento, sea cual sea la marca de la clínica. */
export const MADE_WITH = "Documento generado con OmniClin.";

/** Los nombres de color que cambia una marca: para congelar los de OmniClin en los documentos sin marca. */
const BRAND_KEYS = Object.keys(brandTokens("#1F6B4F", "#C9A227").light);
const CENIT_LIGHT: Record<string, string> = Object.fromEntries(BRAND_KEYS.map((k) => [k, (tokens.color as Record<string, string>)[k]!]));

/** Las variables de color de un documento: las de su marca o, sin marca, las de OmniClin (en claro, como el papel). */
export function docVars(brand: Brand | null | undefined): CSSProperties {
  const t = brand ? tokensOf(brand).light : CENIT_LIGHT;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [`--color-${k}`, v])) as CSSProperties;
}

/** La imagen de la marca de agua: el logo o, sin logo, la inicial sobre el color principal. */
export function watermarkSrc(brand: Brand): string {
  return brand.logo ?? initialIcon(brand, 512);
}

/**
 * La marca de agua en pantalla y al imprimir: el logo en gris, al 7 %, en el tercio superior (nunca sobre las
 * firmas, que van al final). En pantalla va fija al principio del documento; al imprimir, en cada hoja. El PDF
 * (reportPdf.ts) la esconde y la dibuja él en cada página. El documento tiene que ser `relative`.
 */
export function Watermark({ brand }: { brand: Brand | null | undefined }) {
  if (!brand?.watermark) return null;
  return (
    <div data-watermark aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center print:fixed print:top-[16%]">
      <img src={watermarkSrc(brand)} alt="" className="w-[55%] max-w-[55%] object-contain" style={{ opacity: 0.07, filter: "grayscale(1)" }} />
    </div>
  );
}
