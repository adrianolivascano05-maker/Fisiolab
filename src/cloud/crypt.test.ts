import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, isEncrypted, newSalt, saltOf, WrongPassword } from "./crypt";

describe("cifrado de la copia de Drive", () => {
  const bytes = new TextEncoder().encode("SQLite format 3\u0000 Lucía Pérez, rodilla derecha");

  it("cifra y descifra con la misma contraseña; el nombre no se ve en lo cifrado", async () => {
    const salt = newSalt();
    const key = await deriveKey("contraseña de la clínica", salt);
    const enc = await encrypt(bytes, key, salt);
    expect(isEncrypted(enc)).toBe(true);
    expect(isEncrypted(bytes)).toBe(false);
    expect(saltOf(enc)).toBe(salt);
    expect(new TextDecoder("latin1").decode(enc)).not.toContain("Lucía");
    // Otro dispositivo: misma contraseña y la sal del archivo.
    const again = await deriveKey("contraseña de la clínica", saltOf(enc));
    expect(await decrypt(enc, again)).toEqual(bytes);
  });

  it("con otra contraseña, o si el archivo se ha tocado, falla", async () => {
    const salt = newSalt();
    const enc = await encrypt(bytes, await deriveKey("buena-contraseña", salt), salt);
    await expect(decrypt(enc, await deriveKey("mala-contraseña", salt))).rejects.toBeInstanceOf(WrongPassword);
    const tampered = enc.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decrypt(tampered, await deriveKey("buena-contraseña", salt))).rejects.toBeInstanceOf(WrongPassword);
  });

  it("cada subida lleva un vector de inicio nuevo", async () => {
    const salt = newSalt();
    const key = await deriveKey("contraseña larga", salt);
    expect(await encrypt(bytes, key, salt)).not.toEqual(await encrypt(bytes, key, salt));
  });

  it("comprime antes de cifrar, y abre también las copias antiguas sin comprimir", async () => {
    const salt = newSalt();
    const key = await deriveKey("contraseña de la clínica", salt);
    const big = new TextEncoder().encode(`SQLite format 3\u0000${"Lucía Pérez, rodilla derecha; ".repeat(5000)}`);
    const enc = await encrypt(big, key, salt);
    expect(enc.byteLength).toBeLessThan(big.byteLength / 10);
    expect(await decrypt(enc, key)).toEqual(big);
    // Una copia de antes: cifrada sin comprimir.
    const iv = new Uint8Array(12);
    const raw = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes as BufferSource));
    const head = enc.slice(0, 9 + 16);
    const old = new Uint8Array([...head, ...iv, ...raw]);
    expect(await decrypt(old, key)).toEqual(bytes);
  });
});
