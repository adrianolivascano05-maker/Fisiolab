import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const fontFamily = "Montserrat";
loadFont({
  family: fontFamily,
  url: staticFile("fonts/montserrat-latin.woff2"),
  weight: "100 900",
});


/** Zonas seguras de Instagram (1080×1920): lo importante entre y=250 y y=1550, ≥90 px a los lados. */
export const SAFE = { top: 250, bottom: 1550, side: 90 };
/** Reparto vertical: titular arriba, subtítulos abajo, fuente debajo. */
export const LAYOUT = { headTop: 300, headBottom: 1170, subTop: 1210, subBottom: 1450, sourceY: 1478 };
