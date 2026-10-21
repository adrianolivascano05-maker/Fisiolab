import { describe, expect, it } from "vitest";
import { galleryTests, testsByRegion, testsForRegions } from "./galleryLink";

describe("tests de las zonas de la anamnesis", () => {
  it("salen todos los de la zona, también grupos de tests y reglas", () => {
    const knee = testsForRegions(["rodilla"]);
    expect(knee.length).toBe(galleryTests.filter((t) => t.region === "rodilla").length);
    expect(testsForRegions(["tobillo_pie"]).some((t) => t.kind === "rule")).toBe(true);
  });

  it("con varias zonas, cada una tiene los suyos (ninguna se queda sin tests)", () => {
    const groups = testsByRegion(["hombro", "atm"]);
    expect(groups.map((g) => g.region)).toEqual(["hombro", "atm"]);
    for (const g of groups) expect(g.tests.length).toBe(galleryTests.filter((t) => t.region === g.region).length);
  });
});
