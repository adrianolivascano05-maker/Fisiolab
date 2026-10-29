// Los paneles de la hoja de la cita (AppointmentSheet.tsx) que no son el formulario: recordarla antes del día,
// cobrar en el momento, lo que sigue a «No vino» (darle otra o deshacerlo) y el hueco que se queda libre con gente en
// la lista de espera.
import { CalendarClock, Hourglass, Mail, MessageCircle, Phone, RotateCcw, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { clashes, createAppointment, markConfirmed, markReminded, updateAppointment, type AgendaItem, type Appointment } from "../data/appointments";
import { accountLine, addPayment, euros, getPricing, patientAccount } from "../data/billing";
import { getDb } from "../data/db";
import { mayMessage } from "../data/privacy";
import { ContactNote } from "../privacy/ContactNote";
import { mailtoUrl, whatsappUrl } from "../schedule/reminders";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { PaymentForm } from "./billingForms";
import { fmtVisit, visitEvent } from "./calendar";
import { CalendarButton } from "./CalendarButton";
import { localInput, todayDay } from "./pageKit";
import type { RunAction, Staff } from "./AppointmentForm";

/** Cómo recordarle la cita al paciente: teléfono, correo, permiso de contacto, mensaje y la cita para su calendario. */
export type ReminderInfo = {
  phone: string;
  wa: string | null;
  email: string;
  contact: boolean | null;
  event: ReturnType<typeof visitEvent> | null;
  reminder: string;
  subject: string;
};

/** Antes del día de la cita: recordarla por WhatsApp, correo o teléfono, pasarla al calendario y anotar que ha confirmado. */
export function ReminderActions({ appointment, info, autoCalendar, busy, run }: { appointment: Appointment; info: ReminderInfo; autoCalendar: boolean; busy: boolean; run: RunAction }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {mayMessage(info.contact) && info.wa && (
          <a
            href={whatsappUrl(info.wa, info.reminder)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover"
            onClick={() => void markReminded(getDb(), appointment.id).then(() => bumpData("appointments"))}
          >
            <MessageCircle aria-hidden="true" className="size-5" /> Recordar por WhatsApp
          </a>
        )}
        {mayMessage(info.contact) && info.email && (
          <a
            href={mailtoUrl(info.email, info.subject, info.reminder)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-4 font-semibold hover:bg-surface"
            onClick={() => void markReminded(getDb(), appointment.id).then(() => bumpData("appointments"))}
          >
            <Mail aria-hidden="true" className="size-5" /> Correo
          </a>
        )}
        {info.phone && (
          <a href={`tel:${info.phone.replace(/\s+/g, "")}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg px-4 font-semibold hover:bg-surface">
            <Phone aria-hidden="true" className="size-5" /> Llamar
          </a>
        )}
      </div>
      <ContactNote contact={info.contact} patientId={appointment.patientId} />
      {/* Sin Google Calendar conectado: pasar la cita al calendario del fisio (antes, un botón en la cabecera de la ficha). */}
      {autoCalendar ? <p className="text-sm text-text-muted">Apuntada en tu Google Calendar</p> : info.event && <CalendarButton event={info.event} />}
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        loading={busy}
        onClick={() => void run(() => markConfirmed(getDb(), appointment.id, !appointment.confirmedAt), appointment.confirmedAt ? "Confirmación quitada" : "Anotado: confirmada")}
      >
        {appointment.confirmedAt ? "Quitar la confirmación" : "Ha confirmado que viene"}
      </Button>
    </div>
  );
}

/** Su cuenta (bono y pendiente) y cobrar aquí mismo. `onPaid`: volver a leer la cuenta. */
export function PayPanel({
  account,
  pricing,
  patientId,
  onPaid,
}: {
  account: Awaited<ReturnType<typeof patientAccount>>;
  pricing: Awaited<ReturnType<typeof getPricing>>;
  patientId: string;
  onPaid: () => void;
}) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">Cuenta: </span>
          {accountLine(account) ?? "al día"}
        </p>
        {!paying && (
          <Button size="sm" variant="secondary" icon={<Wallet aria-hidden="true" className="size-4" />} onClick={() => setPaying(true)}>
            Cobrar
          </Button>
        )}
      </div>
      {paying && (
        <PaymentForm
          today={todayDay()}
          suggested={account.balanceCents > 0 ? account.balanceCents : pricing.sessionCents}
          concept="Sesión de fisioterapia"
          submitLabel="Cobrar"
          onSave={async (input) => {
            await addPayment(getDb(), patientId, input);
            setPaying(false);
            toast(`Cobrado: ${euros(input.amountCents)}`, "success");
            bumpData("payments");
            onPaid();
          }}
        />
      )}
    </div>
  );
}

/** La misma hora del reloj unos días después (también si cambia la hora entre medias). */
const daysLater = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Después de «No vino»: darle otra cita (por defecto, la semana siguiente a la misma hora) o deshacerlo. */
export function MissedPanel({ missed, staff, busy, run, onClose }: { missed: Appointment; staff: Staff; busy: boolean; run: RunAction; onClose: () => void }) {
  const [rebookAt, setRebookAt] = useState(() => localInput(daysLater(missed.startsAt, 7)));
  const [rebookClash, setRebookClash] = useState<AgendaItem[] | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p>
        Anotado que no vino a la cita del <span className="font-semibold">{fmtVisit(missed.startsAt)}</span>. ¿Le das otra? Elige el día y la hora que quieras.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos para la nueva cita">
        {[1, 2, 7, 14].map((d) => (
          <Button key={d} size="sm" variant={rebookAt === localInput(daysLater(missed.startsAt, d)) ? "primary" : "secondary"} onClick={() => setRebookAt(localInput(daysLater(missed.startsAt, d)))}>
            {d === 1 ? "Al día siguiente" : d === 2 ? "En 2 días" : d === 7 ? "En 1 semana" : "En 2 semanas"}
          </Button>
        ))}
      </div>
      <TextField
        label="Nueva cita"
        type="datetime-local"
        value={rebookAt}
        onChange={(e) => {
          setRebookAt(e.target.value);
          setRebookClash(null);
        }}
        hint="A la misma hora; cambia el día o la hora como quieras."
      />
      {rebookClash && rebookClash.length > 0 && (
        <Alert tone="warning" title={rebookClash.length === 1 ? "A esa hora ya hay otra cita" : `A esa hora ya hay ${rebookClash.length} citas`}>
          {rebookClash.map((c) => `${c.name} (${fmtVisit(c.startsAt)})`).join(" · ")}. Puedes darla igualmente o elegir otra hora.
        </Alert>
      )}
      <Button
        loading={busy}
        disabled={!rebookAt}
        icon={<CalendarClock aria-hidden="true" className="size-5" />}
        onClick={async () => {
          const startsAt = new Date(rebookAt).toISOString();
          if (!rebookClash) {
            const found = await clashes(getDb(), startsAt, missed.minutes, staff.length ? (missed.assignedTo ?? null) : undefined);
            if (found.length) return setRebookClash(found);
          }
          void run(
            () => createAppointment(getDb(), missed.patientId, { startsAt, minutes: missed.minutes, assignedTo: missed.assignedTo ?? null }),
            `Nueva cita: ${fmtVisit(startsAt)}`,
          );
        }}
      >
        {rebookClash?.length ? "Darle la cita igualmente" : "Darle esta cita"}
      </Button>
      <Button variant="secondary" loading={busy} icon={<RotateCcw aria-hidden="true" className="size-5" />} onClick={() => void run(() => updateAppointment(getDb(), missed.id, { status: "scheduled" }), "Deshecho: la cita vuelve a estar pendiente")}>
        Deshacer «No vino»
      </Button>
      <Button variant="ghost" onClick={onClose}>
        Listo
      </Button>
    </div>
  );
}

/** Al anular o borrar una cita futura con gente en la lista de espera: el hueco, para ofrecérselo. */
export type FreedSlot = { startsAt: string; minutes: number; assignedTo: string | null; waiting: number; patientId: string };

export function FreedSlotPanel({ freed, onClose }: { freed: FreedSlot; onClose: () => void }) {
  /** El panel sustituye a los botones: el foco, a su acción principal. */
  const offerRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    offerRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info" title={freed.waiting === 1 ? "Hay 1 paciente en la lista de espera" : `Hay ${freed.waiting} pacientes en la lista de espera`}>
        Se ha quedado libre el hueco del {fmtVisit(freed.startsAt)}. ¿Se lo ofreces?
      </Alert>
      <Link
        ref={offerRef}
        to={`/agenda/espera?${new URLSearchParams({ hueco: freed.startsAt, min: String(freed.minutes), sin: freed.patientId, ...(freed.assignedTo ? { con: freed.assignedTo } : {}) })}`}
        onClick={onClose}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover"
      >
        <Hourglass aria-hidden="true" className="size-5" /> Ofrecer el hueco
      </Link>
      <Button variant="secondary" onClick={onClose}>
        Ahora no
      </Button>
    </div>
  );
}
