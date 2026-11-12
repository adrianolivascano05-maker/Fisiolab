// Lo que se acepta de lo que el paciente apunta en su calendario desde el enlace (calendarForm.ts).
import { describe, expect, it } from "vitest";
import { CALENDAR_MAX, cleanPatientEvents, FROM_PATIENT } from "./calendarForm";

describe("tu calendario, por enlace", () => {
  it("se queda lo que vale, limpio y con la marca de que lo apuntó él; lo demás se cuenta como dejado fuera", () => {
    const { events, dropped } = cleanPatientEvents({
      events: [
        { kind: "training", title: " Pádel ", startsOn: "2026-11-17", repeatDays: [4, 2], time: "19:00", minutes: 90, notes: "Con el club" },
        { kind: "travel", startsOn: "2026-12-20", endsOn: "2027-01-06" },
        { kind: "nada", startsOn: "2026-11-17" },
        { kind: "surgery", startsOn: "2026-02-30" },
        "texto suelto",
        null,
      ],
      otra: "cosa",
    });
    expect(dropped).toBe(4);
    expect(events).toEqual([
      expect.objectContaining({ kind: "training", title: "Pádel", repeatDays: [2, 4], time: "19:00", minutes: 90, notes: `Con el club\n${FROM_PATIENT}` }),
      expect.objectContaining({ kind: "travel", startsOn: "2026-12-20", endsOn: "2027-01-06", notes: FROM_PATIENT }),
    ]);
  });

  it("como mucho treinta; sin nada, nada", () => {
    const many = Array.from({ length: CALENDAR_MAX + 5 }, () => ({ kind: "competition", startsOn: "2026-11-21" }));
    expect(cleanPatientEvents({ events: many })).toMatchObject({ dropped: 5 });
    expect(cleanPatientEvents({ events: many }).events).toHaveLength(CALENDAR_MAX);
    expect(cleanPatientEvents({})).toEqual({ events: [], dropped: 0 });
    // Una nota larguísima se recorta para que quepa la marca.
    const long = cleanPatientEvents({ events: [{ kind: "other", startsOn: "2026-11-21", notes: "x".repeat(2000) }] }).events[0]!;
    expect(long.notes.length).toBeLessThanOrEqual(2000);
    expect(long.notes.endsWith(FROM_PATIENT)).toBe(true);
  });
});
