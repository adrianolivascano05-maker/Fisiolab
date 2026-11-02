import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const fontFamily = "Nunito";
loadFont({
  family: fontFamily,
  url: staticFile("fonts/nunito-latin.woff2"),
  weight: "200 1000",
});


/** Zonas seguras de Instagram (1080×1920): lo importante entre y=250 y y=1550, ≥90 px a los lados. */
export const SAFE = { top: 250, bottom: 1550, side: 90 };
/** Reparto vertical: titular arriba, subtítulos abajo, fuente debajo. */
export const LAYOUT = { headTop: 300, headBottom: 1110, subTop: 1130, subBottom: 1400, sourceY: 1440 };
