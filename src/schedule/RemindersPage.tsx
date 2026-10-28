// Agenda → Recordatorios: las citas de un día (mañana, por defecto) con su mensaje listo para enviar por WhatsApp o por
// correo desde este dispositivo, sin servicios de pago. Se apunta quién se ha recordado y quién ha confirmado.
// Respeta el permiso de contacto de cada paciente (src/data/privacy.ts, «WhatsApp, SMS o correo»).
import { useTeamMode } from "../cloud/teamMode";
import { CircleCheck, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { Page } from "../app/Page";
import { Link } from "react-router";
import { useAsync } from "../app/useAsync";
import { addDays, todayDay } from "../clinical/pageKit";
import { markConfirmed, markReminded, remindersBetween, type ReminderItem } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic, setContactConsent } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { loadMessages, messageSubject } from "../messages/templates";
import { appointmentVars, hourText, mailtoUrl, reminderMessage, waPhone, whatsappUrl } from "./reminders";
import { staffName, useStaff } from "./useStaff";
import { plural } from "../app/format";

const fmtDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export function RemindersPage() {
  const toast = useToast();
  const staff = useStaff();
  const version = useDataVersion();
  const { team } = useTeamMode();
  const today = todayDay();
  const [day, setDay] = useState(addDays(today, 1));
  const [who, setWho] = useState("");
  /** Para enseñar el mensaje como le llega: mañana a las 10:00. */
  const sample = new Date(`${addDays(today, 1)}T10:00:00`).toISOString();
  const data = useAsync(async () => {
    const db = getDb();
    const from = new Date(`${day}T00:00:00`).toISOString();
    const to = new Date(`${addDays(day, 1)}T00:00:00`).toISOString();
    return {
      items: await remindersBetween(db, from, to),
      messages: await loadMessages(db),
      clinic: (await getClinic(db)).name,
    };
  }, [day, version]);

  const items = useMemo(() => (data.data?.items ?? []).filter((a) => !who || (who === "-" ? !a.assignedTo : a.assignedTo === who)), [data.data, who]);
  const reminded = items.filter((a) => a.remindedAt).length;
  const confirmed = items.filter((a) => a.confirmedAt).length;
  const unknown = new Set(items.filter((a) => a.contact === null).map((a) => a.patientId)).size;
  const varsOf = (a: ReminderItem) => ({ name: a.name, startsAt: a.startsAt, clinic: data.data?.clinic ?? "", professional: team && a.assignedTo ? staffName(staff, a.assignedTo) : null });
  const text = (a: ReminderItem) => reminderMessage(data.data?.messages, varsOf(a));
  const subjectOf = (a: ReminderItem) => messageSubject("recordatorio", data.data?.messages, appointmentVars(varsOf(a)));

  async function sent(a: ReminderItem) {
    await markReminded(getDb(), a.id);
    bumpData();
  }

  return (
    <Page title="Recordatorios" backTo="/agenda">
      <p className="text-sm text-text-muted">
        Recuerda las citas por WhatsApp o por correo: el mensaje sale listo y lo envías tú con un toque desde este dispositivo. Sin coste por mensaje. Para mandar
        todos los de mañana seguidos (y la anamnesis de los pacientes nuevos), usa la{" "}
        <Link to="/agenda/envios" className="py-3 font-semibold text-accent underline underline-offset-2">
          bandeja de envíos
        </Link>
        .
      </p>

      <div role="group" aria-label="Día" className="flex flex-wrap items-center gap-2">
        {[
          [today, "Hoy"],
          [addDays(today, 1), "Mañana"],
          [addDays(today, 2), "Pasado mañana"],
        ].map(([d, label]) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            className={cx("tap rounded-full border px-3 text-sm", day === d ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-bg hover:bg-surface")}
            onClick={() => setDay(d!)}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          aria-label="Otro día"
          value={day}
          className="h-11 rounded-md border border-border-input bg-bg px-2 text-sm"
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
      </div>
      {team && (
        <SelectField label="Citas de" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Todo el equipo</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
          <option value="-">Sin asignar</option>
        </SelectField>
      )}

      <section aria-labelledby="h-citas" className="flex flex-col gap-2">
        <h2 id="h-citas" className="text-lg first-letter:uppercase">
          {fmtDay(day)}
        </h2>
        {data.data && (
          <p className="text-sm text-text-muted" role="status">
            {items.length
              ? `${plural(items.length, "cita pendiente", "citas pendientes")} · ${plural(reminded, "recordada", "recordadas")} · ${plural(confirmed, "confirmada", "confirmadas")}`
              : "No hay citas pendientes ese día."}
          </p>
        )}
        {unknown > 0 && (
          <Alert tone="warning" title={`${plural(unknown, "paciente", "pacientes")} sin permiso de contacto apuntado`}>
            Pregúntales si aceptan que les escribáis por WhatsApp o correo y apúntalo en su tarjeta (queda en su ficha, en Protección de datos).
          </Alert>
        )}
        {items.map((a) => (
          <ReminderRow
            key={a.id}
            a={a}
            text={text(a)}
            subject={subjectOf(a)}
            withWhom={team ? staffName(staff, a.assignedTo) : null}
            onSent={() => void sent(a)}
            onConfirm={async (yes) => {
              await markConfirmed(getDb(), a.id, yes);
              bumpData();
              toast(yes ? `${a.name}: confirmada` : `${a.name}: sin confirmar`, "success");
            }}
            onConsent={async (yes) => {
              await setContactConsent(getDb(), a.patientId, yes);
              bumpData();
              toast(yes ? `${a.name}: acepta WhatsApp y correo` : `${a.name}: no acepta WhatsApp ni correo`, "success");
            }}
          />
        ))}
      </section>

      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold">El mensaje</h2>
        <p className="text-sm whitespace-pre-line text-text-muted">
          {reminderMessage(data.data?.messages, { name: "Ana Ruiz", startsAt: sample, clinic: data.data?.clinic ?? "", professional: team ? (staff[0]?.name ?? null) : null })}
        </p>
        {/* El texto es de la clínica y se cambia, con los demás mensajes, en Ajustes. */}
        <Link to="/ajustes/mensajes" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-md border border-border-input bg-bg px-4 font-semibold hover:bg-surface">
          <Pencil aria-hidden="true" className="size-5" /> Cambiar el mensaje
        </Link>
      </Card>
    </Page>
  );
}

function ReminderRow({
  a,
  text,
  subject,
  withWhom,
  onSent,
  onConfirm,
  onConsent,
}: {
  a: ReminderItem;
  text: string;
  subject: string;
  withWhom: string | null;
  onSent: () => void;
  onConfirm: (yes: boolean) => void;
  onConsent: (yes: boolean) => void;
}) {
  const phone = waPhone(a.phone);
  const refused = a.contact === false;
  const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
  return (
    <Card role="group" aria-label={`${hourText(a.startsAt)} · ${a.name}`} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold">
          {hourText(a.startsAt)} ·{" "}
          <Link to={`/pacientes/${a.patientId}`} className="underline decoration-border-input underline-offset-4 hover:text-accent">
            {a.name}
          </Link>
        </p>
        {withWhom && <p className="text-sm text-text-muted">Con {withWhom}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {a.confirmedAt ? (
          <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">Confirmada</span>
        ) : a.remindedAt ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold">Recordada a las {hourText(a.remindedAt)}</span>
        ) : (
          <span className="rounded-full bg-surface px-2 py-0.5">Sin recordar</span>
        )}
        {refused && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-danger">No acepta WhatsApp ni correo</span>}
        {a.contact === null && <span className="rounded-full bg-warning-soft px-2 py-0.5">Sin permiso de contacto registrado</span>}
      </div>
      {refused ? (
        <p className="text-sm text-text-muted">Llámale por teléfono{a.phone ? `: ${a.phone}` : ""}.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")} onClick={onSent}>
              <MessageCircle aria-hidden="true" className="size-5" /> WhatsApp
            </a>
          ) : null}
          {a.email ? (
            <a href={mailtoUrl(a.email, subject, text)} className={cx(link, "border border-border bg-bg hover:bg-surface")} onClick={onSent}>
              <Mail aria-hidden="true" className="size-5" /> Correo
            </a>
          ) : null}
          {!phone && !a.email && <p className="text-sm text-text-muted">Sin teléfono móvil ni correo en su ficha.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={a.confirmedAt ? "ghost" : "secondary"} icon={<CircleCheck aria-hidden="true" className="size-4" />} onClick={() => onConfirm(!a.confirmedAt)}>
          {a.confirmedAt ? "Quitar la confirmación" : "Ha confirmado que viene"}
        </Button>
        {!a.remindedAt && !a.confirmedAt && (
          <Button size="sm" variant="ghost" icon={<Phone aria-hidden="true" className="size-4" />} onClick={onSent}>
            Recordada por teléfono
          </Button>
        )}
      </div>
      {a.contact === null && (
        <div role="group" aria-label={`Permiso de contacto de ${a.name}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">¿Acepta WhatsApp o correo?</span>
          <Button size="sm" variant="secondary" onClick={() => onConsent(true)}>
            Sí, acepta
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onConsent(false)}>
            No
          </Button>
        </div>
      )}
    </Card>
  );
}
