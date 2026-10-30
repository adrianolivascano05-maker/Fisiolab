import { describe, expect, it } from "vitest";
import { WrongPassword } from "../cloud/crypt";
import { checkExportPassword, decryptExport, encryptedInnerName, encryptedName, encryptExport, isEncryptedExport } from "./encryptedExport";

describe("copia cifrada con contraseña (.omniclin)", () => {
  const zip = new TextEncoder().encode("PK\u0003\u0004 LEEME.txt Lucía Pérez, rodilla derecha");

  it("cifra y descifra los mismos bytes, con el nombre del archivo de dentro; nada se lee en claro", async () => {
    const enc = await encryptExport(zip, "OmniClin-Fisiolab-2026-10-30.zip", "frase larga de la clínica");
    expect(isEncryptedExport(enc)).toBe(true);
    expect(isEncryptedExport(zip)).toBe(false);
    expect(new TextDecoder("latin1").decode(enc)).toContain("OMNIEXP1");
    expect(new TextDecoder("latin1").decode(enc)).not.toContain("Lucía");
    expect(new TextDecoder("latin1").decode(enc)).not.toContain("LEEME");
    expect(encryptedInnerName(enc)).toBe("OmniClin-Fisiolab-2026-10-30.zip");
    const opened = await decryptExport(enc, "frase larga de la clínica");
    expect(opened.name).toBe("OmniClin-Fisiolab-2026-10-30.zip");
    expect(opened.bytes).toEqual(zip);
  });

  it("con otra contraseña, con el nombre cambiado o con los datos tocados no abre; un archivo cualquiera tampoco", async () => {
    const enc = await encryptExport(zip, "copia.sqlite3", "frase larga de la clínica");
    await expect(decryptExport(enc, "otra frase larga 123")).rejects.toBeInstanceOf(WrongPassword);
    const renamed = enc.slice();
    renamed[8 + 16 + 12 + 1] ^= 1;
    await expect(decryptExport(renamed, "frase larga de la clínica")).rejects.toBeInstanceOf(WrongPassword);
    const tampered = enc.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decryptExport(tampered, "frase larga de la clínica")).rejects.toBeInstanceOf(WrongPassword);
    await expect(decryptExport(zip, "frase larga de la clínica")).rejects.toThrow("no es una copia cifrada");
  });

  it("exige 10 caracteres y que las dos coincidan; el archivo cifrado se llama como el de dentro más «-cifrado.omniclin»", async () => {
    expect(checkExportPassword("corta", "corta")).toMatch(/al menos 10/);
    expect(checkExportPassword("frase larga 1", "frase larga 2")).toBe("Las dos contraseñas no coinciden.");
    expect(checkExportPassword("frase larga 1", "frase larga 1")).toBeNull();
    await expect(encryptExport(zip, "x.zip", "corta")).rejects.toThrow("al menos 10");
    expect(encryptedName("OmniClin-Fisiolab-2026-10-30.zip")).toBe("OmniClin-Fisiolab-2026-10-30-cifrado.omniclin");
    expect(encryptedName("fisiolab-copia-2026-10-30.sqlite3")).toBe("fisiolab-copia-2026-10-30-cifrado.omniclin");
  });
});
