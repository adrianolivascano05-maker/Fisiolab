import { describe, expect, it } from "vitest";
import { newBookingKeys, newCancelToken, openFromPatient, sealForClinic, tokenHash } from "./crypto";

describe("cifrado de las reservas", () => {
  it("lo que cifra el paciente con la clave pública solo lo abre la clínica con su privada", async () => {
    const clinic = await newBookingKeys();
    const other = await newBookingKeys();
    const data = { name: "Ana Ruiz", phone: "600111222", note: "Dolor de rodilla" };
    const blob = await sealForClinic(clinic.publicJwk, data);
    expect(blob.startsWith("CB1.")).toBe(true);
    expect(blob).not.toContain("Ana");
    expect(await openFromPatient(clinic.privateJwk, blob)).toEqual(data);
    await expect(openFromPatient(other.privateJwk, blob)).rejects.toThrow();
    // Cada envío lleva su propia clave de un uso: el mismo dato cifrado dos veces no se parece.
    expect(await sealForClinic(clinic.publicJwk, data)).not.toBe(blob);
  });

  it("si alguien toca los datos cifrados, no se abren", async () => {
    const clinic = await newBookingKeys();
    const blob = await sealForClinic(clinic.publicJwk, { a: 1 });
    const parts = blob.split(".");
    const ct = Uint8Array.from(atob(parts[3]!), (c) => c.charCodeAt(0));
    ct[0] = ct[0]! ^ 1;
    parts[3] = btoa(String.fromCharCode(...ct));
    await expect(openFromPatient(clinic.privateJwk, parts.join("."))).rejects.toThrow();
    await expect(openFromPatient(clinic.privateJwk, "otra cosa")).rejects.toThrow("formato");
  });

  it("el código para anular es largo y al azar; el servidor guarda solo su huella", async () => {
    const t = newCancelToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(newCancelToken()).not.toBe(t);
    expect(await tokenHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
