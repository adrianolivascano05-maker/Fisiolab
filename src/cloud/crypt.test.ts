import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, deriveKeyBytes, encrypt, encryptPieces, encryptToPieces, isEncrypted, newRecoveryCode, newSalt, openWithCode, saltOf, sealForRecovery, WrongPassword } from "./crypt";

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

describe("cifrado por trozos (copias grandes)", () => {
  // Algo que no se comprime casi nada, para que salgan varios trozos de 4 MiB sin un archivo enorme.
  const noisy = (n: number) => {
    const out = new Uint8Array(n);
    for (let at = 0; at < n; at += 65536) crypto.getRandomValues(out.subarray(at, Math.min(n, at + 65536)));
    out.set(new TextEncoder().encode("SQLite format 3\u0000 Lucía Pérez"), 0);
    return out;
  };
  /** Comparar 9 MB con toEqual se come la memoria de las pruebas: se compara su huella. */
  const print = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b as BufferSource)).join(",");
  /** Los registros de una copia por trozos: [inicio, fin) de cada uno, después de la cabecera. */
  const records = (enc: Uint8Array) => {
    const out: [number, number][] = [];
    for (let at = 9 + 16; at < enc.byteLength; ) {
      const end = at + 4 + 12 + new DataView(enc.buffer, enc.byteOffset + at, 4).getUint32(0);
      out.push([at, end]);
      at = end;
    }
    return out;
  };

  it("abre igual que la de siempre, con varios trozos, y lleva la sal en el mismo sitio", async () => {
    const salt = newSalt();
    const key = await deriveKey("contraseña de la clínica", salt);
    const big = noisy(9 * 1024 * 1024);
    const enc = await encryptToPieces(big, key, salt);
    expect(isEncrypted(enc)).toBe(true);
    expect(saltOf(enc)).toBe(salt);
    expect(records(enc).length).toBe(3);
    expect(await print(await decrypt(enc, await deriveKey("contraseña de la clínica", saltOf(enc))))).toBe(await print(big));
    // Lo pequeño también: un solo trozo, y comprimido.
    const small = new TextEncoder().encode(`SQLite format 3\u0000${"Lucía Pérez, rodilla derecha; ".repeat(5000)}`);
    const one = await encryptToPieces(small, key, salt);
    expect(records(one).length).toBe(1);
    expect(one.byteLength).toBeLessThan(small.byteLength / 10);
    expect(new TextDecoder("latin1").decode(one)).not.toContain("Lucía");
    expect(await decrypt(one, key)).toEqual(small);
    // Una base vacía no deja la copia sin trozos.
    expect(await decrypt(await encryptToPieces(new Uint8Array(0), key, salt), key)).toEqual(new Uint8Array(0));
  });

  it("los trozos salen de uno en uno, sin juntar la copia", async () => {
    const salt = newSalt();
    const key = await deriveKey("contraseña de la clínica", salt);
    const sizes: number[] = [];
    for await (const p of encryptPieces(noisy(9 * 1024 * 1024), key, salt)) sizes.push(p.byteLength);
    expect(sizes[0]).toBe(9 + 16);
    expect(sizes.length).toBe(4);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(4 * 1024 * 1024 + 4 + 12 + 16);
  });

  it("con otra contraseña, tocada, cortada o con los trozos cambiados de orden, no abre", async () => {
    const salt = newSalt();
    const key = await deriveKey("buena-contraseña", salt);
    const enc = await encryptToPieces(noisy(9 * 1024 * 1024), key, salt);
    await expect(decrypt(enc, await deriveKey("mala-contraseña", salt))).rejects.toBeInstanceOf(WrongPassword);
    const tampered = enc.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decrypt(tampered, key)).rejects.toBeInstanceOf(WrongPassword);
    const [first, second, third] = records(enc) as [[number, number], [number, number], [number, number]];
    // Cortada justo entre dos trozos: parece entera, pero el último no dice que es el último.
    await expect(decrypt(enc.slice(0, second[1]), key)).rejects.toBeInstanceOf(WrongPassword);
    // Cortada a medias de un trozo.
    await expect(decrypt(enc.slice(0, third[0] + 100), key)).rejects.toBeInstanceOf(WrongPassword);
    // El segundo y el primero cambiados de sitio.
    const swapped = new Uint8Array(enc.byteLength);
    let at = 0;
    for (const part of [enc.subarray(0, first[0]), enc.subarray(...second), enc.subarray(...first), enc.subarray(third[0])]) {
      swapped.set(part, at);
      at += part.byteLength;
    }
    await expect(decrypt(swapped, key)).rejects.toBeInstanceOf(WrongPassword);
  });
});

describe("código de recuperación", () => {
  const bytes = new TextEncoder().encode("SQLite format 3\u0000 historia clínica");

  it("abre la copia sin la contraseña, escrito como sea; con otro código no", async () => {
    const salt = newSalt();
    const { key, raw } = await deriveKeyBytes("contraseña olvidada", salt);
    const enc = await encrypt(bytes, key, salt);
    // La misma clave que la de siempre: los demás dispositivos la siguen abriendo con la contraseña.
    expect(await decrypt(enc, await deriveKey("contraseña olvidada", salt))).toEqual(bytes);
    const code = newRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    const blob = await sealForRecovery(raw, salt, code);
    expect(blob).not.toContain(code);
    const typed = code.toLowerCase().replace(/-/g, " ").replace(/0/g, "o");
    const back = await openWithCode(blob, typed);
    expect(back.salt).toBe(salt);
    expect(await decrypt(enc, back.key)).toEqual(bytes);
    await expect(openWithCode(blob, newRecoveryCode())).rejects.toBeInstanceOf(WrongPassword);
  });
});
