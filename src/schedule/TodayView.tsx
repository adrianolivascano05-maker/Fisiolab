// Agenda › Hoy: el día de la consulta en una lista. Cada cita con su estado y, a la vista, «Atender» (apunta la
// sesión y vuelve aquí) y «Cobrar»; tocar la cita abre su hoja de siempre (no vino, mover, anular, justificante,
// WhatsApp, llamar). Debajo, lo pendiente de la clínica (solo si hay algo): reevaluaciones de hoy o atrasadas, lo que
// queda sin cobrar y los pacientes de hoy a los que les falta firmar algo; después, las citas de mañana con sus
// recordatorios y la lista de espera.
import { CalendarCheck, CalendarClock, CalendarX2, ChevronRight, CircleCheck, FilePen, Hourglass, NotebookPen, UserRound, UserX, Wallet, BellRing, Send } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate, madridDay } from "../app/format";
import { useAsync } from "../app/useAsync";
import { PaymentForm } from "../clinical/billingForms";
import { CalendarSheet, calendarPromptOff, setCalendarPromptOff } from "../clinical/CalendarButton";
import { visitEvent } from "../clinical/calendar";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { addDays, todayDay } from "../clinical/pageKit";
import { consentContext } from "../consent/context";
import { TEMPLATES } from "../consent/templates";
import { agenda, remindersBetween, STATUS_LABELS, type AgendaItem } from "../data/appointments";
import { addPayment, euros, getPricing, patientAccount, pendingAccounts } from "../data/billing";
import { dueReviews, getAnamnesis, getSession } from "../data/clinical";
import { listConsents } from "../data/consents";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { waitlistCount } from "../data/waitlist";
import { Group, RowLink } from "../ui/Grouped";
import { SkeletonList } from "../ui/Skeleton";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { cx } from "../ui/cx";
import { useOutboxCount } from "./useOutboxCount";

/** «10:00», en la hora de Madrid. */
const hourOf = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const dayStart = (day: string) => new Date(`${day}T00:00:00`).toISOString();

/** Lo que le falta firmar a un paciente que viene hoy: la hoja de protección de datos y los consentimientos escritos obligatorios. */
async function unsignedOf(patientId: string): Promise<string[]> {
  const db = getDb();
  const [patient, anamnesis, signed] = await Promise.all([getPatient(db, patientId), getAnamnesis(db, patientId), listConsents(db, patientId)]);
  if (!patient) return [];
  const inForce = signed.filter((c) => !c.revokedAt);
  const ctx = consentContext(patient, anamnesis?.answers ?? {});
  const missing = TEMPLATES.filter((t) => t.written === "required" && t.suggest(ctx) && !inForce.some((c) => c.template === t.id)).map((t) => `consentimiento de ${t.title.toLowerCase()}`);
  return [...(patient.privacy.informedAt ? [] : ["hoja de protección de datos"]), ...missing];
}

export function TodayView({ onOpen }: { onOpen: (a: AgendaItem) => void }) {
  const version = useDataVersion();
  const outbox = useOutboxCount();
  const today = todayDay();
  const tomorrow = addDays(today, 1);
  const data = useAsync(async () => {
    const db = getDb();
    const [items, reviews, debtors, waiting, tomorrowItems] = await Promise.all([
      agenda(db, dayStart(today), dayStart(tomorrow)),
      dueReviews(db, today),
      pendingAccounts(db, today),
      waitlistCount(db),
      remindersBetween(db, dayStart(tomorrow), dayStart(addDays(tomorrow, 1))),
    ]);
    const day = items.filter((a) => madridDay(a.startsAt) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const coming = [...new Set(day.filter((a) => a.status !== "cancelled").map((a) => a.patientId))];
    const unsigned = (await Promise.all(coming.map(async (id) => ({ id, name: day.find((a) => a.patientId === id)!.name, missing: await unsignedOf(id) })))).filter((u) => u.missing.length);
    const owes = new Map(debtors.map((d) => [d.patientId, d.balanceCents]));
    return { day, reviews, debtors, owes, waiting, unsigned, tomorrow: tomorrowItems };
  }, [version, today]);
  const [charging, setCharging] = useState<AgendaItem | null>(null);
  // Al volver de atender con la siguiente cita puesta: se ofrece pasarla al calendario (como en Sesiones).
  const [params, setParams] = useSearchParams();
  const autoCalendar = useAutoCalendar();
  const savedSession = params.get("calendario");
  const forPatient = params.get("paciente");
  const offer = useAsync(async () => {
    if (!savedSession || !forPatient || autoCalendar || calendarPromptOff()) return null;
    const [session, patient] = await Promise.all([getSession(getDb(), savedSession), getPatient(getDb(), forPatient)]);
    return session && patient && session.nextAt ? visitEvent(session, patient) : null;
  }, [savedSession, forPatient, autoCalendar]);
  const closeOffer = () => setParams({ vista: "hoy" }, { replace: true });

  if (!data.data)
    return (
      <div className="flex flex-col gap-4">
        <SkeletonList rows={3} />
        <SkeletonList rows={2} />
      </div>
    );
  const { day, reviews, debtors, owes, waiting, unsigned, tomorrow: next } = data.data;
  const debt = debtors.reduce((n, d) => n + d.balanceCents, 0);
  const notReminded = next.filter((a) => !a.remindedAt && !a.confirmedAt).length;
  const hasPending = reviews.length > 0 || debtors.length > 0 || unsigned.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Citas de hoy" className="flex flex-col gap-1.5">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase" style={{ fontFamily: "var(--font-sans)" }}>
          {day.length === 0 ? "Hoy no hay citas" : day.length === 1 ? "1 cita" : `${day.length} citas`}
        </h2>
        {day.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-input px-3 py-4 text-center text-sm text-text-muted">Da una con «Nueva cita», arriba.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
            {day.map((a) => (
              <TodayRow key={a.id} a={a} owes={owes.get(a.patientId) ?? 0} onOpen={() => onOpen(a)} onCharge={() => setCharging(a)} />
            ))}
          </ul>
        )}
      </section>

      {hasPending && (
        <Group title="Pendiente">
          {reviews.map((r) => (
            <RowLink
              key={r.patientId}
              to={`/pacientes/${r.patientId}/sesiones`}
              icon={CalendarClock}
              tone="warning"
              title={`Reevaluar a ${r.name}`}
              subtitle={r.reviewOn < today ? `Pendiente desde el ${fmtDate(`${r.reviewOn}T12:00:00`)}` : "Hoy"}
            />
          ))}
          {debtors.length > 0 && (
            <RowLink to="/agenda/cobros" icon={Wallet} tone="warning" title={`Sin cobrar: ${euros(debt)}`} subtitle={debtors.length === 1 ? "1 paciente" : `${debtors.length} pacientes`} />
          )}
          {unsigned.map((u) => (
            <RowLink
              key={u.id}
              to={u.missing[0] === "hoja de protección de datos" ? `/pacientes/${u.id}/proteccion-datos` : `/pacientes/${u.id}/consentimientos`}
              icon={FilePen}
              tone="warning"
              title={`Sin firmar: ${u.name}`}
              subtitle={u.missing.join(" · ")}
            />
          ))}
        </Group>
      )}

      <Group title="Envíos">
        <RowLink
          to="/agenda/envios"
          icon={Send}
          tone={outbox ? "warning" : "accent"}
          title={outbox === null ? "Bandeja de envíos" : outbox === 0 ? "Nada que enviar" : outbox === 1 ? "1 mensaje por enviar" : `${outbox} mensajes por enviar`}
          subtitle="Recordatorios, anamnesis y cuestionarios, listos para WhatsApp"
        />
      </Group>

      <Group title="Mañana">
        <RowLink
          to="/agenda/recordatorios"
          icon={BellRing}
          title={next.length === 0 ? "Sin citas" : next.length === 1 ? "1 cita" : `${next.length} citas`}
          subtitle={next.length === 0 ? "Recordatorios" : notReminded ? `${notReminded} sin recordar · Recordatorios` : "Todas recordadas · Recordatorios"}
        />
      </Group>
      <Group>
        <RowLink to="/agenda/espera" icon={Hourglass} title="Lista de espera" subtitle={waiting === 0 ? "Nadie esperando" : waiting === 1 ? "1 paciente" : `${waiting} pacientes`} />
      </Group>

      {charging && <ChargeSheet item={charging} onClose={() => setCharging(null)} />}
      {offer.data && savedSession && (
        <CalendarSheet
          open
          onClose={closeOffer}
          event={offer.data}
          title="¿Añadir la cita a tu calendario?"
          onNever={() => {
            setCalendarPromptOff();
            closeOffer();
          }}
        />
      )}
    </div>
  );
}

/** Una cita del día: la fila abre su hoja; a la derecha, Atender (si está pendiente) y Cobrar. */
function TodayRow({ a, owes, onOpen, onCharge }: { a: AgendaItem; owes: number; onOpen: () => void; onCharge: () => void }) {
  const Icon = a.status === "done" ? CircleCheck : a.status === "no_show" ? UserX : a.status === "cancelled" ? CalendarX2 : CalendarCheck;
  const off = a.status === "no_show" || a.status === "cancelled";
  const detail = [a.status === "scheduled" ? `${a.minutes} min` : STATUS_LABELS[a.status], owes > 0 && `debe ${euros(owes)}`].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col">
      <button type="button" onClick={onOpen} className="flex min-h-14 min-w-0 items-center gap-3 px-3 pt-2 pb-1 text-left hover:bg-surface">
        <Icon aria-hidden="true" className={cx("size-5 shrink-0", off ? "text-warning" : "text-accent")} />
        <span className="flex min-w-0 flex-col">
          <span className={cx("truncate font-semibold", a.status === "cancelled" && "line-through")}>
            <span className="nums">{hourOf(a.startsAt)}</span> · {a.name}
          </span>
          <span className="truncate text-sm text-text-muted">{detail}</span>
        </span>
      </button>
      {/* Las acciones del día, debajo del nombre: en el móvil el nombre se lee entero. */}
      <div className="flex flex-wrap gap-2 pr-3 pb-2 pl-11">
          {a.status === "scheduled" && (
            <Link
              to={`/pacientes/${a.patientId}/sesiones/nueva?hora=${encodeURIComponent(a.startsAt)}&volver=hoy`}
              className="tap inline-flex items-center justify-center gap-1 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              <NotebookPen aria-hidden="true" className="size-4" /> Atender
            </Link>
          )}
          {!off && (
            <button
              type="button"
              onClick={onCharge}
              aria-label={`Cobrar a ${a.name}`}
              className="tap inline-flex items-center justify-center gap-1 rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface"
            >
              <Wallet aria-hidden="true" className="size-4" /> Cobrar
            </button>
          )}
          <Link to={`/pacientes/${a.patientId}`} aria-label={`Ficha de ${a.name}`} className="tap inline-flex items-center justify-center gap-1 rounded-md px-3 text-sm font-semibold text-accent hover:bg-surface">
            <UserRound aria-hidden="true" className="size-4" /> Ficha
          </Link>
        </div>
    </li>
  );
}

/** Cobrar desde la lista: con lo que debe o, si está al día, el precio de la sesión. */
function ChargeSheet({ item, onClose }: { item: AgendaItem; onClose: () => void }) {
  const toast = useToast();
  const info = useAsync(async () => {
    const db = getDb();
    const [account, pricing] = await Promise.all([patientAccount(db, item.patientId, todayDay()), getPricing(db)]);
    return { account, pricing };
  }, [item.patientId]);
  return (
    <Sheet open onClose={onClose} title={`Cobrar a ${item.name}`}>
      {info.data && (
        <PaymentForm
          today={todayDay()}
          suggested={info.data.account.balanceCents > 0 ? info.data.account.balanceCents : info.data.pricing.sessionCents}
          concept="Sesión de fisioterapia"
          submitLabel="Cobrar"
          onSave={async (input) => {
            await addPayment(getDb(), item.patientId, input);
            toast(`Cobrado: ${euros(input.amountCents)}`, "success");
            bumpData();
            onClose();
          }}
        />
      )}
      <Link to={`/pacientes/${item.patientId}/cobros`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-accent">
        Bonos y cobros de {item.name} <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </Sheet>
  );
}
