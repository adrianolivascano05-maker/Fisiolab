import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, mailtoUrl, reminderText, waPhone, whatsappUrl } from "./reminders";

describe("recordatorios", () => {
  it("el texto con el nombre de pila, el día, la hora, la clínica y con quién", () => {
    const text = reminderText(DEFAULT_TEMPLATE, { name: "Ana Ruiz López", startsAt: "2026-10-27T09:30:00.000Z", clinic: "Fisiolab", professional: "Bruno" });
    expect(text).toBe(
      "Hola, Ana. Te recordamos tu cita de fisioterapia con Bruno en Fisiolab el martes, 27 de octubre a las 10:30. Si no puedes venir, avísanos respondiendo a este mensaje. ¡Gracias!",
    );
    expect(reminderText("", { name: "Luis", startsAt: "2026-10-27T09:30:00.000Z", clinic: "" })).toContain("tu cita de fisioterapia en la clínica el");
    expect(reminderText("Cita {dia} {hora} {nombre}", { name: "Eva", startsAt: "2026-01-05T16:00:00.000Z", clinic: "X" })).toBe("Cita lunes, 5 de enero 17:00 Eva");
  });

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
