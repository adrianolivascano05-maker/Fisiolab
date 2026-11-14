// Una serie de citas que tiene en cuenta su calendario (seriesPlan.ts): se salta sus viajes y dice qué días entrena.
import { describe, expect, it } from "vitest";
import type { PatientEvent } from "./patientEvents";
import { closureAt, outsideShifts, planSeries, seriesReach, trainingWeek } from "./seriesPlan";

const ev = (over: Partial<PatientEvent>): PatientEvent => ({
  id: "e",
  patientId: "p",
  kind: "other",
  title: "",
  startsOn: "2026-11-01",
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
// Martes 17 de noviembre de 2026, 10:00 en Madrid.
const start = "2026-11-17T09:00:00.000Z";
const days = (isos: string[]) => isos.map((i) => i.slice(0, 10));

describe("una serie de citas", () => {
  it("sin viajes: una por semana", () => {
    expect(days(planSeries(start, 3, 45, []).starts)).toEqual(["2026-11-17", "2026-11-24", "2026-12-01"]);
  });

  it("se salta las semanas en que está de viaje y sigue después, hasta tener las que se pidieron", () => {
    const trip = ev({ id: "trip", kind: "travel", title: "Vacaciones", startsOn: "2026-11-22", endsOn: "2026-11-30" });
    // Otras cosas de ese día (un partido) no la mueven: de esas avisa la hoja.
    const race = ev({ id: "race", kind: "competition", startsOn: "2026-12-01" });
    const plan = planSeries(start, 3, 45, [trip, race]);
    expect(days(plan.starts)).toEqual(["2026-11-17", "2026-12-01", "2026-12-08"]);
    expect(plan.skipped.map((s) => [s.startsAt.slice(0, 10), s.event?.id])).toEqual([["2026-11-24", "trip"]]);
  });

  it("se salta las semanas en que la agenda está cerrada a esa hora (un festivo, unas vacaciones de la clínica)", () => {
    // Cerrada todo el martes 24 (en Madrid, de 00:00 a 00:00) y la tarde del martes 1: la cita de las 10:00 del 1 sí cabe.
    const holiday = { startsAt: "2026-11-23T23:00:00.000Z", endsAt: "2026-11-24T23:00:00.000Z", note: "Festivo" };
    const afternoon = { startsAt: "2026-12-01T14:00:00.000Z", endsAt: "2026-12-01T20:00:00.000Z", note: "" };
    const plan = planSeries(start, 3, 45, [], [holiday, afternoon]);
    expect(days(plan.starts)).toEqual(["2026-11-17", "2026-12-01", "2026-12-08"]);
    expect(plan.skipped.map((s) => [s.startsAt.slice(0, 10), s.closure?.note])).toEqual([["2026-11-24", "Festivo"]]);
    // Un cierre que empieza a mitad de la cita también la tapa; uno que acaba justo cuando empieza, no.
    expect(closureAt([{ startsAt: "2026-11-17T09:30:00.000Z", endsAt: "2026-11-17T12:00:00.000Z" }], start, 45)).not.toBeNull();
    expect(closureAt([{ startsAt: "2026-11-17T07:00:00.000Z", endsAt: start }], start, 45)).toBeNull();
    // Con viaje y cierre la misma semana, cuenta el viaje (es lo que se le dice).
    const trip = ev({ id: "trip", kind: "travel", startsOn: "2026-11-23", endsOn: "2026-11-25" });
    expect(planSeries(start, 2, 45, [trip], [holiday]).skipped.map((s) => s.event?.id ?? "cierre")).toEqual(["trip"]);
  });

  it("hasta dónde puede llegar: hasta el final de la última semana que puede probar (las pedidas y medio año más)", () => {
    const away = ev({ kind: "travel", startsOn: "2026-11-01", endsOn: "2027-10-31" });
    const last = planSeries(start, 4, 45, [away]).skipped.at(-1)!.startsAt;
    expect(Date.parse(seriesReach(start, 4, 45))).toBeGreaterThanOrEqual(Date.parse(last) + 45 * 60_000);
  });

  it("un viaje sin fin a la vista no la alarga para siempre", () => {
    const away = ev({ kind: "travel", startsOn: "2026-11-01", endsOn: "2027-10-31" });
    const plan = planSeries(start, 4, 45, [away]);
    expect(plan.starts).toEqual([]);
    expect(plan.skipped.length).toBe(30);
  });
});

describe("los turnos de su fisio", () => {
  // Martes 17 de noviembre de 2026 (Madrid): turno de mañana de 8:30 a 14:30.
  const morning = { staffEmail: "laura@clinica.test", startsAt: "2026-11-17T07:30:00.000Z", endsAt: "2026-11-17T13:30:00.000Z" };
  it("dentro del turno, no; fuera (otra hora u otro día de esa semana), sí; una semana sin turnos puestos, no se sabe", () => {
    expect(outsideShifts([morning], "laura@clinica.test", start, 45)).toBe(false); // martes 10:00
    expect(outsideShifts([morning], "laura@clinica.test", "2026-11-17T13:00:00.000Z", 45)).toBe(true); // se sale a las 14:45
    expect(outsideShifts([morning], "laura@clinica.test", "2026-11-19T09:00:00.000Z", 45)).toBe(true); // jueves, sin turno
    expect(outsideShifts([morning], "laura@clinica.test", "2026-11-24T09:00:00.000Z", 45)).toBe(false); // otra semana
    expect(outsideShifts([morning], "bruno@clinica.test", "2026-11-19T09:00:00.000Z", 45)).toBe(false); // otra persona
  });
});

describe("sus días de entrenamiento", () => {
  it("los de cada semana que siguen ese día, con su hora, y los días en que no entrena", () => {
    const padel = ev({ kind: "training", startsOn: "2026-11-01", repeatDays: [2, 4], time: "19:00", minutes: 90 });
    expect(trainingWeek([padel], "2026-11-17")).toEqual({ text: "martes y jueves a las 19:00", free: "lunes, miércoles, viernes, sábado y domingo" });
    // Con horas distintas, cada día con la suya; sin hora, sin ella.
    const gym = ev({ kind: "training", startsOn: "2026-11-01", repeatDays: [6] });
    expect(trainingWeek([padel, { ...gym, time: "10:00" }], "2026-11-17")!.text).toBe("martes (19:00), jueves (19:00), sábado (10:00)");
    expect(trainingWeek([gym], "2026-11-17")!.text).toBe("sábado");
    // Uno que ya acabó, uno que aún no empieza o uno que no es entrenamiento: nada.
    expect(trainingWeek([{ ...padel, repeatUntil: "2026-11-10" }], "2026-11-17")).toBeNull();
    expect(trainingWeek([{ ...padel, startsOn: "2026-12-01" }], "2026-11-17")).toBeNull();
    expect(trainingWeek([ev({ kind: "other", repeatDays: [1] })], "2026-11-17")).toBeNull();
  });
});
