import { describe, expect, it } from "vitest";
import type { ReminderItem } from "../data/appointments";
import { anamnesisText, buildOutbox, DEFAULT_OUTBOX, followUpText, type OutboxInput } from "./outbox";

// Martes 20 de octubre de 2026, 10:00 en Madrid.
const NOW = "2026-10-20T08:00:00.000Z";
const appt = (id: string, patientId: string, startsAt: string, extra: Partial<ReminderItem> = {}): ReminderItem => ({
  id,
  patientId,
  startsAt,
  minutes: 45,
  status: "scheduled",
  assignedTo: null,
  remindedAt: null,
  confirmedAt: null,
  name: `Paciente ${patientId}`,
  phone: "600111222",
  email: "",
  contact: true,
  ...extra,
});
const input = (over: Partial<OutboxInput> = {}): OutboxInput => ({
  now: NOW,
  settings: DEFAULT_OUTBOX,
  upcoming: [],
  seenBefore: new Set(),
  withAnamnesis: new Set(),
  formsSent: [],
  reviews: [],
  questionnaires: [],
  sendable: new Set(["ndi", "oswestry"]),
  marks: [],
  ...over,
});
const ids = (i: OutboxInput) => buildOutbox(i).map((x) => x.id);

describe("bandeja: recordatorios", () => {
  it("las citas de mañana sin recordar, y las de hoy que aún no han llegado (con margen de dos horas)", () => {
    const upcoming = [
      appt("hoy-pronto", "a", "2026-10-20T09:00:00.000Z", { remindedAt: null }), // hoy 11:00: falta una hora
      appt("hoy-tarde", "b", "2026-10-20T15:00:00.000Z"), // hoy 17:00
      appt("manana", "c", "2026-10-21T08:00:00.000Z"),
      appt("manana-ya", "d", "2026-10-21T09:00:00.000Z", { remindedAt: "2026-10-19T18:00:00.000Z" }),
      appt("manana-confirmada", "e", "2026-10-21T10:00:00.000Z", { confirmedAt: "2026-10-19T18:00:00.000Z" }),
      appt("manana-sin-permiso", "f", "2026-10-21T11:00:00.000Z", { contact: false }),
      appt("manana-sin-firmar", "h", "2026-10-21T12:00:00.000Z", { contact: null }),
      appt("pasado", "g", "2026-10-22T08:00:00.000Z"),
    ];
    const seenBefore = new Set(["a", "b", "c", "d", "e", "f", "g", "h"]);
    // Ni a quien dijo que no ni a quien aún no ha firmado el permiso de contacto.
    expect(ids(input({ upcoming, seenBefore }))).toEqual(["recordatorio:hoy-tarde", "recordatorio:manana"]);
    // «No enviar» lo quita; apagado en los ajustes, no sale ninguno.
    const marks = [{ id: "recordatorio:manana", patientId: "c", rule: "recordatorio", status: "skipped" as const, at: NOW, by: "" }];
    expect(ids(input({ upcoming, seenBefore, marks }))).toEqual(["recordatorio:hoy-tarde"]);
    expect(ids(input({ upcoming, seenBefore, settings: { ...DEFAULT_OUTBOX, reminders: false } }))).toEqual([]);
  });
});

describe("bandeja: anamnesis antes de la primera cita", () => {
  const first = appt("primera", "nuevo", "2026-10-22T07:00:00.000Z"); // jueves 9:00, dentro de 47 h

  it("48 horas antes de la primera cita de un paciente nuevo, sin anamnesis ni enlace mandado", () => {
    const out = buildOutbox(input({ upcoming: [first] }));
    expect(out.map((x) => x.id)).toEqual(["anamnesis:primera"]);
    expect(out[0]).toMatchObject({ rule: "anamnesis", needsForms: true, name: "Paciente nuevo" });
  });

  it("todavía no si faltan más de 48 horas; con 72 en los ajustes, sí", () => {
    const later = appt("primera", "nuevo", "2026-10-23T07:00:00.000Z"); // dentro de 71 h
    expect(ids(input({ upcoming: [later] }))).toEqual([]);
    expect(ids(input({ upcoming: [later], settings: { ...DEFAULT_OUTBOX, anamnesisHours: 72 } }))).toEqual(["anamnesis:primera"]);
  });

  it("si la cita se da con menos de 48 horas, sale ya", () => {
    const soon = appt("pronto", "nuevo", "2026-10-20T16:00:00.000Z"); // hoy a las 18:00
    expect(ids(input({ upcoming: [soon] }))).toContain("anamnesis:pronto");
  });

  it("no si ya ha venido, si ya tiene anamnesis, si ya se le mandó o si no acepta mensajes", () => {
    expect(ids(input({ upcoming: [first], seenBefore: new Set(["nuevo"]) }))).toEqual([]);
    expect(ids(input({ upcoming: [first], withAnamnesis: new Set(["nuevo"]) }))).toEqual([]);
    expect(ids(input({ upcoming: [first], formsSent: [{ patientId: "nuevo", kind: "anamnesis", sentAt: "2026-10-19T10:00:00.000Z" }] }))).toEqual([]);
    expect(ids(input({ upcoming: [{ ...first, contact: false }] }))).toEqual([]);
    expect(ids(input({ upcoming: [first], marks: [{ id: "anamnesis:primera", patientId: "nuevo", rule: "anamnesis", status: "sent", at: NOW, by: "" }] }))).toEqual([]);
  });

  it("solo para la primera de sus citas", () => {
    const second = appt("segunda", "nuevo", "2026-10-21T15:00:00.000Z");
    const third = appt("tercera", "nuevo", "2026-10-21T16:00:00.000Z");
    expect(ids(input({ upcoming: [third, second], settings: { ...DEFAULT_OUTBOX, reminders: false } }))).toEqual(["anamnesis:segunda"]);
  });
});

describe("bandeja: cuestionarios antes de reevaluar", () => {
  const review = { patientId: "p", name: "Ana Ruiz", phone: "600", email: "", contact: true, reviewOn: "2026-10-22" };
  const q = (kind: string, performedAt: string) => ({ patientId: "p", kind, performedAt });

  it("los que rellenó hace al menos dos semanas, si la reevaluación es en los próximos dos días", () => {
    const out = buildOutbox(input({ reviews: [review], questionnaires: [q("ndi", "2026-09-20T10:00:00.000Z"), q("oswestry", "2026-10-15T10:00:00.000Z"), q("dn4", "2026-09-01T10:00:00.000Z")] }));
    // Oswestry es demasiado reciente y DN4 no se manda por enlace.
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "seguimiento:p:2026-10-22", kinds: ["ndi"], needsForms: true });
  });

  it("nada si no hay cuestionarios que mandar, si la reevaluación queda lejos o si ya se le mandaron", () => {
    expect(ids(input({ reviews: [review] }))).toEqual([]);
    expect(ids(input({ reviews: [{ ...review, reviewOn: "2026-10-25" }], questionnaires: [q("ndi", "2026-09-20T10:00:00.000Z")] }))).toEqual([]);
    expect(ids(input({ reviews: [review], questionnaires: [q("ndi", "2026-09-20T10:00:00.000Z")], formsSent: [{ patientId: "p", kind: "ndi", sentAt: "2026-10-19T10:00:00.000Z" }] }))).toEqual([]);
  });
});

describe("bandeja: mensajes", () => {
  it("la anamnesis lleva el día, la hora, la clínica y el enlace", () => {
    const t = anamnesisText({ name: "Ana Ruiz López", clinic: "Fisiolab", startsAt: "2026-10-22T07:00:00.000Z", url: "https://x/formulario/abc#k" });
    expect(t).toContain("Hola, Ana.");
    expect(t).toContain("jueves, 22 de octubre a las 09:00");
    expect(t).toContain("en Fisiolab");
    expect(t).toContain("https://x/formulario/abc#k");
  });
  it("el seguimiento lista cada cuestionario con su enlace", () => {
    const t = followUpText({ name: "Ana", clinic: "", reviewOn: "2026-10-22", links: [{ title: "NDI", url: "https://x/1" }, { title: "Oswestry", url: "https://x/2" }] });
    expect(t).toContain("El jueves, 22 de octubre toca revisar cómo vas en la clínica.");
    expect(t).toContain("Antes, rellena estos cuestionarios:");
    expect(t).toContain("NDI: https://x/1");
    expect(t).toContain("Oswestry: https://x/2");
  });
});
