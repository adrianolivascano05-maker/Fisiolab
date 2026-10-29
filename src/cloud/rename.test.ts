// La app se llamó Cénit hasta el 28-10-2026: el calendario que ya tenía cada fisio se renombra a OmniClin la próxima vez
// que se usa; no se crea otro calendario.
import { afterEach, describe, expect, it, vi } from "vitest";
import { CALENDAR_NAME, ensureCalendar } from "./googleCalendar";

type Call = { method: string; url: string; body?: unknown };

/** Un Google de mentira con un calendario ya creado con el nombre de antes. */
function fakeGoogle() {
  const calls: Call[] = [];
  const calendar = { id: "cal-1", summary: "Cénit · Citas" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
      if (url.includes("/calendars/cal-1")) {
        if (method === "PATCH") Object.assign(calendar, body);
        return ok(calendar);
      }
      return new Response("{}", { status: 404 });
    }),
  );
  return { calls, calendar, created: () => calls.filter((c) => c.method === "POST") };
}

afterEach(() => vi.unstubAllGlobals());

describe("del nombre Cénit al de OmniClin", () => {


  it("el calendario se renombra y conserva sus citas (el mismo id)", async () => {
    const g = fakeGoogle();
    expect(await ensureCalendar("tok", "cal-1")).toBe("cal-1");
    expect(g.calendar.summary).toBe(CALENDAR_NAME);
    expect(g.created()).toEqual([]);
  });
});
