// Lo que se ve en el calendario de un paciente (patientCalendar.ts): qué sale cada día, con qué filtro, los puntos del
// mes y la lista del mes sin repeticiones.
import { describe, expect, it } from "vitest";
import type { Appointment } from "../data/appointments";
import type { PatientEvent } from "../data/patientEvents";
import { addMonths, barOf, calendarItems, countText, dotsOf, isMonth, leadingBlanks, monthAgenda, monthDays, monthTitle, seriesIn, spanStep, type CalSource } from "./patientCalendar";

const visit = (id: string, startsAt: string, status: Appointment["status"] = "scheduled"): Appointment => ({ id, patientId: "p", startsAt, minutes: 45, status, assignedTo: null });
const ev = (over: Partial<PatientEvent>): PatientEvent => ({
  id: "e",
  patientId: "p",
  kind: "other",
  title: "",
  startsOn: "2026-11-10",
  endsOn: null,
  time: null,
  minutes: null,
  repeatDays: [],
  repeatUntil: null,
  skipDays: [],
  notes: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  ...over,
});
const src = (over: Partial<CalSource> = {}): CalSource => ({ appointments: [], events: [], sessions: [], review: null, ...over });
const types = (m: Map<string, { type: string }[]>, day: string) => (m.get(day) ?? []).map((i) => i.type);

describe("lo de cada día", () => {
  // 10:00 en Madrid es 09:00 UTC en noviembre.
  const s = src({
    appointments: [visit("a1", "2026-11-12T09:00:00.000Z", "done"), visit("a2", "2026-11-13T09:00:00.000Z", "cancelled"), visit("a3", "2026-11-19T17:30:00.000Z")],
    sessions: [
      { id: "s1", performedAt: "2026-11-12T09:05:00.000Z" }, // con su cita: no se repite
      { id: "s2", performedAt: "2026-11-13T10:00:00.000Z" }, // el día de una cita anulada: vino sin cita
      { id: "s3", performedAt: "2026-11-05T16:00:00.000Z" }, // sin cita
    ],
    review: "2026-11-19",
    events: [ev({ id: "op", kind: "surgery", startsOn: "2026-11-19" }), ev({ id: "tr", kind: "training", startsOn: "2026-11-02", time: "19:00", minutes: 90, repeatDays: [4] })],
  });

  it("citas (todas), sesiones sin cita, la reevaluación y sus eventos; primero lo de todo el día, luego por hora", () => {
    const m = calendarItems(s, "2026-11-01", "2026-11-30");
    expect(types(m, "2026-11-12")).toEqual(["visit", "event"]);
    expect(types(m, "2026-11-13")).toEqual(["visit", "session"]);
    expect(types(m, "2026-11-05")).toEqual(["session", "event"]);
    // El 19: la reevaluación y la operación (todo el día), luego la cita de las 18:30 y el entrenamiento de las 19:00.
    expect(types(m, "2026-11-19")).toEqual(["review", "event", "visit", "event"]);
    expect(m.get("2026-11-19")![2]).toMatchObject({ time: "18:30" });
    // Fuera del rango no sale nada.
    expect([...calendarItems(s, "2026-12-01", "2026-12-31").keys()]).toEqual(["2026-12-03", "2026-12-10", "2026-12-17", "2026-12-24", "2026-12-31"]); // solo los jueves de entrenamiento
  });

  it("«Citas»: lo de la clínica; «Eventos»: lo suyo", () => {
    const visits = calendarItems(s, "2026-11-01", "2026-11-30", "visits");
    expect(types(visits, "2026-11-19")).toEqual(["review", "visit"]);
    expect([...visits.values()].flat().some((i) => i.type === "event")).toBe(false);
    const events = calendarItems(s, "2026-11-01", "2026-11-30", "events");
    expect(types(events, "2026-11-19")).toEqual(["event", "event"]);
    expect([...events.values()].flat().every((i) => i.type === "event")).toBe(true);
  });

  it("los puntos del mes (uno por clase) y lo que oye el lector de pantalla", () => {
    const m = calendarItems(s, "2026-11-01", "2026-11-30");
    expect(dotsOf(m.get("2026-11-19"))).toEqual(["visit", "event", "routine", "review"]);
    expect(dotsOf(m.get("2026-11-13"))).toEqual(["visit"]);
    expect(dotsOf(undefined)).toEqual([]);
    expect(countText(m.get("2026-11-19"))).toBe("1 cita, 2 eventos y 1 reevaluación");
    expect(countText(m.get("2026-11-13"))).toBe("1 cita y 1 sesión");
    expect(countText([])).toBe("nada");
  });
});

describe("el mes", () => {
  it("sus días, los huecos antes del 1 (la semana empieza en lunes), el de antes y el de después", () => {
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthDays("2028-02").at(-1)).toBe("2028-02-29");
    expect(leadingBlanks("2026-11")).toBe(6); // el 1 de noviembre de 2026 es domingo
    expect(leadingBlanks("2026-06")).toBe(0); // lunes
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", -13)).toBe("2025-10");
    expect(monthTitle("2026-11")).toBe("Noviembre de 2026");
    expect([isMonth("2026-11"), isMonth("2026-13"), isMonth("2026-1"), isMonth(null)]).toEqual([true, false, false, false]);
  });

  it("la lista del mes: lo semanal va aparte y un viaje, una vez en su primer día del mes", () => {
    const trip = ev({ id: "trip", kind: "travel", startsOn: "2026-10-30", endsOn: "2026-11-03" });
    const training = ev({ id: "tr", kind: "training", startsOn: "2026-11-02", repeatDays: [2, 4] });
    const ended = ev({ id: "old", kind: "training", startsOn: "2026-09-01", repeatDays: [1], repeatUntil: "2026-10-26" });
    const s = src({ events: [trip, training, ended], appointments: [visit("a", "2026-11-02T09:00:00.000Z")] });
    const m = calendarItems(s, "2026-11-01", "2026-11-30");
    expect(monthAgenda(m).map(([day, items]) => [day, items.map((i) => (i.type === "event" ? i.occurrence.event.id : i.type))])).toEqual([
      ["2026-11-01", ["trip"]],
      ["2026-11-02", ["visit"]],
    ]);
    expect(seriesIn([trip, training, ended], "2026-11").map((e) => e.id)).toEqual(["tr"]);
    // En el día: cuál de sus días es.
    const o = m.get("2026-11-02")!.find((i) => i.type === "event" && i.occurrence.event.id === "trip");
    expect(o?.type === "event" && spanStep(o.occurrence)).toBe("Día 4 de 5");
  });
});

describe("el mes, de un vistazo", () => {
  it("lo importante, punto relleno; lo de cada semana, punto hueco; un viaje, franja (que corta al acabar la semana)", () => {
    const op = ev({ id: "op", kind: "surgery", startsOn: "2026-11-12" });
    const training = ev({ id: "tr", kind: "training", startsOn: "2026-11-02", repeatDays: [4] });
    const trip = ev({ id: "trip", kind: "travel", startsOn: "2026-11-14", endsOn: "2026-11-17" });
    const m = calendarItems(src({ events: [op, training, trip] }), "2026-11-01", "2026-11-30");
    expect(dotsOf(m.get("2026-11-12"))).toEqual(["event", "routine"]);
    expect(dotsOf(m.get("2026-11-19"))).toEqual(["routine"]);
    expect(dotsOf(m.get("2026-11-15"))).toEqual([]);
    expect(barOf(m.get("2026-11-12"), "2026-11-12", "2026-11")).toBeNull();
    // Del sábado 14 al martes 17: empieza el 14, corta el domingo 15 y sigue el lunes 16 hasta el 17.
    expect(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"].map((d) => barOf(m.get(d), d, "2026-11"))).toEqual([
      { start: true, end: false },
      { start: false, end: true },
      { start: true, end: false },
      { start: false, end: true },
    ]);
  });
});
