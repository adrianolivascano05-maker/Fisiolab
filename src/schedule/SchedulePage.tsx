// Horario de la clínica (src/data/schedule.ts): la semana día a día, con los turnos de cada persona del equipo y sus
// citas. Desde aquí se ponen turnos y se pasa una cita a otra persona. Va en la base de la clínica, así que cada
// compañero lo ve en sus dispositivos en cuanto se sincroniza (con la pantalla abierta, se pone al día sola).
import { ChevronLeft, ChevronRight, CopyPlus, Plus, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { bumpData } from "../app/dataVersion";
import { madridDay } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { AppointmentSheet } from "../clinical/AppointmentSheet";
import { addDays, todayDay } from "../clinical/pageKit";
import { useCloud, useSyncState } from "../cloud/CloudGate";
import { agenda, STATUS_LABELS, type AgendaItem } from "../data/appointments";
import { getDb } from "../data/db";
import { copyWeekForward, plusWeeks, shiftsBetween, staffColor, withinShift, type Shift } from "../data/schedule";
import { Button, IconButton } from "../ui/Button";
import { SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { ShiftSheet } from "./ShiftSheet";
import { useStaff } from "./useStaff";

const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const dayTitle = (day: string) => {
  const t = new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** El lunes (AAAA-MM-DD) de la semana de `day`. */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00`).getDay() + 6) % 7));
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

export function SchedulePage() {
  const cloud = useCloud();
  const toast = useToast();
  const sync = useSyncState();
  const staff = useStaff();
  const [monday, setMonday] = useState(() => mondayOf(todayDay()));
  const [who, setWho] = useState("");
  const [editing, setEditing] = useState<{ shift: Shift | null; day: string } | null>(null);
  const [managing, setManaging] = useState<AgendaItem | null>(null);
  const [copying, setCopying] = useState(false);
  const from = new Date(`${monday}T00:00:00`).toISOString();
  const week = useAsync(async () => {
    const to = plusWeeks(from, 1);
    return { shifts: await shiftsBetween(getDb(), from, to), appointments: await agenda(getDb(), from, to) };
  }, [from]);

  // Con el horario a la vista, lo que llega de los compañeros se enseña solo (si no se está escribiendo nada).
  const newData = !!sync?.newData;
  useEffect(() => {
    if (newData && !editing && !managing && cloud) {
      cloud.sync.seenNewData();
      bumpData();
    }
  }, [newData, editing, managing, cloud]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  if (!cloud?.clinic) return <Navigate to="/" replace />;
  const me = cloud.account.email.trim().toLowerCase();
  const admin = cloud.clinic.role === "admin";
  const today = todayDay();
  const shifts = (week.data?.shifts ?? []).filter((s) => !who || s.staffEmail === who);
  const appointments = (week.data?.appointments ?? []).filter((a) => !who || a.assignedTo === who || (who === "-" && !a.assignedTo));
  const order = (email: string | null) => (email === null ? 1e6 : staff.findIndex((s) => s.email === email) + (staff.some((s) => s.email === email) ? 0 : 1e5));

  return (
    <Page title="Horario">
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Semana anterior" onClick={() => setMonday(addDays(monday, -7))}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </IconButton>
        <p className="text-center font-semibold" aria-live="polite">
          {short(monday)} – {short(addDays(monday, 6))}
        </p>
        <IconButton label="Semana siguiente" onClick={() => setMonday(addDays(monday, 7))}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </IconButton>
      </div>
      {monday !== mondayOf(today) && (
        <Button variant="ghost" size="sm" onClick={() => setMonday(mondayOf(today))}>
          Volver a esta semana
        </Button>
      )}
      <SelectField label="Ver" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Todo el equipo</option>
        {staff.map((s) => (
          <option key={s.email} value={s.email}>
            {s.email === me ? `${s.name} (tú)` : s.name}
          </option>
        ))}
        <option value="-">Citas sin asignar</option>
      </SelectField>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setEditing({ shift: null, day: days.includes(today) ? today : monday })}>
          Añadir turno
        </Button>
        {admin && (
          <Button
            variant="secondary"
            loading={copying}
            icon={<CopyPlus aria-hidden="true" className="size-5" />}
            onClick={async () => {
              setCopying(true);
              try {
                const n = await copyWeekForward(getDb(), from);
                toast(n ? `${n === 1 ? "1 turno copiado" : `${n} turnos copiados`} a la semana siguiente` : "La semana siguiente ya tiene estos turnos", "success");
                bumpData();
                setMonday(addDays(monday, 7));
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "danger");
              } finally {
                setCopying(false);
              }
            }}
          >
            Repetir esta semana en la siguiente
          </Button>
        )}
      </div>

      {days.map((day) => {
        const dayShifts = shifts.filter((s) => madridDay(s.startsAt) === day);
        const dayAppointments = appointments.filter((a) => madridDay(a.startsAt) === day);
        const people = [...new Set<string | null>([...dayShifts.map((s) => s.staffEmail), ...dayAppointments.map((a) => a.assignedTo)])].sort((a, b) => order(a) - order(b));
        return (
          <section key={day} aria-labelledby={`dia-${day}`} className="flex flex-col gap-2">
            <h2 id={`dia-${day}`} className="text-base font-semibold">
              {dayTitle(day)}
              {day === today && <span className="font-normal text-text-muted"> · Hoy</span>}
            </h2>
            {people.length === 0 ? (
              <p className="text-sm text-text-muted">Sin turnos ni citas.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
                {people.map((email) => {
                  const person = staff.find((s) => s.email === email);
                  const mine = dayShifts.filter((s) => s.staffEmail === email);
                  const theirs = dayAppointments.filter((a) => a.assignedTo === email);
                  return (
                    <li key={email ?? "-"} className="flex flex-col gap-1.5 border-l-4 px-3 py-2" style={{ borderLeftColor: email ? staffColor(person) : "transparent" }}>
                      <p className="font-semibold">{email === null ? "Sin asignar" : `${person?.name ?? email}${email === me ? " (tú)" : ""}`}</p>
                      {mine.map((s) => {
                        const text = `Turno ${hour(s.startsAt)}–${hour(s.endsAt)}${s.note ? ` · ${s.note}` : ""}`;
                        return admin || s.staffEmail === me ? (
                          <button key={s.id} type="button" className="tap self-start rounded-md bg-surface px-2 text-left text-sm hover:underline" onClick={() => setEditing({ shift: s, day })}>
                            {text}
                          </button>
                        ) : (
                          <p key={s.id} className="text-sm">
                            {text}
                          </p>
                        );
                      })}
                      {theirs.map((a) => {
                        const outside = email !== null && a.status === "scheduled" && !withinShift(week.data?.shifts ?? [], email, a.startsAt, a.minutes);
                        return (
                          <button key={a.id} type="button" className="tap flex flex-wrap items-center gap-x-2 text-left text-sm hover:underline" onClick={() => setManaging(a)}>
                            <span className="font-semibold">{hour(a.startsAt)}</span>
                            <span>{a.name}</span>
                            <span className="text-text-muted">
                              {a.minutes} min{a.status !== "scheduled" && ` · ${STATUS_LABELS[a.status]}`}
                            </span>
                            {outside && (
                              <span className="inline-flex items-center gap-1 text-warning">
                                <TriangleAlert aria-hidden="true" className="size-4" /> Fuera de turno
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <p className="text-sm text-text-muted">
        Las citas se dan desde la ficha de cada paciente («Dar cita»); al darlas o al tocarlas aquí, eliges con quién son. A cada persona le salen en su Google
        Calendar solo las suyas.
      </p>

      {editing && (
        <ShiftSheet open onClose={() => setEditing(null)} shift={editing.shift} day={editing.day} staff={staff} me={me} admin={admin} />
      )}
      {managing && (
        <AppointmentSheet open onClose={() => setManaging(null)} patientId={managing.patientId} patientName={managing.name} appointment={managing} />
      )}
    </Page>
  );
}

