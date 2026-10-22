import { describe, expect, it } from "vitest";
import { GoogleError } from "./drive";
import { calendarError } from "./googleCalendar";

describe("errores de Google Calendar", () => {
  it("la API sin activar en el proyecto se explica en castellano, con el enlace para activarla", () => {
    // El mensaje tal como lo devolvió Google en la clínica.
    const e = new GoogleError(
      "Google respondió 403: Google Calendar API has not been used in project 1084216324372 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1084216324372 then retry.",
      403,
    );
    const r = calendarError(e);
    expect(r.error).toMatch(/no está activada/);
    expect(r.fix).toBe("https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=1084216324372");
  });

  it("los demás errores se muestran tal cual y sin enlace", () => {
    expect(calendarError(new GoogleError("Google respondió 500: backend error", 500))).toEqual({ error: "Google respondió 500: backend error", fix: null });
  });
});
