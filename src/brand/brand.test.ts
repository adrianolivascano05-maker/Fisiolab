// La marca guardada: las opciones nuevas (lema, cabecera, esquinas, acabado, letra, membrete, página del paciente) se
// completan con las de OmniClin en una marca de antes, y lo que no es una opción conocida vuelve a la de OmniClin.
import { describe, expect, it } from "vitest";
import { brandProblem, cleanBrand, emptyBrand, ownIdentity, tokensOf, type Brand } from "./brand";
import tokens from "../styles/tokens.json";
import { brandVars, FONTS, PALETTES, RADII } from "./options";

describe("la marca y sus opciones", () => {
  it("una marca de antes (solo nombre, colores y logo) se completa con las opciones de OmniClin", () => {
    const old = { v: 1, name: "Clínica Aurora", primary: "#7a1f3d", secondary: "#D9A441", logo: null, logoPlate: true, watermark: true, accentOverride: null } as unknown as Brand;
    const b = cleanBrand(old);
    expect(b).toMatchObject({ primary: "#7A1F3D", slogan: "", header: "dark", corners: "round", finish: "matte", font: "bricolage" });
    expect(b.letterhead).toEqual({ logo: "right", contact: true, band: false, footer: "" });
    expect(b.patient).toEqual({ welcome: "", contact: true });
    expect(brandProblem(b)).toBeNull();
  });

  it("la identidad de OmniClin no exige nombre, no cuenta como marca propia y usa los colores de OmniClin", () => {
    const b = cleanBrand({ ...emptyBrand(""), identity: "omniclin", corners: "square" });
    expect(b.identity).toBe("omniclin");
    expect(brandProblem(b)).toBeNull();
    expect(ownIdentity(b)).toBeNull();
    expect(ownIdentity(emptyBrand("X"))).not.toBeNull();
    expect(ownIdentity(null)).toBeNull();
    expect(tokensOf(b).light.brand).toBe(tokens.color.brand);
    // Una marca de antes (sin identidad) es la propia de la clínica, y la propia sí exige nombre.
    expect(cleanBrand({ ...emptyBrand("X"), identity: undefined as never }).identity).toBe("own");
    expect(brandProblem(emptyBrand(""))).toMatch(/nombre/);
  });

  it("recorta los textos, y una opción desconocida vuelve a la de OmniClin", () => {
    const b = cleanBrand({ ...emptyBrand("X"), slogan: "  Fisioterapia  ", header: "neon" as never, corners: "square", finish: "metal", font: "comic" as never, letterhead: { logo: "center", contact: false, band: true, footer: " www.x.es " }, patient: { welcome: " Hola ", contact: false } });
    expect(b).toMatchObject({ slogan: "Fisioterapia", header: "dark", corners: "square", finish: "metal", font: "bricolage" });
    expect(b.letterhead).toEqual({ logo: "center", contact: false, band: true, footer: "www.x.es" });
    expect(b.patient).toEqual({ welcome: "Hola", contact: false });
    expect(brandProblem({ ...emptyBrand("X"), slogan: "a".repeat(61) })).toMatch(/lema/);
    expect(brandProblem({ ...emptyBrand("X"), letterhead: { ...emptyBrand().letterhead, footer: "a".repeat(121) } })).toMatch(/pie/);
    expect(brandProblem({ ...emptyBrand("X"), patient: { welcome: "a".repeat(201), contact: true } })).toMatch(/bienvenida/);
  });

  it("las esquinas y la letra se traducen a variables; las de OmniClin no ponen ninguna", () => {
    expect(brandVars({ corners: "round", font: "bricolage" })).toEqual({});
    expect(brandVars({ corners: "square", font: "bricolage" })).toEqual({ "--radius-sm": "0px", "--radius-md": "0px", "--radius-lg": "0px" });
    expect(brandVars({ corners: "soft", font: "fraunces" })).toMatchObject({ "--radius-md": `${RADII.soft!.md}px`, "--font-display": expect.stringContaining("Fraunces") });
    expect(FONTS.map((f) => f.id)).toEqual(["bricolage", "fraunces", "manrope", "lora"]);
    expect(PALETTES).toHaveLength(8);
    for (const p of PALETTES) expect(`${p.primary}${p.secondary}`).toMatch(/^#[0-9A-F]{6}#[0-9A-F]{6}$/);
  });
});
