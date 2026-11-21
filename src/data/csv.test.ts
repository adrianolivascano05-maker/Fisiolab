// Celdas de CSV (csv.ts): sin fórmulas al abrirlas en una hoja de cálculo.
import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("celdas de CSV", () => {
  it("un texto que empieza como una fórmula se queda en texto", () => {
    expect(csvCell('=HYPERLINK("https://x.example";"pulsa")')).toBe(`"'=HYPERLINK(""https://x.example"";""pulsa"")"`);
    for (const s of ["+34 600", "-sin dolor", "@SUMA(A1)", "\tcmd", "\rx"]) expect(csvCell(s).startsWith(`"'`)).toBe(true);
  });
  it("los números, también negativos, y el texto normal no cambian", () => {
    expect(csvCell("-12,50")).toBe("-12,50");
    expect(csvCell("3")).toBe("3");
    expect(csvCell("Lucía García")).toBe("Lucía García");
    expect(csvCell("uno; dos")).toBe('"uno; dos"');
    expect(csvCell("Ana", { quote: true })).toBe('"Ana"');
  });
});
