// Los mensajes a pacientes: con el texto de OmniClin salen como siempre; la clínica cambia texto, asunto y firma; el
// ajuste antiguo del recordatorio se respeta.
import { describe, expect, it } from "vitest";
import { anamnesisText, followUpText } from "../schedule/outbox";
import { offerText, reminderMessage } from "../schedule/reminders";
import { DEFAULT_TEMPLATE, fillTemplate, FIRST_MESSAGE, firstMessageSubject, firstMessageText, MESSAGES, mergeLegacy, messageSubject, messageText, withWho, type MessageSettings } from "./templates";

const ana = { name: "Ana Ruiz López", startsAt: "2026-10-27T09:30:00.000Z", clinic: "Fisiolab", professional: "Bruno" };

describe("mensajes a pacientes", () => {
  it("las fichas se sustituyen; la clínica vacía es «la clínica»; «con» desaparece sin equipo; con tilde también vale", () => {
    expect(fillTemplate("Hola, {nombre}: {día} a las {hora} en {clínica}{con}.", { nombre: "Ana", dia: "lunes", hora: "10:00", clinica: "", con: withWho(null) })).toBe(
      "Hola, Ana: lunes a las 10:00 en la clínica.",
    );
    expect(fillTemplate("Te esperamos en la clínica {clinica}", { clinica: "" })).toBe("Te esperamos en la clínica");
    expect(fillTemplate("{nombre} {otra}", { nombre: "Eva" })).toBe("Eva {otra}");
  });

  it("sin nada guardado, cada mensaje sale como siempre", () => {
    expect(reminderMessage(null, ana)).toBe(
      "Hola, Ana. Te recordamos tu cita de fisioterapia con Bruno en Fisiolab el martes, 27 de octubre a las 10:30. Si no puedes venir, avísanos respondiendo a este mensaje. ¡Gracias!",
    );
    expect(offerText(ana)).toBe(
      "Hola, Ana. Se ha quedado libre un hueco de fisioterapia con Bruno en Fisiolab el martes, 27 de octubre a las 10:30. ¿Te viene bien? Responde a este mensaje y te lo guardamos.",
    );
    expect(anamnesisText({ name: "Ana Ruiz", clinic: "Fisiolab", startsAt: "2026-10-22T07:00:00.000Z", url: "https://x/f#k" })).toBe(
      "Hola, Ana. Tu primera cita de fisioterapia en Fisiolab es el jueves, 22 de octubre a las 09:00.\nPara aprovecharla al máximo, rellena antes unas preguntas sobre tu salud:\nhttps://x/f#k\nTus respuestas van cifradas y solo las verá tu fisioterapeuta.",
    );
    expect(followUpText({ name: "Ana", clinic: "", reviewOn: "2026-10-22", links: [{ title: "NDI", url: "https://x/1" }] })).toContain("Antes, rellena este cuestionario:\nNDI: https://x/1");
    expect(messageSubject("formulario", null, { clinica: "" })).toBe("Un formulario de la clínica");
    for (const m of MESSAGES) expect(messageText(m.kind, null, {}, { signature: false })).toBe(fillTemplate(m.text, {}));
  });

  it("el texto, el asunto y la firma de la clínica", () => {
    const s: MessageSettings = { texts: { hueco: { text: "{nombre}, hay hueco el {dia} a las {hora}.", subject: "Hueco en {clinica}" } }, signature: "Fisiolab · 954 000 000" };
    expect(offerText(ana, s)).toBe("Ana, hay hueco el martes, 27 de octubre a las 10:30.\n\nFisiolab · 954 000 000");
    expect(messageSubject("hueco", s, { clinica: "Fisiolab" })).toBe("Hueco en Fisiolab");
    // Los demás siguen con el texto de OmniClin, pero con la firma.
    expect(reminderMessage(s, ana)).toMatch(/¡Gracias!\n\nFisiolab · 954 000 000$/);
    // Un texto en blanco vuelve al de OmniClin.
    expect(messageText("hueco", { texts: { hueco: { text: "   " } }, signature: "" }, { nombre: "Eva" })).toBe(fillTemplate(MESSAGES[1]!.text, { nombre: "Eva" }));
  });

  it("el primer mensaje a un paciente nuevo sin permiso: sin datos de salud, sin «fisioterapia» y sin la firma", () => {
    const t = firstMessageText({ name: "Ana Ruiz López", clinic: "Fisiolab", url: "https://x/formulario/abc#k", expiresAt: "2026-11-05T10:00:00.000Z", startsAt: "2026-10-22T07:00:00.000Z" });
    expect(t).toBe("Hola, Ana. Te escribimos de Fisiolab por la cita que has pedido para el jueves, 22 de octubre a las 09:00. Antes de venir, si quieres, puedes rellenar este formulario: https://x/formulario/abc#k Caduca el 5 de noviembre. Si no has pedido cita, ignora este mensaje.");
    const sin = firstMessageText({ name: "Ana", clinic: "Fisiolab", url: "https://x/f#k", expiresAt: "2026-11-05T10:00:00.000Z" });
    expect(sin).toMatch(/por la cita que has pedido\. Antes/);
    for (const x of [t, sin, firstMessageSubject("Fisiolab"), FIRST_MESSAGE.withDate, FIRST_MESSAGE.noDate, FIRST_MESSAGE.subject]) {
      expect(x).not.toMatch(/fisioterap|salud|dolor|lesi/i);
      expect(x).not.toContain("\n\n");
    }
    expect(firstMessageSubject("Fisiolab")).toBe("Tu cita en Fisiolab");
  });

  it("el ajuste antiguo del recordatorio se respeta mientras no haya texto nuevo", () => {
    expect(mergeLegacy(null, "Cita {dia} {hora}").texts.recordatorio?.text).toBe("Cita {dia} {hora}");
    expect(mergeLegacy(null, DEFAULT_TEMPLATE).texts.recordatorio).toBeUndefined();
    expect(mergeLegacy({ texts: { recordatorio: { text: "Nuevo {nombre}" } }, signature: " Firma " }, "Viejo")).toEqual({ texts: { recordatorio: { text: "Nuevo {nombre}" } }, signature: "Firma" });
    expect(mergeLegacy(null, null)).toEqual({ texts: {}, signature: "" });
  });
});
