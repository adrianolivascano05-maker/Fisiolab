// Reúne de la base lo que necesita la bandeja de envíos (outbox.ts) y la calcula.
import { madridDay } from "../app/format";
import { remindersBetween } from "../data/appointments";
import type { Db } from "../data/db";
import { listOutboxMarks } from "../data/outbox";
import { getSetting } from "../data/repo";
import { buildOutbox, OUTBOX_SETTINGS_KEY, outboxSettings, sendableKinds, type Contact, type OutboxItem, type OutboxSettings } from "./outbox";

const contactOf = (privacy: string | null): boolean | null => {
  try {
    const v = (JSON.parse(privacy || "{}") as { consents?: { contact?: boolean } }).consents?.contact;
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
};

const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function loadOutbox(db: Db, granted: readonly string[], now = new Date()): Promise<{ items: OutboxItem[]; settings: OutboxSettings }> {
  const iso = now.toISOString();
  const settings = outboxSettings(await getSetting<Partial<OutboxSettings>>(db, OUTBOX_SETTINGS_KEY));
  // Dos meses vista: las reservas por internet se confirman en cuanto llegan, aunque sean para dentro de semanas.
  const until = new Date(now.getTime() + 62 * 86_400_000).toISOString();
  const today = madridDay(iso);
  const [upcoming, seen, withAnamnesis, forms, reviews, questionnaires, marks] = await Promise.all([
    remindersBetween(db, iso, until),
    db.query<{ id: string }>(
      `select patient_id as id from sessions union select patient_id as id from appointments where status != 'cancelled' and starts_at < ?`,
      [iso],
    ),
    db.query<{ id: string }>("select patient_id as id from anamnesis where answers not in ('', '{}')"),
    db.query<{ patientId: string; kind: string; sentAt: string }>("select patient_id as patientId, kind, sent_at as sentAt from patient_forms where cancelled_at is null"),
    db.query<{ patientId: string; name: string; phone: string | null; email: string | null; privacy: string | null; reviewOn: string }>(
      `select p.id as patientId, p.name, p.phone, p.email, p.privacy, s.review_on as reviewOn
         from patients p
         join sessions s on s.id = (select s2.id from sessions s2 where s2.patient_id = p.id order by s2.performed_at desc limit 1)
        where s.review_on is not null and s.review_on >= ? and s.review_on <= ?`,
      [today, addDay(today, settings.followUpDays)],
    ),
    db.query<{ patientId: string; kind: string; performedAt: string }>("select patient_id as patientId, kind, performed_at as performedAt from questionnaires"),
    listOutboxMarks(db, new Date(now.getTime() - 60 * 86_400_000).toISOString()),
  ]);
  const items = buildOutbox({
    now: iso,
    settings,
    upcoming,
    seenBefore: new Set(seen.map((r) => r.id)),
    withAnamnesis: new Set(withAnamnesis.map((r) => r.id)),
    formsSent: forms,
    reviews: reviews.map((r): Contact & { reviewOn: string } => ({ patientId: r.patientId, name: r.name, phone: r.phone ?? "", email: r.email ?? "", contact: contactOf(r.privacy), reviewOn: r.reviewOn })),
    questionnaires,
    sendable: sendableKinds(granted),
    marks,
  });
  return { items, settings };
}
