import { describe, expect, it } from "vitest";
import { mailtoUrl, waPhone, whatsappUrl } from "./reminders";

describe("recordatorios", () => {
  it("el teléfono para WhatsApp: con el prefijo de España si no lo trae", () => {
    expect(waPhone("612 34 56 78")).toBe("34612345678");
    expect(waPhone("+34 612-345-678")).toBe("34612345678");
    expect(waPhone("0044 7700 900123")).toBe("447700900123");
    expect(waPhone("954 12 34 56")).toBe("34954123456");
    expect(waPhone("123")).toBeNull();
    expect(waPhone("")).toBeNull();
  });

  it("los enlaces llevan el texto codificado", () => {
    expect(whatsappUrl("34612345678", "Hola, Ana & co")).toBe("https://wa.me/34612345678?text=Hola%2C%20Ana%20%26%20co");
    expect(mailtoUrl("ana@x.es", "Tu cita", "Hola")).toBe("mailto:ana@x.es?subject=Tu%20cita&body=Hola");
  });
});
