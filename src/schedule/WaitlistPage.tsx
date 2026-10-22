// Agenda → Lista de espera (src/data/waitlist.ts): quién quiere un hueco antes, cuándo le viene bien (mañanas o
// tardes, qué días) y, en un equipo, con quién. Desde una cita anulada o borrada se llega con el hueco libre
// (?hueco=…&min=…&con=…): primero salen a quienes les encaja; a cada uno se le ofrece por WhatsApp o correo, con el
// mensaje listo (queda apuntado), y se le da la cita con un toque. Desde la ficha se llega con ?paciente=… para
// apuntarlo.
import { useTeamMode } from "../cloud/teamMode";
import { CalendarPlus, Mail, MessageCircle, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { madridDay } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { PatientPicker } from "../clinical/AppointmentSheet";
import { clashes, createAppointment, updateAppointment } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { addToWaitlist, fits, listWaitlist, markOffered, preferText, removeFromWaitlist, updateWaitlist, WEEKDAY_NAMES, WEEKDAYS, type PreferTime, type WaitInput, type WaitItem } from "../data/waitlist";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { dayText, hourText, mailtoUrl, offerText, waPhone, whatsappUrl } from "./reminders";
import { staffName, useStaff } from "./useStaff";

const waiting = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days < 1 ? "Esperando desde hoy" : days === 1 ? "Esperando desde ayer" : `Esperando desde hace ${days} días`;
};
const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";

export function WaitlistPage() {
  const { team } = useTeamMode();
  const staff = useStaff();
  const toast = useToast();
  const navigate = useNavigate();
  const version = useDataVersion();
  const [params, setParams] = useSearchParams();
  const slot = params.get("hueco");
  const slotMinutes = Number(params.get("min")) || 45;
  const slotWho = params.get("con") || null;
  const free = slot && !Number.isNaN(Date.parse(slot)) && Date.parse(slot) > Date.now() ? slot : null;
  const forPatient = params.get("paciente");
  const data = useAsync(async () => {
    const db = getDb();
    const [items, clinic, patient] = await Promise.all([listWaitlist(db, free && team ? slotWho : undefined), getClinic(db), forPatient ? getPatient(db, forPatient) : null]);
    return { items, clinic: clinic.name, patient };
  }, [version, free, slotWho, team, forPatient]);
  /** Añadir (sin `item`) o cambiar una entrada. */
  const [form, setForm] = useState<{ item?: WaitItem } | null>(null);

  const [giving, setGiving] = useState<string | null>(null);
  /** Ya tiene una cita más tarde: ¿se anula al darle este hueco? */
  const [asking, setAsking] = useState<WaitItem | null>(null);

  async function give(w: WaitItem, cancelOld?: boolean) {
    if (giving) return;
    if (cancelOld === undefined && w.nextId && w.nextAt && w.nextAt > free!) return setAsking(w);
    setAsking(null);
    setGiving(w.id);
    try {
      const db = getDb();
      // Otro dispositivo (o un toque doble) puede haberlo dado ya.
      const taken = await clashes(db, free!, slotMinutes, team ? slotWho : undefined);
      if (taken.length) {
        toast(`Ese hueco ya está ocupado: ${taken.map((t) => t.name).join(", ")}`, "danger");
        return;
      }
      await createAppointment(db, w.patientId, { startsAt: free!, minutes: slotMinutes, ...(team ? { assignedTo: slotWho } : {}) });
      if (cancelOld && w.nextId) await updateAppointment(db, w.nextId, { status: "cancelled" });
      await removeFromWaitlist(db, w.id);
      bumpData();
      toast(`Cita dada a ${w.name}: ${dayText(free!)}, ${hourText(free!)}${cancelOld ? " (anulada la de después)" : ""}`, "success");
      // Sin volver a este hueco con «atrás»: ya no está libre.
      navigate(`/agenda?dia=${madridDay(free!)}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setGiving(null);
    }
  }
  async function offered(w: WaitItem) {
    await markOffered(getDb(), w.id);
    bumpData();
  }

  // Con un hueco libre, primero a quienes les encaja (y entre ellos, quien más lleva esperando).
  const items = [...(data.data?.items ?? [])].filter((w) => !free || w.patientId !== params.get("sin")).sort((a, b) => (free ? Number(fits(b, free)) - Number(fits(a, free)) : 0) || a.createdAt.localeCompare(b.createdAt));
  const patient = data.data?.patient;
  const already = patient ? items.find((w) => w.patientId === patient.id) : undefined;
  const opening = !!patient && !already && !form;

  return (
    <Page title="Lista de espera" backTo="/agenda">
      {free ? (
        <Alert tone="info" title={`Hueco libre: ${dayText(free)}, a las ${hourText(free)}`}>
          {team && slotWho ? `Con ${staffName(staff, slotWho)}. ` : ""}Primero salen a quienes les encaja. Ofrécelo; si dice que sí, dale la cita aquí.
        </Alert>
      ) : (
        <p className="text-sm text-text-muted">
          Apunta a quien quiere venir antes o espera un hueco, con cuándo le viene bien. Cuando se anule una cita, la app te enseñará esta lista para ofrecérselo.
        </p>
      )}

      {data.data && items.length === 0 && <p className="text-sm text-text-muted">No hay nadie esperando.</p>}
      <ul aria-label="Lista de espera" className="flex flex-col gap-2">
        {items.map((w) => {
          const phone = waPhone(w.phone);
          const text = free ? offerText({ name: w.name, startsAt: free, clinic: data.data!.clinic, professional: team && slotWho ? staffName(staff, slotWho) : null }) : "";
          const ok = free ? fits(w, free) : null;
          return (
            <li key={w.id}>
              <Card role="group" aria-label={w.name} className={cx("flex flex-col gap-2", ok === false && "opacity-80")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-sm text-text-muted">{waiting(w.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-surface px-2 py-0.5">{preferText(w)}</span>
                  {ok === true && <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">Le encaja este hueco</span>}
                  {ok === false && <span className="rounded-full bg-warning-soft px-2 py-0.5">No es su horario</span>}
                  {w.offeredAt && <span className="rounded-full bg-accent-soft px-2 py-0.5">Ofrecido el {dayText(w.offeredAt)}, {hourText(w.offeredAt)}</span>}
                </div>
                {w.note && <p className="text-sm">{w.note}</p>}
                <p className="text-sm text-text-muted">
                  {[team && (w.assignedTo ? `Con ${staffName(staff, w.assignedTo)}` : "Con cualquiera"), w.nextAt ? `Su próxima cita: ${dayText(w.nextAt)}, ${hourText(w.nextAt)}` : "Sin cita pendiente"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {free && (
                  <div className="flex flex-wrap gap-2">
                    {w.contact !== false && phone && (
                      <a
                        href={whatsappUrl(phone, text)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}
                        onClick={() => void offered(w)}
                      >
                        <MessageCircle aria-hidden="true" className="size-5" /> Ofrecer por WhatsApp
                      </a>
                    )}
                    {w.contact !== false && w.email && (
                      <a href={mailtoUrl(w.email, "Hueco libre para tu fisioterapia", text)} className={cx(link, "border border-border bg-bg hover:bg-surface")} onClick={() => void offered(w)}>
                        <Mail aria-hidden="true" className="size-5" /> Correo
                      </a>
                    )}
                    {(w.contact === false || (!phone && !w.email)) && <p className="text-sm text-text-muted">Llámale{w.phone ? `: ${w.phone}` : ""}.</p>}
                    <Button variant="secondary" loading={giving === w.id} icon={<CalendarPlus aria-hidden="true" className="size-5" />} onClick={() => void give(w)}>
                      Darle la cita
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={() => setForm({ item: w })}>
                    Cambiar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash aria-hidden="true" className="size-4" />}
                    onClick={async () => {
                      await removeFromWaitlist(getDb(), w.id);
                      bumpData();
                      toast(`${w.name}: fuera de la lista`, "success");
                    }}
                  >
                    Quitar de la lista
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Button variant={free ? "secondary" : "primary"} icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setForm({})}>
        Añadir a la lista
      </Button>

      <Sheet open={!!asking} onClose={() => setAsking(null)} title={asking ? `${asking.name} ya tiene cita` : ""}>
        {asking && (
          <>
            <p>
              Tiene cita el {dayText(asking.nextAt!)}, a las {hourText(asking.nextAt!)}. Al darle el hueco del {dayText(free!)}, a las {hourText(free!)}, ¿qué hacemos con esa?
            </p>
            <Button block onClick={() => void give(asking, true)}>
              Anularla (adelanta su cita)
            </Button>
            <Button variant="secondary" block onClick={() => void give(asking, false)}>
              Mantener las dos
            </Button>
          </>
        )}
      </Sheet>
      <Sheet
        open={!!form || opening}
        onClose={() => {
          setForm(null);
          if (forPatient) setParams({}, { replace: true });
        }}
        title={form?.item ? `Lista de espera: ${form.item.name}` : "Añadir a la lista de espera"}
      >
        {(form || opening) && (
          <WaitForm
            team={team}
            staff={staff}
            item={form?.item}
            patient={!form?.item && patient ? { id: patient.id, name: patient.name } : null}
            onSave={async (patientId, input) => {
              if (form?.item) await updateWaitlist(getDb(), form.item.id, input);
              else await addToWaitlist(getDb(), patientId, input);
              setForm(null);
              if (forPatient) setParams({}, { replace: true });
              bumpData();
              toast(form?.item ? "Cambiado" : "Añadido a la lista de espera", "success");
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

const chip = (on: boolean) =>
  cx(
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill border px-3 text-sm",
    on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border-input bg-bg",
    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
  );

function WaitForm({
  team,
  staff,
  item,
  patient,
  onSave,
}: {
  team: boolean;
  staff: { email: string; name: string }[];
  item?: WaitItem;
  patient: { id: string; name: string } | null;
  onSave: (patientId: string, input: WaitInput) => Promise<void>;
}) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(item ? { id: item.patientId, name: item.name } : patient);
  const [note, setNote] = useState(item?.note ?? "");
  const [who, setWho] = useState(item?.assignedTo ?? "");
  const [time, setTime] = useState<PreferTime>(item?.preferTime ?? "");
  const [days, setDays] = useState<number[]>(item?.preferDays ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!picked) return setError("Elige el paciente.");
        setBusy(true);
        setError(null);
        try {
          await onSave(picked.id, { note, assignedTo: who || null, preferTime: time, preferDays: days });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {item ? null : (
        <PatientPicker
          picked={picked}
          onPick={(p) => {
            setPicked(p);
            setError(null);
          }}
        />
      )}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">Cuándo le viene bien</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["", "Cualquier hora"],
              ["manana", "Mañanas"],
              ["tarde", "Tardes"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="relative">
              <input type="radio" name="franja" checked={time === v} onChange={() => setTime(v)} className="peer sr-only" />
              <span className={chip(time === v)}>{label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Días">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="relative">
              <input
                type="checkbox"
                aria-label={WEEKDAY_NAMES[i]}
                checked={days.includes(i + 1)}
                onChange={() => setDays(days.includes(i + 1) ? days.filter((x) => x !== i + 1) : [...days, i + 1])}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={chip(days.includes(i + 1))}>
                {d}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted">Sin días marcados: cualquier día. Mañanas, hasta las 14:00.</p>
      </fieldset>
      <TextField label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quiere adelantar su cita, solo a partir de las 18:00…" />
      {team && (
        <SelectField label="Con quién" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Con cualquiera</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        {item ? "Guardar" : "Añadir a la lista"}
      </Button>
    </form>
  );
}
