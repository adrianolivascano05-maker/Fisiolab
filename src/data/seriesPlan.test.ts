// Una serie de citas que tiene en cuenta su calendario (seriesPlan.ts): se salta sus viajes y dice qué días entrena.
import { describe, expect, it } from "vitest";
import type { PatientEvent } from "./patientEvents";
import { planSeries, trainingWeek } from "./seriesPlan";

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
    expect(plan.skipped.map((s) => [s.startsAt.slice(0, 10), s.event.id])).toEqual([["2026-11-24", "trip"]]);
  });

  it("un viaje sin fin a la vista no la alarga para siempre", () => {
    const away = ev({ kind: "travel", startsOn: "2026-11-01", endsOn: "2027-10-31" });
    const plan = planSeries(start, 4, 45, [away]);
    expect(plan.starts).toEqual([]);
    expect(plan.skipped.length).toBe(30);
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
