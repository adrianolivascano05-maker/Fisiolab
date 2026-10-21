// Agenda → Lista de espera (src/data/waitlist.ts): quién quiere un hueco antes, cuándo le viene bien y, en un equipo,
// con quién. Desde una cita anulada o borrada se llega con el hueco libre (?hueco=…&min=…&con=…): a cada uno se le
// puede ofrecer por WhatsApp o correo, con el mensaje listo, y darle la cita con un toque.
import { CalendarPlus, Mail, MessageCircle, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { PatientPicker } from "../clinical/AppointmentSheet";
import { useCloud } from "../cloud/CloudGate";
import { createAppointment } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { addToWaitlist, listWaitlist, removeFromWaitlist, type WaitItem } from "../data/waitlist";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { dayText, hourText, mailtoUrl, offerText, waPhone, whatsappUrl } from "./reminders";
import { staffName, useStaff } from "./useStaff";

const since = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days < 1 ? "desde hoy" : days === 1 ? "desde ayer" : `hace ${days} días`;
};

export function WaitlistPage() {
  const cloud = useCloud();
  const team = !!cloud?.clinic;
  const staff = useStaff();
  const toast = useToast();
  const navigate = useNavigate();
  const version = useDataVersion();
  const [params] = useSearchParams();
  const slot = params.get("hueco");
  const slotMinutes = Number(params.get("min")) || 45;
  const slotWho = params.get("con") || null;
  const free = slot && !Number.isNaN(Date.parse(slot)) && Date.parse(slot) > Date.now() ? slot : null;
  const data = useAsync(async () => {
    const db = getDb();
    return { items: await listWaitlist(db, free && team ? slotWho : undefined), clinic: (await getClinic(db)).name };
  }, [version, free, slotWho, team]);
  const [adding, setAdding] = useState(false);

  async function give(w: WaitItem) {
    await createAppointment(getDb(), w.patientId, { startsAt: free!, minutes: slotMinutes, ...(team ? { assignedTo: slotWho } : {}) });
    await removeFromWaitlist(getDb(), w.id);
    bumpData();
    toast(`Cita dada a ${w.name}: ${dayText(free!)}, ${hourText(free!)}`, "success");
    navigate("/agenda");
  }

  return (
    <Page title="Lista de espera" backTo="/agenda">
      {free ? (
        <Alert tone="info" title={`Hueco libre: ${dayText(free)}, a las ${hourText(free)}`}>
          {team && slotWho ? `Con ${staffName(staff, slotWho)}. ` : ""}Ofréceselo a quien lleva más tiempo esperando; si dice que sí, dale la cita aquí.
        </Alert>
      ) : (
        <p className="text-sm text-text-muted">
          Apunta a quien quiere venir antes o espera un hueco. Cuando se anule una cita, la agenda te enseñará esta lista para ofrecérselo.
        </p>
      )}

      {data.data && data.data.items.length === 0 && <p className="text-sm text-text-muted">No hay nadie esperando.</p>}
      <ul aria-label="Lista de espera" className="flex flex-col gap-2">
        {data.data?.items.map((w) => {
          const phone = waPhone(w.phone);
          const text = free ? offerText({ name: w.name, startsAt: free, clinic: data.data!.clinic, professional: team && slotWho ? staffName(staff, slotWho) : null }) : "";
          const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
          return (
            <li key={w.id}>
              <Card role="group" aria-label={w.name} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-sm text-text-muted">Esperando {since(w.createdAt)}</p>
                </div>
                {w.note && <p className="text-sm">Le viene bien: {w.note}</p>}
                <p className="text-sm text-text-muted">
                  {[team && (w.assignedTo ? `Con ${staffName(staff, w.assignedTo)}` : "Con cualquiera"), w.nextAt ? `Su próxima cita: ${dayText(w.nextAt)}, ${hourText(w.nextAt)}` : "Sin cita pendiente"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {free && (
                  <div className="flex flex-wrap gap-2">
                    {w.contact !== false && phone && (
                      <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}>
                        <MessageCircle aria-hidden="true" className="size-5" /> Ofrecer por WhatsApp
                      </a>
                    )}
                    {w.contact !== false && w.email && (
                      <a href={mailtoUrl(w.email, "Hueco libre para tu fisioterapia", text)} className={cx(link, "border border-border bg-bg hover:bg-surface")}>
                        <Mail aria-hidden="true" className="size-5" /> Correo
                      </a>
                    )}
                    {(w.contact === false || (!phone && !w.email)) && <p className="text-sm text-text-muted">Llámale{w.phone ? `: ${w.phone}` : ""}.</p>}
                    <Button variant="secondary" icon={<CalendarPlus aria-hidden="true" className="size-5" />} onClick={() => void give(w)}>
                      Darle la cita
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  icon={<Trash aria-hidden="true" className="size-4" />}
                  onClick={async () => {
                    await removeFromWaitlist(getDb(), w.id);
                    bumpData();
                    toast(`${w.name}: fuera de la lista`, "success");
                  }}
                >
                  Quitar de la lista
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      <Button variant={free ? "secondary" : "primary"} icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setAdding(true)}>
        Añadir a la lista
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Añadir a la lista de espera">
        {adding && (
          <AddForm
            team={team}
            staff={staff}
            onSave={async (patientId, note, assignedTo) => {
              await addToWaitlist(getDb(), patientId, { note, assignedTo });
              setAdding(false);
              bumpData();
              toast("Añadido a la lista de espera", "success");
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

function AddForm({ team, staff, onSave }: { team: boolean; staff: { email: string; name: string }[]; onSave: (patientId: string, note: string, assignedTo: string | null) => Promise<void> }) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
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
          await onSave(picked.id, note, who || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <PatientPicker
        picked={picked}
        onPick={(p) => {
          setPicked(p);
          setError(null);
        }}
      />
      <TextField label="Cuándo le viene bien (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mañanas, martes y jueves por la tarde…" />
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
        Añadir a la lista
      </Button>
    </form>
  );
}
