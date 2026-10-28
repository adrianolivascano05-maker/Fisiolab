// Agenda › Envíos: la bandeja con lo que toca mandar hoy (outbox.ts). Se manda por WhatsApp o por correo desde este
// dispositivo, uno a uno o todos seguidos: cada mensaje sale listo y se envía con un toque. Lo enviado se apunta (y se
// sincroniza) para que no salga otra vez ni lo mande otra persona del equipo.
import { CircleSlash, Mail, MessageCircle, Send, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { ANAMNESIS_KIND, formTitle } from "../clinical/patientForms";
import { useAnamnesisSections } from "../clinical/useAnamnesis";
import { useCloud } from "../cloud/CloudGate";
import { useTeamMode } from "../cloud/teamMode";
import { markReminded } from "../data/appointments";
import { getDb } from "../data/db";
import { markOutbox } from "../data/outbox";
import { memberEmail } from "../data/member";
import { getClinic } from "../data/privacy";
import { useGranted } from "../data/questionnairePermissions";
import { setSetting } from "../data/repo";
import { recordSentForms, uploadPatientForm, type UploadedForm } from "../patientForm/createForm";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { loadOutbox } from "./loadOutbox";
import {
  anamnesisText,
  followUpText,
  itemWhen,
  OUTBOX_SETTINGS_KEY,
  outboxSettings,
  RULE_LABELS,
  type OutboxItem,
  type OutboxRule,
  type OutboxSettings,
} from "./outbox";
import { loadMessages, messageSubject, type MessageKind } from "../messages/templates";
import { mailtoUrl, reminderMessage, waPhone, whatsappUrl } from "./reminders";
import { staffName, useStaff } from "./useStaff";
import { plural } from "../app/format";

/** El mensaje de cada regla de la bandeja (Ajustes › Mensajes a pacientes). */
const KIND: Record<OutboxRule, MessageKind> = { recordatorio: "recordatorio", anamnesis: "anamnesis", seguimiento: "seguimiento" };

/** El mensaje de cada envío, ya con sus enlaces (y los formularios que lleva, que se apuntan al enviarlo). */
type Prepared = { text: string; forms?: UploadedForm[] } | { error: string };

export function OutboxPage() {
  const toast = useToast();
  const cloud = useCloud();
  const version = useDataVersion();
  const granted = useGranted();
  const sections = useAnamnesisSections();
  const staff = useStaff();
  const { team } = useTeamMode();
  const data = useAsync(async () => {
    const db = getDb();
    const [out, messages, clinic] = await Promise.all([loadOutbox(db, granted), loadMessages(db), getClinic(db)]);
    return { ...out, messages, clinicName: clinic.name || cloud?.clinic?.name || "" };
  }, [version, granted.join(",")]);
  /** Los envíos que se están mandando (uno o todos seguidos) y por cuál va. */
  const [run, setRun] = useState<{ ids: string[]; at: number } | null>(null);
  const [prepared, setPrepared] = useState<Record<string, Prepared>>({});
  const online = !!(cloud?.clinic && cloud.clinics);

  if (data.error) return <Page title="Envíos" backTo="/agenda?vista=hoy"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Envíos" backTo="/agenda?vista=hoy"><Loading /></Page>;
  const { items, settings, messages, clinicName } = data.data;
  const byId = new Map(items.map((i) => [i.id, i]));
  const ready = items.filter((i) => !i.needsForms || online);
  const blocked = items.length - ready.length;

  /** El mensaje de un envío: el de los recordatorios sale ya; los demás llevan enlaces que se crean en el servidor. */
  async function prepare(i: OutboxItem): Promise<Prepared> {
    const db = getDb();
    const a = i.appointment;
    const professional = team && a?.assignedTo ? staffName(staff, a.assignedTo) : null;
    if (i.rule === "recordatorio") return { text: reminderMessage(messages, { name: i.name, startsAt: a!.startsAt, clinic: clinicName, professional }) };
    try {
      if (i.rule === "anamnesis") {
        const f = await uploadPatientForm(db, cloud, { patientId: i.patientId, patientName: i.name, kind: ANAMNESIS_KIND, clinicName, sections });
        return { text: anamnesisText({ name: i.name, clinic: clinicName, startsAt: i.appointment!.startsAt, url: f.url }, messages), forms: [f] };
      }
      const forms: UploadedForm[] = [];
      for (const kind of i.kinds ?? []) forms.push(await uploadPatientForm(db, cloud, { patientId: i.patientId, patientName: i.name, kind, clinicName, sections }));
      const links = forms.map((f) => ({ title: formTitle(f.record.kind), url: f.url }));
      return { text: followUpText({ name: i.name, clinic: clinicName, reviewOn: i.reviewOn!, links }, messages), forms };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  async function sent(i: OutboxItem) {
    const db = getDb();
    // Los formularios que llevaba el mensaje se apuntan ahora, al enviarlo (si se salta, no cuentan como enviados).
    const p = prepared[i.id];
    if (p && "forms" in p && p.forms?.length) await recordSentForms(db, p.forms);
    if (i.rule === "recordatorio") await markReminded(db, i.appointment!.id);
    else await markOutbox(db, { id: i.id, patientId: i.patientId, rule: i.rule, status: "sent", by: memberEmail() ?? "" });
  }
  async function skip(i: OutboxItem) {
    await markOutbox(getDb(), { id: i.id, patientId: i.patientId, rule: i.rule, status: "skipped", by: memberEmail() ?? "" });
  }

  const groups = (Object.keys(RULE_LABELS) as OutboxRule[]).map((rule) => ({ rule, list: items.filter((i) => i.rule === rule) })).filter((g) => g.list.length);

  return (
    <Page title="Envíos" backTo="/agenda?vista=hoy" backLabel="Hoy">
      <p className="text-sm text-text-muted">
        Lo que toca mandar hoy a tus pacientes, ya escrito. Se envía por WhatsApp o por correo desde este dispositivo, con un toque cada uno: sin coste por mensaje. Lo
        que envíes se apunta para que no salga otra vez.
      </p>

      {items.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Nada que enviar ahora</p>
          <p className="text-sm text-text-muted">Los recordatorios salen el día antes de cada cita; la anamnesis, antes de la primera cita.</p>
        </Card>
      ) : (
        <>
          {ready.length > 0 && (
            <Button size="lg" block icon={<Send aria-hidden="true" className="size-5" />} onClick={() => setRun({ ids: ready.map((i) => i.id), at: 0 })}>
              {ready.length === 1 ? "Enviar el mensaje" : `Enviar los ${ready.length} uno tras otro`}
            </Button>
          )}
          {blocked > 0 && (
            <Alert tone="info" title={`${plural(blocked, "envío necesita", "envíos necesitan")} el servidor de la clínica`}>
              La anamnesis y los cuestionarios van por un enlace que se crea en el servidor de la clínica.{" "}
              <Link to="/ajustes/cuenta" className="py-3 font-semibold underline underline-offset-2">
                Ajustes › Cuenta de Google
              </Link>
              .
            </Alert>
          )}
          {groups.map(({ rule, list }) => (
            <section key={rule} aria-labelledby={`h-${rule}`} className="flex flex-col gap-2">
              <h2 id={`h-${rule}`} className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase" style={{ fontFamily: "var(--font-sans)" }}>
                {RULE_LABELS[rule].title} · {list.length}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
                {list.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link to={`/pacientes/${i.patientId}`} className="self-start font-semibold underline decoration-border-input underline-offset-4 hover:text-accent">
                        {i.name}
                      </Link>
                      <span className="text-sm text-text-muted first-letter:uppercase">{itemWhen(i)}</span>
                      {i.kinds && <span className="text-sm text-text-muted">{i.kinds.map(formTitle).join(", ")}</span>}
                      {i.contact === null && <span className="text-xs text-warning">Sin permiso de contacto apuntado</span>}
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="secondary" disabled={i.needsForms && !online} onClick={() => setRun({ ids: [i.id], at: 0 })}>
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`No enviar a ${i.name}`}
                        onClick={async () => {
                          await skip(i);
                          bumpData();
                          toast(`${i.name}: no se enviará`);
                        }}
                      >
                        No enviar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <OutboxSettingsCard settings={settings} />

      <Sheet open={!!run} onClose={() => setRun(null)} title={run && run.ids.length > 1 ? `Enviar (${Math.min(run.at + 1, run.ids.length)} de ${run.ids.length})` : "Enviar"}>
        {run && (
          <SendStep
            key={run.ids[run.at] ?? "fin"}
            item={byId.get(run.ids[run.at] ?? "") ?? null}
            prepared={prepared[run.ids[run.at] ?? ""]}
            subjectOf={(i) => messageSubject(KIND[i.rule], messages, { clinica: clinicName })}
            onPrepare={async (i) => {
              const p = await prepare(i);
              setPrepared((m) => ({ ...m, [i.id]: p }));
            }}
            onSent={async (i) => {
              await sent(i);
              // Un momento para que se abra WhatsApp; después, el siguiente.
              setTimeout(() => {
                setRun((r) => (r ? { ...r, at: r.at + 1 } : r));
                bumpData();
              }, 400);
            }}
            onSkip={() => setRun((r) => (r ? { ...r, at: r.at + 1 } : r))}
            onNever={async (i) => {
              await skip(i);
              setRun((r) => (r ? { ...r, at: r.at + 1 } : r));
              bumpData();
            }}
            onClose={() => setRun(null)}
          />
        )}
      </Sheet>
    </Page>
  );
}

/** Un envío de la tanda: el mensaje (con sus enlaces ya creados) y los botones para mandarlo. */
function SendStep({
  item,
  prepared,
  subjectOf,
  onPrepare,
  onSent,
  onSkip,
  onNever,
  onClose,
}: {
  item: OutboxItem | null;
  prepared: Prepared | undefined;
  /** El asunto del correo de un envío (Ajustes › Mensajes a pacientes). */
  subjectOf: (i: OutboxItem) => string;
  onPrepare: (i: OutboxItem) => Promise<void>;
  onSent: (i: OutboxItem) => Promise<void>;
  onSkip: () => void;
  onNever: (i: OutboxItem) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (item && !prepared) void onPrepare(item);
    // Solo al llegar a este envío.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  if (!item) {
    return (
      <>
        <p role="status" className="font-semibold">
          Hecho: no queda nada por enviar en esta tanda.
        </p>
        <Button block onClick={onClose}>
          Terminar
        </Button>
      </>
    );
  }
  const phone = item.contact === false ? null : waPhone(item.phone);
  const email = item.contact === false ? "" : item.email;
  const link = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 font-semibold";
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-semibold">
          <Link to={`/pacientes/${item.patientId}`} className="underline decoration-border-input underline-offset-4 hover:text-accent">
            {item.name}
          </Link>
        </p>
        <p className="text-sm text-text-muted">
          {RULE_LABELS[item.rule].title} · <span className="first-letter:uppercase">{itemWhen(item)}</span>
        </p>
      </div>
      {!prepared ? (
        <p role="status" aria-busy="true" className="text-text-muted">
          Preparando el enlace…
        </p>
      ) : "error" in prepared ? (
        <Alert tone="danger" title="No se ha podido preparar">
          {prepared.error}
        </Alert>
      ) : (
        <>
          <p aria-label="Mensaje" className="max-h-60 overflow-auto rounded-md bg-surface p-3 text-sm whitespace-pre-line break-words">
            {prepared.text}
          </p>
          {phone && (
            <a href={whatsappUrl(phone, prepared.text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")} onClick={() => void onSent(item)}>
              <MessageCircle aria-hidden="true" className="size-5" /> Enviar por WhatsApp
            </a>
          )}
          {email && (
            <a href={mailtoUrl(email, subjectOf(item), prepared.text)} className={cx(link, "border border-border bg-bg hover:bg-surface")} onClick={() => void onSent(item)}>
              <Mail aria-hidden="true" className="size-5" /> Enviar por correo
            </a>
          )}
          {!phone && !email && (
            <>
              <p className="text-sm text-text-muted">
                {item.contact === false ? "No acepta WhatsApp ni correo" : "No tiene móvil ni correo en su ficha"}
                {item.phone ? `: llámale al ${item.phone}.` : "."}
              </p>
              <Button variant="secondary" onClick={() => void onSent(item)}>
                Hecho por teléfono
              </Button>
            </>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" icon={<SkipForward aria-hidden="true" className="size-4" />} onClick={onSkip}>
          Saltar por ahora
        </Button>
        <Button variant="ghost" icon={<CircleSlash aria-hidden="true" className="size-4" />} onClick={() => void onNever(item)}>
          No enviar
        </Button>
      </div>
    </div>
  );
}

/** Qué se manda y con cuánta antelación. Es lo mismo para toda la clínica. */
function OutboxSettingsCard({ settings: saved }: { settings: OutboxSettings }) {
  const toast = useToast();
  // Lo marcado se ve al momento, sin esperar a que se guarde y se vuelva a leer.
  const [draft, setDraft] = useState<OutboxSettings | null>(null);
  const settings = draft ?? saved;
  const save = async (patch: Partial<OutboxSettings>) => {
    const next = outboxSettings({ ...settings, ...patch });
    setDraft(next);
    await setSetting(getDb(), OUTBOX_SETTINGS_KEY, next);
    bumpData();
    toast("Guardado: es lo mismo para toda la clínica", "success");
  };
  const check = "flex min-h-11 items-center gap-3";
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold">Qué se prepara</h2>
      <label className={check}>
        <input type="checkbox" className="size-5 accent-accent" checked={settings.reminders} onChange={(e) => void save({ reminders: e.target.checked })} />
        Recordatorio de la cita, el día antes
      </label>
      <label className={check}>
        <input type="checkbox" className="size-5 accent-accent" checked={settings.anamnesis} onChange={(e) => void save({ anamnesis: e.target.checked })} />
        Su anamnesis antes de la primera cita
      </label>
      {settings.anamnesis && (
        <SelectField label="Con cuánta antelación" value={String(settings.anamnesisHours)} onChange={(e) => void save({ anamnesisHours: Number(e.target.value) })}>
          <option value="24">24 horas antes</option>
          <option value="48">48 horas antes</option>
          <option value="72">72 horas antes</option>
        </SelectField>
      )}
      <label className={check}>
        <input type="checkbox" className="size-5 accent-accent" checked={settings.followUp} onChange={(e) => void save({ followUp: e.target.checked })} />
        Sus cuestionarios antes de reevaluar
      </label>
      {settings.followUp && (
        <SelectField label="Cuántos días antes de la reevaluación" value={String(settings.followUpDays)} onChange={(e) => void save({ followUpDays: Number(e.target.value) })}>
          <option value="1">1 día antes</option>
          <option value="2">2 días antes</option>
          <option value="3">3 días antes</option>
        </SelectField>
      )}
      <p className="text-sm text-text-muted">
        Si una cita se da con menos antelación, su anamnesis sale en cuanto entra en la bandeja. El texto del recordatorio se cambia en{" "}
        <Link to="/agenda/recordatorios" className="py-3 font-semibold text-accent underline underline-offset-2">
          Recordatorios
        </Link>
        .
      </p>
    </Card>
  );
}
