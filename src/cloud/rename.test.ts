// La app se llamó Cénit hasta el 28-10-2026: la carpeta de Drive y el calendario que ya tenía cada fisio se renombran
// a OmniClin la próxima vez que se usan; no se crea otra carpeta ni otro calendario.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureFolder, FOLDER_NAME } from "./drive";
import { CALENDAR_NAME, ensureCalendar } from "./googleCalendar";

type Call = { method: string; url: string; body?: unknown };

/** Un Google de mentira con una carpeta y un calendario ya creados con el nombre de antes. */
function fakeGoogle() {
  const calls: Call[] = [];
  const folder = { id: "carpeta-1", name: "Cénit · Fisiolab", trashed: false };
  const calendar = { id: "cal-1", summary: "Cénit · Citas" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
      if (url.includes("/drive/v3/files/carpeta-1")) {
        if (method === "PATCH") Object.assign(folder, body);
        return ok(folder);
      }
      if (url.includes("/drive/v3/files?q=")) {
        const name = /name = '([^']+)'/.exec(decodeURIComponent(url))?.[1];
        return ok({ files: name === folder.name ? [{ id: folder.id }] : [] });
      }
      if (url.includes("/calendars/cal-1")) {
        if (method === "PATCH") Object.assign(calendar, body);
        return ok(calendar);
      }
      return new Response("{}", { status: 404 });
    }),
  );
  return { calls, folder, calendar, created: () => calls.filter((c) => c.method === "POST") };
}

afterEach(() => vi.unstubAllGlobals());

describe("del nombre Cénit al de OmniClin", () => {
  it("la carpeta guardada se renombra y se sigue usando", async () => {
    const g = fakeGoogle();
    expect(await ensureFolder("tok", "carpeta-1")).toBe("carpeta-1");
    expect(g.folder.name).toBe(FOLDER_NAME);
    expect(g.created()).toEqual([]);
    // La vez siguiente ya no se toca.
    const before = g.calls.length;
    await ensureFolder("tok", "carpeta-1");
    expect(g.calls.slice(before).map((c) => c.method)).toEqual(["GET"]);
  });

  it("sin la carpeta guardada, se busca también por el nombre de antes y se renombra", async () => {
    const g = fakeGoogle();
    expect(await ensureFolder("tok", null)).toBe("carpeta-1");
    expect(g.folder.name).toBe(FOLDER_NAME);
    expect(g.created()).toEqual([]);
  });

  it("el calendario se renombra y conserva sus citas (el mismo id)", async () => {
    const g = fakeGoogle();
    expect(await ensureCalendar("tok", "cal-1")).toBe("cal-1");
    expect(g.calendar.summary).toBe(CALENDAR_NAME);
    expect(g.created()).toEqual([]);
  });
});
